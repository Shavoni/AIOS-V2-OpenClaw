# Quick Directory Check

Clear-Host
Write-Host "=== Current Directory ===" -ForegroundColor Cyan
Get-ChildItem | Format-Table -AutoSize

Write-Host "`n=== Searching for JS files ===" -ForegroundColor Cyan
Get-ChildItem -Recurse -Filter "*.js" | Select-Object FullName

Write-Host "`n=== Searching for model files ===" -ForegroundColor Cyan
Get-ChildItem -Recurse -Filter "*model*" | Select-Object FullName

Write-Host "`n=== Searching for database related files ===" -ForegroundColor Cyan
Get-ChildItem -Recurse -Include "*.js", "*.json" | Where-Object {$_.Name -match "(db|sql|postgres|sequelize)" -or $_.DirectoryName -like "*app*"} | Select-Object FullName