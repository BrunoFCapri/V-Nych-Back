$ErrorActionPreference = 'Stop'

Write-Host "[1/4] Levantando contenedores (db, redis, backend)..."
docker compose up -d

Write-Host "[2/4] Verificando base de datos v_nych..."
$dbExists = docker exec vnych_db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='v_nych'"
if ($dbExists.Trim() -ne "1") {
    docker exec vnych_db psql -U postgres -d postgres -c "CREATE DATABASE v_nych;" | Out-Null
    Write-Host "Base v_nych creada."
} else {
    Write-Host "Base v_nych ya existe."
}

Write-Host "[3/4] Reiniciando backend..."
docker compose restart backend | Out-Null

Write-Host "[4/4] Iniciando frontend (Vite)..."
Push-Location web
try {
    npm install
    npm run dev
}
finally {
    Pop-Location
}
