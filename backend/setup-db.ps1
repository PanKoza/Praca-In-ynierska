# setup-db.ps1 - Run once to create the database and apply migrations
# Usage: .\setup-db.ps1

$ErrorActionPreference = "Stop"

# 1. Add PostgreSQL 18 to PATH for this session
$env:PATH += ";C:\Program Files\PostgreSQL\18\bin"

# 2. Read and parse DATABASE_URL from .env using regex on raw file content
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env file not found. Copy .env.example to .env and fill in your values."
    exit 1
}

$envRaw = Get-Content $envFile -Raw -Encoding UTF8
$urlMatch = [regex]::Match($envRaw, '(?m)^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?')
if (-not $urlMatch.Success) {
    Write-Error "DATABASE_URL not found in .env"
    exit 1
}
$rawUrl = $urlMatch.Groups[1].Value.Trim('"').Trim("'")

# 3. Extract credentials — supports URL-encoded passwords (e.g. %40 for @)
$credMatch = [regex]::Match($rawUrl, 'postgresql://([^:]+):([^@]+)@([^:/]+):?(\d*)/([^\?]+)')
if (-not $credMatch.Success) {
    Write-Error "Could not parse DATABASE_URL. Expected: postgresql://user:password@host:5432/dbname"
    exit 1
}

$pgUser = $credMatch.Groups[1].Value
# Decode URL-encoded characters in password (e.g. %40 → @)
$pgPass = [System.Uri]::UnescapeDataString($credMatch.Groups[2].Value)
$pgHost = $credMatch.Groups[3].Value
$pgPort = if ($credMatch.Groups[4].Value -ne '') { $credMatch.Groups[4].Value } else { "5432" }
$dbName = $credMatch.Groups[5].Value

$env:PGPASSWORD = $pgPass

Write-Host ""
Write-Host "=== Tournament App - Database Setup ===" -ForegroundColor Cyan
Write-Host "User : $pgUser"
Write-Host "Host : $pgHost`:$pgPort"
Write-Host "DB   : $dbName"
Write-Host ""

# 4. Create the database (safe to run even if it already exists)
Write-Host "Creating database '$dbName'..." -ForegroundColor Yellow
$createResult = psql -U $pgUser -h $pgHost -p $pgPort -d postgres `
    -c "CREATE DATABASE `"$dbName`";" 2>&1
if ($LASTEXITCODE -ne 0) {
    if ("$createResult" -match "already exists") {
        Write-Host "Database already exists - skipping." -ForegroundColor DarkYellow
    } else {
        Write-Error "psql error: $createResult"
        exit 1
    }
} else {
    Write-Host "Database created successfully." -ForegroundColor Green
}

# 5. Run Prisma migrations
Write-Host ""
Write-Host "Running Prisma migration..." -ForegroundColor Yellow
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Error "Prisma migration failed. Check the output above."
    exit 1
}

Write-Host ""
Write-Host "=== Setup complete! ===" -ForegroundColor Green
Write-Host "Start the server with:  npm run dev" -ForegroundColor Cyan
