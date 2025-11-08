/**
 * Justice AI - Backend Orchestration Server
 * Coordinates all three agents and provides WebSocket updates
 */
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');

const PORT = process.env.PORT || 4000;
const AGENT1_URL = process.env.AGENT1_URL || 'http://localhost:8001';
const AGENT2_URL = process.env.AGENT2_URL || 'http://localhost:8002';
const AGENT3_URL = process.env.AGENT3_URL || 'http://localhost:8003';

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Workflow state management
const workflowStates = new Map();

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'orchestration-api',
    port: PORT,
    agents: {
      agent1: AGENT1_URL,
      agent2: AGENT2_URL,
      agent3: AGENT3_URL
    }
  });
});

/**
 * Agent 1 endpoints - Case Analyzer (with file uploads)
 */
app.post('/api/agents/agent1/analyze', upload.array('files'), async (req, res) => {
  try {
    const caseId = req.body.case_id || `case_${Date.now()}`;
    
    // Edge case: Validate files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    console.log(`Received ${req.files.length} files for case ${caseId}`);
    
    // Create FormData for forwarding to Agent 1
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('case_id', caseId);
    
    // Add all uploaded files
    req.files.forEach(file => {
      // Edge case: Validate file
      if (!file || !file.buffer) {
        console.warn(`Skipping invalid file: ${file?.originalname || 'unknown'}`);
        return;
      }
      
      console.log(`Adding file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);
      formData.append('files', file.buffer, {
        filename: file.originalname || 'file',
        contentType: file.mimetype || 'application/octet-stream'
      });
    });
    
    // Use axios for better multipart handling
    const axios = require('axios');
    
    // Forward to Agent 1 with files using axios
    const response = await axios.post(`${AGENT1_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const data = response.data;
    
    // Emit WebSocket update
    io.emit('workflow:update', {
      caseId: caseId,
      step: 'agent1',
      status: 'completed',
      data: data
    });
    
    res.json(data);
  } catch (err) {
    console.error('Agent1 call failed:', err);
    res.status(500).json({ error: 'Agent1 call failed', details: err.message });
  }
});

/**
 * Agent 2 endpoints - Human Feedback Integrator
 */
app.post('/api/agents/agent2/submit', async (req, res) => {
  try {
    const response = await fetch(`${AGENT2_URL}/documents/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Agent2 call failed', details: err.message });
  }
});

app.get('/api/agents/agent2/documents/:caseId', async (req, res) => {
  try {
    const response = await fetch(`${AGENT2_URL}/documents/${req.params.caseId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Agent2 call failed', details: err.message });
  }
});

app.post('/api/agents/agent2/feedback', async (req, res) => {
  try {
    const response = await fetch(`${AGENT2_URL}/documents/${req.body.case_id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    
    io.emit('workflow:update', {
      caseId: req.body.case_id,
      step: 'agent2',
      status: 'updated',
      data: data
    });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Agent2 call failed', details: err.message });
  }
});

/**
 * Agent 3 endpoints - Verdict Synthesizer
 */
app.post('/api/agents/agent3/synthesize', async (req, res) => {
  try {
    console.log('Orchestration API: Received Agent 3 synthesize request:', req.body);
    
    // Edge case: Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    const requestBody = req.body || {};
    
    // Construct the CaseData object that Agent 3 expects
    const agent3Request = {
      case_id: requestBody.case_id || "unknown",
      key_facts: Array.isArray(requestBody.key_facts) ? requestBody.key_facts : [],
      entities: requestBody.entities && typeof requestBody.entities === 'object' ? requestBody.entities : {},
      legal_issues: Array.isArray(requestBody.legal_issues) ? requestBody.legal_issues : (requestBody.legal_issues_identified && Array.isArray(requestBody.legal_issues_identified) ? requestBody.legal_issues_identified : []),
      timeline: Array.isArray(requestBody.timeline) ? requestBody.timeline : [],
      case_summary: typeof requestBody.case_summary === 'string' ? requestBody.case_summary : ""
    };
    
    console.log('Orchestration API: Calling Agent 3 at:', AGENT3_URL);
    console.log('Orchestration API: Request payload:', agent3Request);
    
    const response = await fetch(`${AGENT3_URL}/synthesize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(agent3Request)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agent 3 error response:', response.status, errorText);
      throw new Error(`Agent 3 returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Orchestration API: Agent 3 returned:', data);
    
    io.emit('workflow:update', {
      caseId: requestBody.case_id,
      step: 'agent3',
      status: 'completed',
      data: data
    });
    
    res.json(data);
  } catch (err) {
    console.error('Agent3 call failed:', err);
    res.status(500).json({ error: 'Agent3 call failed', details: err.message });
  }
});

/**
 * Workflow orchestration endpoints
 */
app.post('/api/workflow/start', async (req, res) => {
  const { caseId, files } = req.body;
  
  const workflowState = {
    caseId,
    currentStep: 'upload',
    data: { files },
    status: 'uploaded',
    timestamp: new Date().toISOString()
  };
  
  workflowStates.set(caseId, workflowState);
  
  io.emit('workflow:update', {
    caseId,
    step: 'upload',
    status: 'completed',
    data: { files }
  });
  
  res.json({ status: 'workflow_started', caseId });
});

app.get('/api/workflow/:caseId', (req, res) => {
  const workflow = workflowStates.get(req.params.caseId);
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' });
  }
  res.json(workflow);
});

app.get('/api/workflows', (req, res) => {
  const workflows = Array.from(workflowStates.values());
  res.json({ workflows, total: workflows.length });
});

// WebSocket setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  socket.emit('workflow:update', { message: 'Connected to realtime server' });
  
  socket.on('join:case', (caseId) => {
    socket.join(caseId);
  });
  
  socket.on('disconnect', () => {
    // Handle disconnection
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Justice AI Orchestration Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`\nAgent endpoints:`);
  console.log(`   Agent 1 (Case Analyzer): ${AGENT1_URL}`);
  console.log(`   Agent 2 (Feedback): ${AGENT2_URL}`);
  console.log(`   Agent 3 (Verdict): ${AGENT3_URL}`);
});


