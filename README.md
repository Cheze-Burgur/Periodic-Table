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
delay with `-DelayMilliseconds`.
