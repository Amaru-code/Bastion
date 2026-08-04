$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $projectPath 'index.html'

$browserCandidates = @(
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
)

$browser = $browserCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($browser) {
    Start-Process -FilePath $browser -ArgumentList @("file:///$($indexPath -replace '\\','/')")
} else {
    Write-Host 'Edge oder Chrome wurde nicht gefunden. Öffne die Datei über den Windows-Standardbrowser.'
    Start-Process -FilePath 'rundll32.exe' -ArgumentList @('url.dll,FileProtocolHandler', $indexPath)
}
