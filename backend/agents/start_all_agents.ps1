# Simple script to start all agents
Write-Host "Starting all agents..." -ForegroundColor Green

Start-Process -FilePath "C:\Users\Harsha\AppData\Local\Programs\Python\Python311\python.exe" -ArgumentList "agent1.py" -WorkingDirectory "C:\Users\Harsha\Downloads\capstone01\capstone01\backend\agents" -WindowStyle Normal
Write-Host "Agent 1 starting..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

Start-Process -FilePath "C:\Users\Harsha\AppData\Local\Programs\Python\Python311\python.exe" -ArgumentList "agent2.py" -WorkingDirectory "C:\Users\Harsha\Downloads\capstone01\capstone01\backend\agents" -WindowStyle Normal
Write-Host "Agent 2 starting..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

Start-Process -FilePath "C:\Users\Harsha\AppData\Local\Programs\Python\Python311\python.exe" -ArgumentList "agent3.py" -WorkingDirectory "C:\Users\Harsha\Downloads\capstone01\capstone01\backend\agents" -WindowStyle Normal
Write-Host "Agent 3 starting..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

Write-Host "`nChecking status..." -ForegroundColor Cyan
Write-Host "Agent 1: http://localhost:8001/health" -ForegroundColor White
Write-Host "Agent 2: http://localhost:8002/health" -ForegroundColor White  
Write-Host "Agent 3: http://localhost:8003/health" -ForegroundColor White
Write-Host "`nDone! All agents should be running now." -ForegroundColor Green

