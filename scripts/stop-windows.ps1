# Stop Prelegal on Windows. The container is run with --rm, so stopping it also
# discards its temporary database.
$ErrorActionPreference = "Stop"

$Container = "prelegal"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not on PATH."
}

$existing = docker ps -a --filter "name=^${Container}$" --format "{{.Names}}"
if ($existing) {
    docker rm -f $Container | Out-Null
    Write-Host "Prelegal stopped."
} else {
    Write-Host "Prelegal is not running."
}
