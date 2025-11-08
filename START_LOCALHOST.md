# How to Run on Localhost

This guide explains how to run the Justice AI Multi-Agent System on your local machine.

## Prerequisites

1. **Python 3.11** installed and available in PATH
2. **Node.js** installed (for backend API and frontend)
3. **Python dependencies** installed (see Step 1 below)

## Quick Start (All Services)

### Option 1: Use the Master Startup Script (Recommended)

Run this PowerShell script from the project root:

```powershell
.\start_all_services.ps1
```

This will start all services automatically.

### Option 2: Manual Startup

Follow the steps below to start each service manually.

---

## Step-by-Step Manual Setup

### Step 1: Install Python Dependencies

Open a terminal in `backend/agents` directory:

```powershell
cd backend\agents
pip install -r requirements.txt
```

Required packages:
- fastapi
- uvicorn
- openai
- pydantic
- PyPDF2
- python-docx
- Pillow

### Step 2: Install Node.js Dependencies

#### Backend API:
```powershell
cd backend\api
npm install
```

#### Frontend:
```powershell
cd frontend
npm install
```

### Step 3: Start All Services

You need to start **4 services** in total:

#### 3.1 Start Agent 1 (Case Analyzer) - Port 8001

Open a **new terminal/PowerShell window**:

```powershell
cd backend\agents
python agent1.py
```

Or use the startup script:
```powershell
cd backend\agents
.\start_all_agents.ps1
```

#### 3.2 Start Agent 2 (Human Feedback Integrator) - Port 8002

The startup script starts this automatically, or manually:

```powershell
cd backend\agents
python agent2.py
```

#### 3.3 Start Agent 3 (Verdict Synthesizer) - Port 8003

The startup script starts this automatically, or manually:

```powershell
cd backend\agents
python agent3.py
```

#### 3.4 Start Backend API Server - Port 4000

Open a **new terminal/PowerShell window**:

```powershell
cd backend\api
npm start
```

Or:
```powershell
cd backend\api
node server.js
```

#### 3.5 Start Frontend Development Server - Port 5173

Open a **new terminal/PowerShell window**:

```powershell
cd frontend
npm run dev
```

---

## Service URLs

Once all services are running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | Main web application |
| **Backend API** | http://localhost:4000 | Orchestration server |
| **Agent 1** | http://localhost:8001 | Case Analyzer |
| **Agent 2** | http://localhost:8002 | Human Feedback Integrator |
| **Agent 3** | http://localhost:8003 | Verdict Synthesizer |

### Health Check Endpoints

Test if services are running:

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/health
- Agent 1: http://localhost:8001/health
- Agent 2: http://localhost:8002/health
- Agent 3: http://localhost:8003/health

---

## Verification

After starting all services, verify they're running:

```powershell
# Check Agent 1
Invoke-WebRequest -Uri "http://localhost:8001/health" -UseBasicParsing

# Check Agent 2
Invoke-WebRequest -Uri "http://localhost:8002/health" -UseBasicParsing

# Check Agent 3
Invoke-WebRequest -Uri "http://localhost:8003/health" -UseBasicParsing

# Check Backend API
Invoke-WebRequest -Uri "http://localhost:4000/health" -UseBasicParsing
```

All should return `200 OK` status.

---

## Troubleshooting

### Port Already in Use

If a port is already in use, you can:

1. **Find and stop the process:**
   ```powershell
   # Find process using port 8001
   netstat -ano | findstr :8001
   # Kill the process (replace PID with actual process ID)
   taskkill /PID <PID> /F
   ```

2. **Or change the port** in the respective service file

### Python Not Found

Make sure Python 3.11 is in your PATH:
```powershell
python --version
```

If not found, use full path:
```powershell
C:\Users\Harsha\AppData\Local\Programs\Python\Python311\python.exe agent1.py
```

### Node.js Not Found

Make sure Node.js is installed:
```powershell
node --version
npm --version
```

---

## Stopping Services

To stop all services:

1. Close each terminal window running a service
2. Or use Ctrl+C in each terminal
3. Or kill processes:
   ```powershell
   taskkill /F /IM python.exe
   taskkill /F /IM node.exe
   ```

---

## Development Mode

For development with auto-reload:

- **Backend API:** Use `npm run dev` (requires nodemon)
- **Frontend:** Already uses Vite's hot reload (automatic)

---

## Notes

- All agents use **OpenAI GPT-4o** model
- Make sure your OpenAI API key is configured in `agent1.py` and `agent3.py`
- The frontend connects to the backend API at `http://localhost:4000`
- WebSocket connections are used for real-time updates



