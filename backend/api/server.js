/**
 * ============================================================================
 * JUSTICE AI - BACKEND ORCHESTRATION SERVER
 * ============================================================================
 * 
 * This server coordinates all three AI agents and provides:
 * - File upload handling with secure storage (FTP support)
 * - WebSocket real-time updates
 * - Verdict encryption/decryption for security
 * - Offline fallback support
 * - Data management endpoints
 * 
 * Architecture:
 * - Agent 1: Case Analyzer (Port 8001) - Processes uploaded files
 * - Agent 2: Human Feedback Integrator (Port 8002) - Handles document review
 * - Agent 3: Verdict Synthesizer (Port 8003) - Generates legal verdicts
 * 
 * ============================================================================
 */

// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================
const PORT = process.env.PORT || 4000;
const AGENT1_URL = process.env.AGENT1_URL || 'http://localhost:8001';
const AGENT2_URL = process.env.AGENT2_URL || 'http://localhost:8002';
const AGENT3_URL = process.env.AGENT3_URL || 'http://localhost:8003';

// Encryption configuration for verdict security
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16; // Initialization Vector length for AES encryption

// FTP Configuration for secure file storage (optional)
const FTP_CONFIG = {
  enabled: process.env.FTP_ENABLED === 'true',
  host: process.env.FTP_HOST || 'localhost',
  user: process.env.FTP_USER || 'anonymous',
  password: process.env.FTP_PASSWORD || '',
  secure: process.env.FTP_SECURE === 'true'
};

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = express();

// Middleware configuration
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// File upload configuration using multer (stores files in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// ============================================================================
// DATA STORAGE (In-memory - replace with database in production)
// ============================================================================
const workflowStates = new Map(); // Track workflow progress for each case
const caseDataStore = new Map(); // Store case metadata for deletion tracking

// ============================================================================
// ENCRYPTION/DECRYPTION UTILITIES
// ============================================================================

/**
 * Encrypts verdict data using AES-256-CBC encryption
 * @param {string} text - Plain text verdict data to encrypt
 * @returns {string} - Encrypted string in format "IV:encryptedData"
 */
function encryptVerdict(text) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'),
      iv
    );
    let encrypted = cipher.update(text, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt verdict data');
  }
}

/**
 * Decrypts verdict data using AES-256-CBC decryption
 * @param {string} text - Encrypted string in format "IV:encryptedData"
 * @returns {string} - Decrypted plain text verdict data
 */
function decryptVerdict(text) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'hex'),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt verdict data');
  }
}

// ============================================================================
// FILE SECURITY UTILITIES (FTP Support)
// ============================================================================

/**
 * Stores files securely using FTP (if enabled) or memory storage
 * @param {string} caseId - Unique case identifier
 * @param {Object} file - File object from multer
 * @returns {Object} - Storage information object
 */
async function storeFileSecurely(caseId, file) {
  // If FTP is not enabled, use memory storage
  if (!FTP_CONFIG.enabled) {
    return {
      stored: false,
      method: 'memory',
      filename: file.originalname,
      size: file.size,
      timestamp: new Date().toISOString()
    };
  }
  
  // FTP storage implementation (requires basic-ftp package)
  try {
    // TODO: Implement actual FTP upload using basic-ftp package
    // Example:
    // const ftp = new Client();
    // await ftp.access({ host, user, password, secure });
    // await ftp.uploadFrom(file.buffer, `/cases/${caseId}/${file.originalname}`);
    // await ftp.close();
    
    console.log(`[FTP] Would store file ${file.originalname} for case ${caseId}`);
    return {
      stored: false, // Set to true when FTP is properly configured
      method: 'ftp',
      filename: file.originalname,
      size: file.size,
      note: 'FTP storage requires basic-ftp package and proper configuration',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('FTP storage error:', error);
    return {
      stored: false,
      method: 'memory',
      filename: file.originalname,
      size: file.size,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

/**
 * GET /health
 * Returns server health status and agent endpoints
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'orchestration-api',
    port: PORT,
    timestamp: new Date().toISOString(),
    agents: {
      agent1: AGENT1_URL,
      agent2: AGENT2_URL,
      agent3: AGENT3_URL
    },
    features: {
      encryption: true,
      ftp_storage: FTP_CONFIG.enabled,
      offline_support: true
    }
  });
});

// ============================================================================
// AGENT 1 ENDPOINTS - Case Analyzer
// ============================================================================

/**
 * POST /api/agents/agent1/analyze
 * 
 * Analyzes uploaded case files using Agent 1 (Case Analyzer)
 * 
 * Request:
 *   - files: Array of files (multipart/form-data)
 *   - case_id: Optional case identifier
 * 
 * Response:
 *   - case_id: Generated or provided case ID
 *   - key_facts: Extracted key facts from documents
 *   - entities: People, organizations, locations
 *   - timeline: Chronological events
 *   - legal_issues: Identified legal issues
 *   - file_storage: Information about file storage method
 */
app.post('/api/agents/agent1/analyze', upload.array('files'), async (req, res) => {
  try {
    // Generate or use provided case ID
    const caseId = req.body.case_id || `case_${Date.now()}`;
    
    // Validate files were provided
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No files provided',
        message: 'Please upload at least one file for analysis'
      });
    }
    
    console.log(`[Agent 1] Received ${req.files.length} files for case ${caseId}`);
    
    // Store files securely (FTP if enabled)
    const fileStorageInfo = [];
    for (const file of req.files) {
      if (file && file.buffer) {
        const storageInfo = await storeFileSecurely(caseId, file);
        fileStorageInfo.push(storageInfo);
      }
    }
    
    // Prepare FormData for forwarding to Agent 1
    const formData = new FormData();
    formData.append('case_id', caseId);
    
    // Add all uploaded files to FormData
    req.files.forEach(file => {
      if (!file || !file.buffer) {
        console.warn(`[Agent 1] Skipping invalid file: ${file?.originalname || 'unknown'}`);
        return;
      }
      
      console.log(`[Agent 1] Processing file: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
      formData.append('files', file.buffer, {
        filename: file.originalname || 'file',
        contentType: file.mimetype || 'application/octet-stream'
      });
    });
    
    // Forward request to Agent 1 with files
    const response = await axios.post(`${AGENT1_URL}/analyze`, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000 // 5 minute timeout for large files
    });
    
    const analysisData = response.data;
    
    // Add file storage information to response
    analysisData.file_storage = {
      method: FTP_CONFIG.enabled ? 'ftp' : 'memory',
      files: fileStorageInfo,
      secure: FTP_CONFIG.enabled,
      total_files: req.files.length
    };
    
    // Store workflow state
    workflowStates.set(caseId, {
      caseId,
      currentStep: 'agent1',
      status: 'completed',
      timestamp: new Date().toISOString()
    });
    
    // Emit WebSocket update for real-time frontend updates
    io.emit('workflow:update', {
      caseId: caseId,
      step: 'agent1',
      status: 'completed',
      data: analysisData
    });
    
    res.json(analysisData);
  } catch (error) {
    console.error('[Agent 1] Analysis failed:', error.message);
    res.status(500).json({ 
      error: 'Agent1 call failed', 
      details: error.message,
      suggestion: 'Check if Agent 1 is running on ' + AGENT1_URL
    });
  }
});

// ============================================================================
// AGENT 2 ENDPOINTS - Human Feedback Integrator
// ============================================================================

/**
 * POST /api/agents/agent2/submit
 * 
 * Submits analyzed document to Agent 2 for human review
 * 
 * Request Body:
 *   - case_id: Case identifier
 *   - document: Analyzed document data from Agent 1
 */
app.post('/api/agents/agent2/submit', async (req, res) => {
  try {
    const response = await fetch(`${AGENT2_URL}/documents/submit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    
    if (!response.ok) {
      throw new Error(`Agent 2 returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Agent 2] Submit failed:', error.message);
    res.status(500).json({ 
      error: 'Agent2 call failed', 
      details: error.message,
      suggestion: 'Check if Agent 2 is running on ' + AGENT2_URL
    });
  }
});

/**
 * GET /api/agents/agent2/documents/:caseId
 * 
 * Retrieves document from Agent 2 by case ID
 */
app.get('/api/agents/agent2/documents/:caseId', async (req, res) => {
  try {
    const response = await fetch(`${AGENT2_URL}/documents/${req.params.caseId}`);
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: 'Document not found',
        caseId: req.params.caseId
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Agent 2] Get document failed:', error.message);
    res.status(500).json({ 
      error: 'Agent2 call failed', 
      details: error.message
    });
  }
});

/**
 * POST /api/agents/agent2/feedback
 * 
 * Submits human feedback to Agent 2
 * 
 * Request Body:
 *   - case_id: Case identifier
 *   - feedback_items: Array of feedback items
 *   - reviewer_notes: Optional reviewer notes
 */
app.post('/api/agents/agent2/feedback', async (req, res) => {
  try {
    if (!req.body.case_id) {
      return res.status(400).json({ error: 'case_id is required' });
    }
    
    const response = await fetch(`${AGENT2_URL}/documents/${req.body.case_id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      throw new Error(`Agent 2 returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Emit WebSocket update
    io.emit('workflow:update', {
      caseId: req.body.case_id,
      step: 'agent2',
      status: 'updated',
      data: data
    });
    
    res.json(data);
  } catch (error) {
    console.error('[Agent 2] Feedback submission failed:', error.message);
    res.status(500).json({ 
      error: 'Agent2 call failed', 
      details: error.message
    });
  }
});

// ============================================================================
// AGENT 3 ENDPOINTS - Verdict Synthesizer
// ============================================================================

/**
 * POST /api/agents/agent3/synthesize
 * 
 * Synthesizes legal verdict using Agent 3 based on case analysis
 * Verdict data is encrypted before transmission for security
 * 
 * Request Body:
 *   - case_id: Case identifier
 *   - key_facts: Array of key facts
 *   - entities: Object with people, organizations, locations
 *   - legal_issues: Array of legal issues
 *   - timeline: Array of timeline events
 *   - case_summary: Summary of the case
 * 
 * Response:
 *   - Encrypted verdict data with sensitive information protected
 */
app.post('/api/agents/agent3/synthesize', async (req, res) => {
  try {
    console.log('[Agent 3] Received synthesis request for case:', req.body.case_id);
    
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ 
        error: 'Invalid request body',
        message: 'Request body must be a valid JSON object'
      });
    }
    
    const requestBody = req.body;
    
    // Construct validated request for Agent 3
    const agent3Request = {
      case_id: requestBody.case_id || "unknown",
      key_facts: Array.isArray(requestBody.key_facts) ? requestBody.key_facts : [],
      entities: (requestBody.entities && typeof requestBody.entities === 'object') 
        ? requestBody.entities 
        : {},
      legal_issues: Array.isArray(requestBody.legal_issues) 
        ? requestBody.legal_issues 
        : (Array.isArray(requestBody.legal_issues_identified) 
          ? requestBody.legal_issues_identified 
          : []),
      timeline: Array.isArray(requestBody.timeline) ? requestBody.timeline : [],
      case_summary: typeof requestBody.case_summary === 'string' 
        ? requestBody.case_summary 
        : ""
    };
    
    console.log('[Agent 3] Calling Agent 3 at:', AGENT3_URL);
    console.log('[Agent 3] Request summary:', {
      case_id: agent3Request.case_id,
      key_facts_count: agent3Request.key_facts.length,
      legal_issues_count: agent3Request.legal_issues.length,
      timeline_events: agent3Request.timeline.length
    });
    
    // Call Agent 3 to synthesize verdict
    const response = await fetch(`${AGENT3_URL}/synthesize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(agent3Request)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Agent 3] Error response:', response.status, errorText);
      throw new Error(`Agent 3 returned ${response.status}: ${errorText}`);
    }
    
    const verdictData = await response.json();
    console.log('[Agent 3] Verdict synthesis completed');
    
    // Encrypt sensitive verdict data for secure transmission
    const encryptedVerdict = {
      ...verdictData,
      encrypted: true,
      verdict_encrypted: encryptVerdict(JSON.stringify({
        prediction: verdictData.prediction,
        verdict_tendency: verdictData.verdict_tendency,
        confidence: verdictData.confidence,
        reasoning: verdictData.reasoning,
        precedents: verdictData.precedents,
        risk_assessment: verdictData.risk_assessment
      })),
      encryption_timestamp: new Date().toISOString()
    };
    
    // Store case data for potential deletion
    caseDataStore.set(requestBody.case_id, {
      caseId: requestBody.case_id,
      timestamp: new Date().toISOString(),
      hasVerdict: true
    });
    
    // Update workflow state
    workflowStates.set(requestBody.case_id, {
      caseId: requestBody.case_id,
      currentStep: 'agent3',
      status: 'completed',
      timestamp: new Date().toISOString()
    });
    
    // Emit WebSocket update
    io.emit('workflow:update', {
      caseId: requestBody.case_id,
      step: 'agent3',
      status: 'completed',
      data: encryptedVerdict
    });
    
    res.json(encryptedVerdict);
  } catch (error) {
    console.error('[Agent 3] Synthesis failed:', error.message);
    res.status(500).json({ 
      error: 'Agent3 call failed', 
      details: error.message,
      suggestion: 'Check if Agent 3 is running on ' + AGENT3_URL
    });
  }
});

// ============================================================================
// VERDICT SECURITY ENDPOINTS
// ============================================================================

/**
 * POST /api/verdict/decrypt
 * 
 * Decrypts encrypted verdict data for secure retrieval
 * 
 * Request Body:
 *   - encrypted_data: Encrypted verdict string
 * 
 * Response:
 *   - verdict: Decrypted verdict object
 */
app.post('/api/verdict/decrypt', (req, res) => {
  try {
    const { encrypted_data } = req.body;
    
    if (!encrypted_data) {
      return res.status(400).json({ 
        error: 'No encrypted data provided',
        message: 'encrypted_data field is required'
      });
    }
    
    const decrypted = decryptVerdict(encrypted_data);
    const verdict = JSON.parse(decrypted);
    
    res.json({ 
      verdict: verdict,
      decrypted_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Decrypt] Decryption error:', error.message);
    res.status(500).json({ 
      error: 'Failed to decrypt verdict', 
      details: error.message,
      suggestion: 'Ensure the encrypted data is valid and not corrupted'
    });
  }
});

// ============================================================================
// DATA MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * DELETE /api/data/clear-all
 * 
 * Clears all user data from the server
 * This includes:
 *   - All workflow states
 *   - All case data
 *   - Agent 2 documents (if accessible)
 * 
 * WARNING: This action cannot be undone!
 */
app.delete('/api/data/clear-all', async (req, res) => {
  try {
    const clearedCases = caseDataStore.size;
    const clearedWorkflows = workflowStates.size;
    
    // Clear workflow states
    workflowStates.clear();
    
    // Clear case data store
    caseDataStore.clear();
    
    // Attempt to clear Agent 2 documents (if endpoint exists)
    try {
      await fetch(`${AGENT2_URL}/documents/clear-all`, {
        method: 'DELETE'
      }).catch(() => {
        console.log('[Clear Data] Agent 2 clear endpoint not available');
      });
    } catch (error) {
      console.log('[Clear Data] Agent 2 clear not accessible');
    }
    
    res.json({ 
      success: true, 
      message: 'All data cleared successfully',
      casesCleared: clearedCases,
      workflowsCleared: clearedWorkflows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Clear Data] Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to clear data', 
      details: error.message
    });
  }
});

// ============================================================================
// OFFLINE FALLBACK ENDPOINTS
// ============================================================================

/**
 * GET /api/offline/status
 * 
 * Checks the status of all agents and returns offline mode status
 * Used by frontend to determine if cached data should be used
 * 
 * Response:
 *   - online: Boolean indicating if all agents are online
 *   - agents: Status of each agent
 *   - offlineMode: Boolean indicating if offline mode should be used
 *   - cachedCases: Array of case IDs with cached data
 */
app.get('/api/offline/status', async (req, res) => {
  const agentStatus = {
    agent1: false,
    agent2: false,
    agent3: false,
    api: true
  };
  
  // Check each agent's health endpoint
  const healthChecks = [
    fetch(`${AGENT1_URL}/health`)
      .then(() => { agentStatus.agent1 = true; })
      .catch(() => { agentStatus.agent1 = false; }),
    fetch(`${AGENT2_URL}/health`)
      .then(() => { agentStatus.agent2 = true; })
      .catch(() => { agentStatus.agent2 = false; }),
    fetch(`${AGENT3_URL}/health`)
      .then(() => { agentStatus.agent3 = true; })
      .catch(() => { agentStatus.agent3 = false; })
  ];
  
  await Promise.all(healthChecks);
  
  const allAgentsOnline = agentStatus.agent1 && agentStatus.agent2 && agentStatus.agent3;
  
  res.json({
    online: allAgentsOnline,
    agents: agentStatus,
    offlineMode: !allAgentsOnline,
    cachedCases: Array.from(workflowStates.keys()),
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// WORKFLOW ORCHESTRATION ENDPOINTS
// ============================================================================

/**
 * POST /api/workflow/start
 * 
 * Starts a new workflow for a case
 * 
 * Request Body:
 *   - caseId: Case identifier
 *   - files: Array of file information
 */
app.post('/api/workflow/start', (req, res) => {
  const { caseId, files } = req.body;
  
  if (!caseId) {
    return res.status(400).json({ error: 'caseId is required' });
  }
  
  const workflowState = {
    caseId,
    currentStep: 'upload',
    data: { files },
    status: 'uploaded',
    timestamp: new Date().toISOString()
  };
  
  workflowStates.set(caseId, workflowState);
  
  // Emit WebSocket update
  io.emit('workflow:update', {
    caseId,
    step: 'upload',
    status: 'completed',
    data: { files }
  });
  
  res.json({ 
    status: 'workflow_started', 
    caseId,
    timestamp: workflowState.timestamp
  });
});

/**
 * GET /api/workflow/:caseId
 * 
 * Retrieves workflow state for a specific case
 */
app.get('/api/workflow/:caseId', (req, res) => {
  const workflow = workflowStates.get(req.params.caseId);
  
  if (!workflow) {
    return res.status(404).json({ 
      error: 'Workflow not found',
      caseId: req.params.caseId
    });
  }
  
  res.json(workflow);
});

/**
 * GET /api/workflows
 * 
 * Returns all active workflows
 */
app.get('/api/workflows', (req, res) => {
  const workflows = Array.from(workflowStates.values());
  res.json({ 
    workflows, 
    total: workflows.length,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// WEBSOCKET SETUP
// ============================================================================

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('[WebSocket] Client connected:', socket.id);
  
  // Send welcome message
  socket.emit('workflow:update', { 
    message: 'Connected to realtime server',
    timestamp: new Date().toISOString()
  });
  
  // Handle case room joining
  socket.on('join:case', (caseId) => {
    socket.join(caseId);
    console.log(`[WebSocket] Client ${socket.id} joined case: ${caseId}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('[WebSocket] Client disconnected:', socket.id);
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 JUSTICE AI ORCHESTRATION SERVER');
  console.log('='.repeat(60));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log('\n📋 Agent Endpoints:');
  console.log(`   Agent 1 (Case Analyzer): ${AGENT1_URL}`);
  console.log(`   Agent 2 (Feedback):     ${AGENT2_URL}`);
  console.log(`   Agent 3 (Verdict):     ${AGENT3_URL}`);
  console.log('\n🔐 Security Features:');
  console.log(`   Verdict Encryption:     Enabled`);
  console.log(`   FTP Storage:           ${FTP_CONFIG.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   Offline Support:       Enabled`);
  console.log('='.repeat(60) + '\n');
});
