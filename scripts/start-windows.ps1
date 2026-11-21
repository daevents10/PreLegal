# Start Prelegal on Windows (Docker): build the image and run a fresh container.
# A fresh container (and therefore a fresh SQLite database) is created on every start.
$ErrorActionPreference = "Stop"

$Image = "prelegal"
$Container = "prelegal"
$Port = if ($env:PRELEGAL_PORT) { $env:PRELEGAL_PORT } else { "8000" }
$Root = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error "Docker is not installed or not on PATH."
}

Write-Host "Building image '$Image'..."
docker build -t $Image $Root
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Replace any container left over from a previous run.
# (Check first: redirecting native stderr under ErrorActionPreference=Stop throws in PowerShell 5.1.)
if (docker ps -a --filter "name=^${Container}$" --format "{{.Names}}") {
    docker rm -f $Container | Out-Null
}

$runArgs = @("run", "-d", "--rm", "--name", $Container, "-p", "${Port}:8000")
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) { $runArgs += @("--env-file", $envFile) }
$runArgs += $Image

Write-Host "Starting container '$Container'..."
docker @runArgs | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

for ($i = 0; $i -lt 30; $i++) {
    try {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$Port/api/health" | Out-Null
        Write-Host "Prelegal is running at http://localhost:$Port"
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host "Prelegal did not become healthy in time. Recent logs:"
docker logs --tail 50 $Container
exit 1
