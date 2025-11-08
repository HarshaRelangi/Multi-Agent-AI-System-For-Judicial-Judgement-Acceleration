# Project Status - Quick Reference

## Current Status: ✓ All Agents Running

All three backend agents are running successfully:

- **Agent 1 (Case Analyzer)**: http://localhost:8001 ✓
- **Agent 2 (Human Feedback Integrator)**: http://localhost:8002 ✓
- **Agent 3 (Verdict Synthesizer)**: http://localhost:8003 ✓

## Next Steps to Run Full Project

### Step 1: Start the Orchestration API (Terminal 2)
```powershell
cd backend\api
npm install    # If not already done
npm start      # Runs on http://localhost:4000
```

### Step 2: Start the Frontend (Terminal 3)
```powershell
cd frontend
npm install    # If not already done
npm run dev    # Runs on http://localhost:5173
```

### Step 3: Access the Application
Open your browser to: **http://localhost:5173**

## Quick Commands

### Check Agent Status
```powershell
# Agent 1
Invoke-WebRequest http://localhost:8001/health -UseBasicParsing | ConvertFrom-Json

# Agent 2
Invoke-WebRequest http://localhost:8002/health -UseBasicParsing | ConvertFrom-Json

# Agent 3
Invoke-WebRequest http://localhost:8003/health -UseBasicParsing | ConvertFrom-Json
```

### Stop All Agents
```powershell
Get-Process python | Stop-Process -Force
```

### Restart All Agents
```powershell
cd C:\Users\dkmr0\OneDrive\Desktop\Projects\capstone01\backend\agents
.\start_all_agents.ps1
```

## How to Run Individual Agents

If you need to run agents individually, use Python 3.11:

```powershell
# From backend/agents directory
C:\Users\dkmr0\AppData\Local\Programs\Python\Python311\python.exe agent1.py
C:\Users\dkmr0\AppData\Local\Programs\Python\Python311\python.exe agent2.py
C:\Users\dkmr0\AppData\Local\Programs\Python\Python311\python.exe agent3.py
```

## Troubleshooting

### If agents don't start:
1. Make sure you're in the `backend\agents` directory
2. Verify Python 3.11 has all packages: `C:\Users\dkmr0\AppData\Local\Programs\Python\Python311\python.exe -m pip list`
3. Check if ports 8001, 8002, 8003 are available

### If you get "ModuleNotFoundError":
The issue is that your default Python (3.13.7) doesn't have the packages. Always use Python 3.11 explicitly:
```powershell
C:\Users\dkmr0\AppData\Local\Programs\Python\Python311\python.exe your_script.py
```

## Project Structure
```
capstone01/
├── backend/
│   ├── agents/        ← You are here
│   │   ├── agent1.py  (Port 8001)
│   │   ├── agent2.py  (Port 8002)
│   │   ├── agent3.py  (Port 8003)
│   │   └── requirements.txt
│   └── api/           ← Orchestration API (Port 4000)
├── frontend/          ← React/Vite App (Port 5173)
└── README.md
```

## Notes
- All agents use FastAPI
- Each agent runs on a separate port
- The orchestration API coordinates all agents
- The frontend provides the UI to interact with the system


