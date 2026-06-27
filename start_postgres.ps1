$pgDir = "d:\project\.postgres"
$dataDir = "d:\project\.postgres_data"
$logFile = "$dataDir\server.log"

# 1. Initialize DB cluster if not exists
if (-not (Test-Path $dataDir)) {
    Write-Host "Initializing PostgreSQL database cluster..."
    & "$pgDir\bin\initdb.exe" -D $dataDir -U postgres --auth-local=trust --auth-host=trust
}

# 2. Check if postgres is already running
$port = 5432
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "PostgreSQL is already running on port $port."
} else {
    Write-Host "Starting PostgreSQL server..."
    # Make sure folder exists
    New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
    & "$pgDir\bin\pg_ctl.exe" -D $dataDir -l $logFile start
    Start-Sleep -Seconds 3
}

# 3. Create role and database if not exists
Write-Host "Configuring users and databases..."
# Set PGUSER env to postgres for administration queries
$env:PGUSER = "postgres"
$env:PGPASSWORD = ""

# Execute SQL query via psql
& "$pgDir\bin\psql.exe" -h localhost -p 5432 -d postgres -c "CREATE ROLE dr_vault_user WITH LOGIN PASSWORD 'dr_vault_secure_password' SUPERUSER;" 2>$null
& "$pgDir\bin\psql.exe" -h localhost -p 5432 -d postgres -c "CREATE DATABASE dr_vault_db OWNER dr_vault_user;" 2>$null

Write-Host "PostgreSQL is ready!"
