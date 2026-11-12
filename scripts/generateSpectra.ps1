param(
    [int]$DelayMilliseconds = 1000,
    [int]$MaximumRetries = 3,
    [int]$RetryBaseDelaySeconds = 2,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if ($DelayMilliseconds -lt 0) {
    throw "DelayMilliseconds must be zero or greater."
}

if ($MaximumRetries -lt 0) {
    throw "MaximumRetries must be zero or greater."
}

if ($RetryBaseDelaySeconds -lt 0) {
    throw "RetryBaseDelaySeconds must be zero or greater."
}

function Get-NistSpectrum {
    param(
        [string]$Uri,
        [string]$Symbol,
        [int]$MaxRetries,
        [int]$RetryBaseDelaySeconds
    )

    for ($attempt = 0; $attempt -le $MaxRetries; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Uri -TimeoutSec 60 -UseBasicParsing
            $csv = $response.Content

            if ($response.StatusCode -ne 200) {
                throw "NIST returned HTTP $($response.StatusCode)."
            }

            if ($csv -notmatch '(?im)^obs_wl_(air|vac)\(nm\),.*\bintens\b') {
                if ($csv -match '(?is)No lines are available in ASD with the parameters selected') {
                    return "obs_wl_air(nm),intens`n"
                }

                throw "NIST returned invalid spectral data."
            }

            return $csv
        } catch {
            if ($attempt -ge $MaxRetries) {
                throw "Failed to retrieve valid spectral data for $Symbol after $($attempt + 1) attempts: $($_.Exception.Message)"
            }

            $delaySeconds = $RetryBaseDelaySeconds * [Math]::Pow(2, $attempt)
            Write-Warning "Request for $Symbol failed on attempt $($attempt + 1); retrying in $delaySeconds seconds. $($_.Exception.Message)"
            if ($delaySeconds -gt 0) {
                Start-Sleep -Seconds $delaySeconds
            }
        }
    }
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

    $csv = Get-NistSpectrum `
        -Uri $uri `
        -Symbol $element.symbol `
        -MaxRetries $MaximumRetries `
        -RetryBaseDelaySeconds $RetryBaseDelaySeconds
    if ($csv -eq "obs_wl_air(nm),intens`n") {
        Write-Output "NIST has no observed lines for $($element.symbol); saving an empty spectrum."
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

$spectrumHashes = @(
    foreach ($element in $elements) {
        $outputPath = Join-Path $spectraDirectory "$($element.symbol).csv"
        $fileHash = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash
        "{0}:{1}" -f $element.symbol, $fileHash
    }
)

$hashInput = [System.Text.Encoding]::UTF8.GetBytes(($spectrumHashes -join "`n"))
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $version = [System.BitConverter]::ToString(
        $sha256.ComputeHash($hashInput)
    ).Replace("-", "").ToLowerInvariant()
} finally {
    $sha256.Dispose()
}

$manifestPath = Join-Path $spectraDirectory "manifest.json"
$existingManifest = $null
$existingVersion = $null
if (Test-Path -LiteralPath $manifestPath) {
    $existingManifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
    $existingVersion = $existingManifest.version
}

$checkedAt = [DateTime]::UtcNow.ToString("o")
$generatedAt = $checkedAt
if ($existingVersion -ceq $version -and $existingManifest.generatedAt) {
    $generatedAt = $existingManifest.generatedAt
}

$manifest = [ordered]@{
    version = $version
    generatedAt = $generatedAt
    lastCheckedAt = $checkedAt
    source = "NIST Atomic Spectra Database"
    wavelengthRangeNm = @(380, 780)
    elementCount = $elements.Count
}

[System.IO.File]::WriteAllText(
    $manifestPath,
    ($manifest | ConvertTo-Json),
    [System.Text.UTF8Encoding]::new($false)
)

if ($existingVersion -ceq $version) {
    Write-Output "Spectrum content is unchanged; updated the manifest check time."
}
else {
    Write-Output "Wrote spectrum manifest for $($elements.Count) elements."
}
