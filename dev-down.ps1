param(
    [switch]$PruneData
)

$ErrorActionPreference = 'Stop'

if ($PruneData) {
    Write-Host "Apagando servicios y eliminando volumenes locales..."
    docker compose down -v --remove-orphans
} else {
    Write-Host "Apagando servicios..."
    docker compose down
}

Write-Host "Listo."
