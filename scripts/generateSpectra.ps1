param(
    [int]$DelayMilliseconds = 1000,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if ($DelayMilliseconds -lt 0) {
    throw "DelayMilliseconds must be zero or greater."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$elementsPath = Join-Path $projectRoot "data\elements.json"
$spectraDirectory = Join-Path $projectRoot "data\spectra"
$elements = (Get-Content -Raw $elementsPath | ConvertFrom-Json).elements |
    Where-Object { $_.number -ge 1 -and $_.number -le 118 } |
    Sort-Object number

New-Item -ItemType Directory -Path $spectraDirectory -Force | Out-Null

$parameters = [ordered]@{
    output_type = "0"
    low_w = "380"
    upp_w = "780"
    unit = "1"
    submit = "Retrieve Data"
    de = "0"
    plot_out = "0"
    format = "2"
    line_out = "0"
    en_unit = "0"
    output = "0"
    page_size = "15"
    show_obs_wl = "1"
    unc_out = "1"
    order_out = "0"
    show_av = "2"
    tsb_value = "0"
    A_out = "0"
    intens_out = "on"
    allowed_out = "1"
    forbid_out = "1"
    conf_out = "on"
    term_out = "on"
    enrg_out = "on"
    J_out = "on"
}

for ($index = 0; $index -lt $elements.Count; $index++) {
    $element = $elements[$index]
    $outputPath = Join-Path $spectraDirectory "$($element.symbol).csv"

    if ((Test-Path -LiteralPath $outputPath) -and -not $Force) {
        Write-Output "[$($index + 1)/$($elements.Count)] Keeping $($element.symbol); use -Force to refresh."
        continue
    }

    $query = [System.Collections.Generic.List[string]]::new()
    $query.Add("spectra=$([Uri]::EscapeDataString("$($element.symbol) I"))")
    foreach ($name in $parameters.Keys) {
        $query.Add("$name=$([Uri]::EscapeDataString([string]$parameters[$name]))")
    }

    $uri = "https://pml.nist.gov/cgi-bin/ASD/lines1.pl?$($query -join '&')"
    Write-Output "[$($index + 1)/$($elements.Count)] Downloading $($element.symbol)."

    $response = Invoke-WebRequest -Uri $uri -TimeoutSec 60 -UseBasicParsing
    $csv = $response.Content
    if ($response.StatusCode -ne 200) {
        throw "NIST returned invalid spectral data for $($element.symbol)."
    }

    if ($csv -notmatch '(?im)^obs_wl_(air|vac)\(nm\),.*\bintens\b') {
        if ($csv -match '(?is)No lines are available in ASD with the parameters selected') {
            $csv = "obs_wl_air(nm),intens`n"
            Write-Output "NIST has no observed lines for $($element.symbol); saving an empty spectrum."
        } else {
            throw "NIST returned invalid spectral data for $($element.symbol)."
        }
    }

    [System.IO.File]::WriteAllText(
        $outputPath,
        $csv,
        [System.Text.UTF8Encoding]::new($false)
    )

    if ($DelayMilliseconds -gt 0 -and $index -lt $elements.Count - 1) {
        Start-Sleep -Milliseconds $DelayMilliseconds
    }
}

$manifest = [ordered]@{
    version = [DateTime]::UtcNow.ToString("yyyyMMddHHmmss")
    generatedAt = [DateTime]::UtcNow.ToString("o")
    source = "NIST Atomic Spectra Database"
    wavelengthRangeNm = @(380, 780)
    elementCount = $elements.Count
}
$manifestPath = Join-Path $spectraDirectory "manifest.json"
[System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifest | ConvertTo-Json),
    [System.Text.UTF8Encoding]::new($false)
)

Write-Output "Wrote spectrum manifest for $($elements.Count) elements."
