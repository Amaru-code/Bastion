$root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
(Get-ChildItem $root -Recurse -File).Count
