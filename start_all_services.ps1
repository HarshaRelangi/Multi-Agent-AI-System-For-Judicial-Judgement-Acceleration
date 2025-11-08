# Master Startup Script for Justice AI Multi-Agent System
# This script starts all services required to run the application on localhost

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Justice AI - Starting All Services" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the project root directory
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentsDir = Join-Path $projectRoot "backend\agents"
$apiDir = Join-Path $projectRoot "backend\api"
$frontendDir = Join-Path $projectRoot "frontend"

# Check if Python is available
Write-Host "Checking Python installation..." -ForegroundColor Yellow
$pythonPath = "C:\Users\Harsha\AppData\Local\Programs\Python\Python311\python.exe"
if (-not (Test-Path $pythonPath)) {
    Write-Host "Python not found at expected path. Trying 'python' command..." -ForegroundColor Yellow
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $pythonPath = $pythonCmd.Path
    } else {
        Write-Host "ERROR: Python not found. Please install Python 3.11" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Python found: $pythonPath" -ForegroundColor Green

# Check if Node.js is available
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "ERROR: Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js found: $($nodeCmd.Path)" -ForegroundColor Green
Write-Host ""

# Step 1: Start Agent 1 (Port 8001)
Write-Host "Starting Agent 1 (Case Analyzer) on port 8001..." -ForegroundColor Yellow
$agent1Cmd = "cd '$agentsDir'; Write-Host 'Agent 1 - Case Analyzer (Port 8001)' -ForegroundColor Green; & '$pythonPath' agent1.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $agent1Cmd -WindowStyle Normal
Start-Sleep -Seconds 2

# Step 2: Start Agent 2 (Port 8002)
Write-Host "Starting Agent 2 (Human Feedback Integrator) on port 8002..." -ForegroundColor Yellow
$agent2Cmd = "cd '$agentsDir'; Write-Host 'Agent 2 - Human Feedback Integrator (Port 8002)' -ForegroundColor Green; & '$pythonPath' agent2.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $agent2Cmd -WindowStyle Normal
Start-Sleep -Seconds 2

# Step 3: Start Agent 3 (Port 8003)
Write-Host "Starting Agent 3 (Verdict Synthesizer) on port 8003..." -ForegroundColor Yellow
$agent3Cmd = "cd '$agentsDir'; Write-Host 'Agent 3 - Verdict Synthesizer (Port 8003)' -ForegroundColor Green; & '$pythonPath' agent3.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $agent3Cmd -WindowStyle Normal
Start-Sleep -Seconds 2

# Step 4: Start Backend API Server (Port 4000)
Write-Host "Starting Backend API Server on port 4000..." -ForegroundColor Yellow
$apiCmd = "cd '$apiDir'; Write-Host 'Backend API Server (Port 4000)' -ForegroundColor Green; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $apiCmd -WindowStyle Normal
Start-Sleep -Seconds 3

# Step 5: Start Frontend Development Server (Port 5173)
Write-Host "Starting Frontend Development Server on port 5173..." -ForegroundColor Yellow
$frontendCmd = "cd '$frontendDir'; Write-Host 'Frontend Development Server (Port 5173)' -ForegroundColor Green; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Services Started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor White
Write-Host "  Frontend:        http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend API:     http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Agent 1:         http://localhost:8001" -ForegroundColor Cyan
Write-Host "  Agent 2:         http://localhost:8002" -ForegroundColor Cyan
Write-Host "  Agent 3:         http://localhost:8003" -ForegroundColor Cyan
Write-Host ""
Write-Host "Health Check Endpoints:" -ForegroundColor White
Write-Host "  http://localhost:4000/health" -ForegroundColor Yellow
Write-Host "  http://localhost:8001/health" -ForegroundColor Yellow
Write-Host "  http://localhost:8002/health" -ForegroundColor Yellow
Write-Host "  http://localhost:8003/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Verify services are running
Write-Host ""
Write-Host "Verifying services..." -ForegroundColor Cyan

$services = @(
    @{Name="Agent 1"; Url="http://localhost:8001/health"},
    @{Name="Agent 2"; Url="http://localhost:8002/health"},
    @{Name="Agent 3"; Url="http://localhost:8003/health"},
    @{Name="Backend API"; Url="http://localhost:4000/health"}
)

foreach ($service in $services) {
    try {
        $response = Invoke-WebRequest -Uri $service.Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Host "  OK $($service.Name): Running" -ForegroundColor Green
    } catch {
        Write-Host "  WARNING $($service.Name): Not responding yet (may need a few more seconds)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Open your browser and navigate to:" -ForegroundColor White
Write-Host "  http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "All services are running in separate windows." -ForegroundColor Green
Write-Host "Close those windows to stop the services." -ForegroundColor Yellow
Write-Host ""
