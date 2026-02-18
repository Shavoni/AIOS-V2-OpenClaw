# check-directory.ps1
# Utility script to verify project directory structure

$requiredFiles = @(
    "package.json",
    "server.js",
    ".env.example",
    ".eslintrc.json",
    ".gitignore",
    "README.md",
    "SOUL.md",
    "IDENTITY.md",
    "USER.md"
)

$requiredDirs = @(
    "src",
    "tests",
    "skills",
    "memory",
    ".openclaw"
)

Write-Host "Checking AIOS V2 project structure..." -ForegroundColor Cyan

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
    }
}

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir -PathType Container) {
        Write-Host "  [OK] $dir/" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $dir/" -ForegroundColor Red
    }
}

Write-Host "`nDone." -ForegroundColor Cyan
