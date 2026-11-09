# Cheze's Periodic Table

A periodic table with basic element details

## About the spectral data...

GitHub Pages cannot handle requests to the NIST Atomic Spectra Database. The app therefore loads each element's NIST CSV from `data/spectra/` on demand.

To generate or refresh the spectra using Windows PowerShell:

```powershell
.\scripts\generateSpectra.ps1
```

Existing CSV files are kept by default, so an interrupted download can be
resumed. Add `-Force` to refresh all spectra. The script queries NIST
sequentially and waits one second between requests by default; adjust that
delay with `-DelayMilliseconds`. Failed or invalid responses are retried up to
three times with exponential backoff; use `-MaximumRetries` and
`-RetryBaseDelaySeconds` to adjust the retry policy.

GitHub Actions refreshes the element and spectral data on the first of each
month at 06:00 UTC. You can also run the **Update Periodic Table Data** workflow
manually from the repository's Actions tab. It pushes data changes directly to
the branch.
