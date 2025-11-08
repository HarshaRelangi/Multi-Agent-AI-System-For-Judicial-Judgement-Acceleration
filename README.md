# ⚖️ Justice AI - Multi-Agent Legal Analysis System

A comprehensive AI-powered system for accelerating judicial judgment processes using multiple specialized AI agents. This system analyzes legal case files, extracts key information, and generates verdict predictions based on Indian legal precedents.

![Status](https://img.shields.io/badge/status-active-success)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Node](https://img.shields.io/badge/node-18+-green)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Security Features](#security-features)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🎯 Overview

Justice AI is a multi-agent system designed to streamline legal case analysis and verdict prediction. The system uses three specialized AI agents working together:

1. **Agent 1 (Case Analyzer)**: Processes uploaded case files (PDFs, images, documents) and extracts structured legal information
2. **Agent 2 (Human Feedback Integrator)**: Manages document review and human feedback integration
3. **Agent 3 (Verdict Synthesizer)**: Generates legal verdict predictions based on Indian legal precedents

### Key Capabilities

- 📄 **Multi-format File Processing**: PDF, DOCX, images, text files
- 🔍 **Intelligent Analysis**: Extracts key facts, entities, timelines, and legal issues
- 🇮🇳 **Indian Legal Focus**: Prioritizes Indian legal cases and precedents
- 🔒 **Secure Data Handling**: Encrypted verdict transmission, FTP file storage support
- 📱 **Offline Support**: Works with cached data when agents are unavailable
- 🗑️ **Data Management**: Clear all data functionality for privacy

---

## ✨ Features

### Core Features

- **Multi-Agent Workflow**: Three specialized agents working in coordination
- **Real-time Updates**: WebSocket-based live updates during processing
- **File Upload**: Drag-and-drop or browse file upload interface
- **Document Review**: Interactive document editing and feedback system
- **Verdict Synthesis**: AI-powered legal verdict predictions

### Security Features

- **Verdict Encryption**: All verdict data encrypted using AES-256-CBC
- **FTP File Storage**: Optional secure file storage via FTP
- **Secure Transmission**: Encrypted data transmission from AI to user
- **Data Privacy**: Clear all data functionality

### Advanced Features

- **Offline Fallback**: Automatic caching and offline mode support
- **Indian Legal Precedents**: Focuses on Indian courts and legal system
- **Multi-format Support**: PDF, DOCX, images, text files
- **Image Analysis**: OCR and visual analysis using OpenAI Vision API

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│                    Port: 5173                               │
│  - Case Upload Interface                                    │
│  - Agent Dashboard                                          │
│  - Document Editor                                          │
│  - Verdict Viewer                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTP/WebSocket
                       │
┌──────────────────────▼──────────────────────────────────────┐
│          Backend API (Express + Socket.io)                  │
│                    Port: 4000                               │
│  - File Upload Handling                                     │
│  - Agent Orchestration                                      │
│  - Verdict Encryption/Decryption                            │
│  - Offline Status Monitoring                                │
└──────┬──────────────┬──────────────┬────────────────────────┘
       │              │              │
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  Agent 1    │ │  Agent 2   │ │  Agent 3   │
│  Port: 8001 │ │ Port: 8002 │ │ Port: 8003 │
│             │ │            │ │            │
│ Case        │ │ Feedback   │ │ Verdict    │
│ Analyzer    │ │ Integrator │ │ Synthesizer│
└─────────────┘ └────────────┘ └────────────┘
```

### Technology Stack

**Frontend:**
- React 18
- Vite
- Socket.io-client
- CSS3 with glassmorphism design

**Backend:**
- Node.js + Express
- Socket.io (WebSocket)
- Multer (file uploads)
- Crypto (encryption)

**Agents (Python):**
- FastAPI
- OpenAI API (via chatanywhere.tech)
- PyPDF2 (PDF processing)
- python-docx (Word document processing)
- Pillow (image processing)

---

## 🚀 Installation

### Prerequisites

- **Python 3.11+** installed
- **Node.js 18+** and npm installed
- **Git** for cloning the repository

### Step 1: Clone the Repository

```bash
git clone https://github.com/HarshaRelangi/Multi-Agent-AI-System-For-Judicial-Judgement-Acceleration.git
cd Multi-Agent-AI-System-For-Judicial-Judgement-Acceleration
```

### Step 2: Install Python Dependencies

```bash
cd backend/agents
pip install -r requirements.txt
```

**Required Python packages:**
- fastapi
- uvicorn
- openai
- PyPDF2
- python-docx
- Pillow
- pytesseract (optional, for OCR)

### Step 3: Install Node.js Dependencies

**Backend API:**
```bash
cd backend/api
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Step 4: Verify Installation

Check that all dependencies are installed:

```bash
# Python packages
pip list | grep -E "fastapi|openai|PyPDF2"

# Node packages
cd backend/api && npm list --depth=0
cd ../../frontend && npm list --depth=0
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root (optional):

```env
# Backend API Configuration
PORT=4000
AGENT1_URL=http://localhost:8001
AGENT2_URL=http://localhost:8002
AGENT3_URL=http://localhost:8003

# Encryption (generate a secure key in production)
ENCRYPTION_KEY=your-32-byte-hex-key-here

# FTP Configuration (optional)
FTP_ENABLED=false
FTP_HOST=localhost
FTP_USER=anonymous
FTP_PASSWORD=
FTP_SECURE=false

# Frontend API URL
VITE_API_URL=http://localhost:4000
```

### OpenAI API Configuration

The system uses OpenAI API via chatanywhere.tech. The API key is configured in:
- `backend/agents/agent1.py` (line 31)
- `backend/agents/agent3.py` (line 15)

**⚠️ Security Note**: In production, move API keys to environment variables.

---

## 🎮 Usage

### Starting the System

#### Option 1: Manual Start (Recommended for Development)

**Terminal 1 - Start Agent 1:**
```bash
cd backend/agents
python agent1.py
```

**Terminal 2 - Start Agent 2:**
```bash
cd backend/agents
python agent2.py
```

**Terminal 3 - Start Agent 3:**
```bash
cd backend/agents
python agent3.py
```

**Terminal 4 - Start Backend API:**
```bash
cd backend/api
npm start
```

**Terminal 5 - Start Frontend:**
```bash
cd frontend
npm run dev
```

#### Option 2: Using PowerShell Script (Windows)

```powershell
cd backend/agents
.\start_all_agents.ps1
```

Then start the backend API and frontend separately.

### Accessing the Application

1. Open your browser and navigate to: **http://localhost:5173**
2. You should see the Justice AI interface

### Using the System

1. **Upload Case Files**
   - Click "Upload Case" tab
   - Drag and drop files or click "Browse Files"
   - Supported formats: PDF, DOCX, images (JPG, PNG), text files
   - Click "Process Case" to start analysis

2. **View Analysis Results**
   - After upload, you'll be redirected to "Agent Dashboard"
   - View extracted key facts, entities, timeline, and legal issues

3. **Review Documents**
   - Click "Document Review" tab
   - Review and edit the analyzed document
   - Add feedback if needed
   - Click "Approve & Synthesize Verdict" when ready

4. **View Verdict**
   - After synthesis, view the verdict prediction
   - See legal precedents, risk assessment, and recommendations
   - Verdict data is encrypted for security

5. **Clear All Data**
   - Click "Clear All Data" button in navigation
   - Confirm to delete all server and local data

---

## 📚 API Documentation

### Backend API Endpoints

#### Health Check
```
GET /health
```
Returns server status and agent endpoints.

#### Agent 1 - Case Analysis
```
POST /api/agents/agent1/analyze
Content-Type: multipart/form-data

Body:
  - files: Array of files
  - case_id: Optional case identifier
```

#### Agent 2 - Document Submission
```
POST /api/agents/agent2/submit
Content-Type: application/json

Body:
  - case_id: Case identifier
  - document: Analyzed document data
```

#### Agent 3 - Verdict Synthesis
```
POST /api/agents/agent3/synthesize
Content-Type: application/json

Body:
  - case_id: Case identifier
  - key_facts: Array of key facts
  - entities: Object with people, organizations, locations
  - legal_issues: Array of legal issues
  - timeline: Array of timeline events
  - case_summary: Case summary text
```

#### Verdict Decryption
```
POST /api/verdict/decrypt
Content-Type: application/json

Body:
  - encrypted_data: Encrypted verdict string
```

#### Clear All Data
```
DELETE /api/data/clear-all
```
Clears all workflow states and case data.

#### Offline Status
```
GET /api/offline/status
```
Returns agent availability and offline mode status.

### Agent Endpoints

#### Agent 1 (Port 8001)
- `GET /health` - Health check
- `POST /analyze` - Analyze uploaded files

#### Agent 2 (Port 8002)
- `GET /health` - Health check
- `POST /documents/submit` - Submit document for review
- `GET /documents/:caseId` - Get document by case ID
- `POST /documents/:caseId/feedback` - Submit feedback

#### Agent 3 (Port 8003)
- `GET /health` - Health check
- `POST /synthesize` - Synthesize verdict

---

## 🔒 Security Features

### Verdict Encryption

All verdict data is encrypted using **AES-256-CBC** encryption before transmission:
- Encryption key: 32-byte key (configure via `ENCRYPTION_KEY` env var)
- IV (Initialization Vector): Random 16-byte IV per encryption
- Format: `IV:encryptedData` (hex encoded)

### File Security

- **FTP Storage**: Optional secure file storage via FTP (configure via environment variables)
- **Memory Storage**: Default in-memory storage for development
- **File Validation**: File type and size validation

### Data Privacy

- **Clear All Data**: Complete data deletion endpoint
- **Local Storage**: Client-side caching with clear functionality
- **Secure Transmission**: HTTPS recommended for production

---

## 🛠️ Troubleshooting

### Common Issues

#### Agents Not Starting

**Problem**: Agents fail to start or show import errors

**Solution**:
```bash
# Verify Python version
python --version  # Should be 3.11+

# Reinstall dependencies
cd backend/agents
pip install -r requirements.txt --upgrade
```

#### Port Already in Use

**Problem**: Error "Port XXXX is already in use"

**Solution**:
```bash
# Windows - Find process using port
netstat -ano | findstr :8001

# Kill the process
taskkill /PID <process_id> /F

# Or change ports in configuration
```

#### Frontend Can't Connect to Backend

**Problem**: "Failed to fetch" errors in browser

**Solution**:
1. Verify backend API is running: `http://localhost:4000/health`
2. Check CORS settings in `backend/api/server.js`
3. Verify `VITE_API_URL` in frontend configuration

#### OpenAI API Errors

**Problem**: "OpenAI API not available" or timeout errors

**Solution**:
1. Verify API key is correct in `agent1.py` and `agent3.py`
2. Check internet connection
3. Verify chatanywhere.tech endpoint is accessible
4. Check API rate limits

#### Offline Mode Not Working

**Problem**: Cached data not loading when offline

**Solution**:
1. Check browser localStorage (F12 → Application → Local Storage)
2. Verify `/api/offline/status` endpoint is accessible
3. Check browser console for errors

### Debug Mode

Enable detailed logging:

**Backend API:**
```javascript
// Add to server.js
process.env.DEBUG = 'true';
```

**Python Agents:**
```python
# Add to agent files
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## 📁 Project Structure

```
capstone01/
├── backend/
│   ├── agents/
│   │   ├── agent1.py          # Case Analyzer (OpenAI)
│   │   ├── agent2.py          # Feedback Integrator
│   │   ├── agent3.py          # Verdict Synthesizer (OpenAI)
│   │   ├── requirements.txt   # Python dependencies
│   │   └── start_all_agents.ps1  # Windows startup script
│   └── api/
│       ├── server.js           # Orchestration server
│       ├── package.json       # Node dependencies
│       └── package-lock.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main application component
│   │   ├── components/
│   │   │   ├── CaseUpload.jsx      # File upload component
│   │   │   ├── AgentDashboard.jsx # Dashboard component
│   │   │   ├── DocumentEditor.jsx # Document review component
│   │   │   └── VerdictViewer.jsx  # Verdict display component
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── sample_files/               # Sample case files for testing
├── README.md                   # This file
└── package.json                # Root package.json
```

---

## 🔄 Workflow

### Complete Case Processing Flow

1. **Upload Phase**
   - User uploads case files (PDF, images, documents)
   - Files are processed by Agent 1
   - Key facts, entities, timeline, and legal issues are extracted

2. **Analysis Phase**
   - Agent 1 sends structured data to Agent 2
   - Document is prepared for human review
   - User can view analysis in Dashboard

3. **Review Phase**
   - User reviews extracted information
   - Can add feedback or make edits
   - Approves document for verdict synthesis

4. **Synthesis Phase**
   - Agent 3 receives case data
   - Analyzes using Indian legal precedents
   - Generates verdict prediction with confidence score
   - Verdict is encrypted before transmission

5. **Display Phase**
   - Encrypted verdict is decrypted on frontend
   - User views verdict, precedents, and recommendations
   - Can print or export results

---

## 🌟 Key Features Explained

### Indian Legal Precedents

Agent 3 is specifically configured to:
- Prioritize Indian legal cases (Supreme Court of India, High Courts)
- Use Indian legal terminology (IPC, CrPC, Evidence Act)
- Reference Indian case naming format: "State of [State] vs [Defendant]"
- Focus on Indian legal system and procedures

### Offline Fallback

The system automatically:
- Caches case data to browser localStorage
- Detects when agents are offline
- Loads cached data when API is unavailable
- Shows offline mode indicator

### Verdict Security

- All verdict data encrypted with AES-256-CBC
- Encryption happens server-side before transmission
- Decryption happens client-side on demand
- Secure key management (use environment variables in production)

---

## 🧪 Testing

### Test Case Files

Sample files are available in `sample_files/` directory:
- `test_case_01.txt` - Sample case file
- `test_case_02.txt` - Another sample case
- `sample_contract.txt` - Contract document
- `sample_email.txt` - Email evidence

### Manual Testing

1. **Test File Upload:**
   - Upload a PDF file
   - Verify extraction works
   - Check key facts are extracted

2. **Test Verdict Synthesis:**
   - Complete full workflow
   - Verify verdict is generated
   - Check encryption/decryption works

3. **Test Offline Mode:**
   - Stop one or more agents
   - Verify offline banner appears
   - Check cached data loads

4. **Test Clear Data:**
   - Upload a case
   - Click "Clear All Data"
   - Verify all data is cleared

---

## 📝 Development

### Code Organization

- **Backend API** (`backend/api/server.js`): Well-organized with clear sections
- **Frontend** (`frontend/src/App.jsx`): Component-based React architecture
- **Agents**: Each agent is self-contained with clear responsibilities

### Adding New Features

1. **New Agent Endpoint:**
   - Add route in `backend/api/server.js`
   - Update frontend component if needed
   - Test with sample data

2. **New File Type Support:**
   - Add processing logic in `agent1.py`
   - Update file type detection
   - Test with sample files

3. **New UI Component:**
   - Create component in `frontend/src/components/`
   - Import and use in `App.jsx`
   - Add styling in corresponding CSS file

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Python**: Follow PEP 8 style guide
- **JavaScript**: Use ES6+ syntax, meaningful variable names
- **Comments**: Add clear comments explaining complex logic
- **Documentation**: Update README for new features

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Authors

- **Harsha Relangi** - Initial work and development

---

## 🙏 Acknowledgments

- OpenAI for AI capabilities
- FastAPI for Python web framework
- React team for frontend framework
- All contributors and testers

---

## 📞 Support

For issues, questions, or contributions:
- **GitHub Issues**: [Create an issue](https://github.com/HarshaRelangi/Multi-Agent-AI-System-For-Judicial-Judgement-Acceleration/issues)
- **Email**: harsharelangi1435@gmail.com

---

## 🔮 Future Enhancements

- [ ] Database integration for persistent storage
- [ ] User authentication and authorization
- [ ] Multi-language support
- [ ] Advanced OCR capabilities
- [ ] Video and audio file processing
- [ ] Real-time collaboration features
- [ ] Export to PDF/Word formats
- [ ] Mobile app version

---

**Last Updated**: December 2024
**Version**: 1.0.0

