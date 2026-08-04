$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$required='index.html','js/main.js','js/core/Game.js'
$required|%{if(-not(Test-Path(Join-Path $root $_))){throw "Missing $_"}}
Write-Host 'Bastion validation passed.' -ForegroundColor Green
