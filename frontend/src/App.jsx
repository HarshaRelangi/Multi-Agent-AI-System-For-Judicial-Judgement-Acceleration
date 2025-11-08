/**
 * ============================================================================
 * JUSTICE AI - MAIN APPLICATION COMPONENT
 * ============================================================================
 * 
 * This is the main React component that orchestrates the entire application.
 * 
 * Features:
 * - Multi-tab navigation (Upload, Dashboard, Review, Verdict)
 * - Real-time WebSocket updates
 * - Offline mode with localStorage caching
 * - Secure verdict decryption
 * - Data management (clear all data)
 * 
 * Component Structure:
 * - CaseUpload: File upload and case submission
 * - AgentDashboard: Overview of all agent results
 * - DocumentEditor: Review and edit analyzed documents
 * - VerdictViewer: Display synthesized verdict
 * 
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// Component imports
import CaseUpload from './components/CaseUpload';
import AgentDashboard from './components/AgentDashboard';
import DocumentEditor from './components/DocumentEditor';
import VerdictViewer from './components/VerdictViewer';
import AnalysisTracker from './components/AnalysisTracker';

// ============================================================================
// CONFIGURATION
// ============================================================================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const OFFLINE_CHECK_INTERVAL = 30000; // Check offline status every 30 seconds
const WEBSOCKET_RECONNECTION_DELAY = 1000; // 1 second delay between reconnection attempts
const WEBSOCKET_MAX_RECONNECTION_ATTEMPTS = 5;

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

function App() {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('upload');
  
  // Case data state
  const [currentCase, setCurrentCase] = useState(null);
  
  // WebSocket and workflow state
  const [socket, setSocket] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState(null);

  // Offline mode state
  const [isOffline, setIsOffline] = useState(false);
  
  // Data management state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ========================================================================
  // EFFECTS AND LIFECYCLE
  // ========================================================================

  /**
   * Main effect: Initialize WebSocket connection and offline monitoring
   * - Checks offline status periodically
   * - Loads cached data from localStorage if offline
   * - Establishes WebSocket connection with reconnection logic
   * - Handles workflow updates from agents
   */
  useEffect(() => {
    /**
     * Check if agents are online and update offline status
     * Loads cached data from localStorage if offline
     */
    const checkOfflineStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/api/offline/status`);
        const data = await response.json();
        setIsOffline(data.offlineMode);
        
        // Load cached case data if offline
        if (data.offlineMode) {
          const cachedCase = localStorage.getItem('currentCase');
          if (cachedCase) {
            try {
              setCurrentCase(JSON.parse(cachedCase));
              console.log('[Offline] Loaded cached case data');
            } catch (error) {
              console.error('[Offline] Failed to parse cached data:', error);
            }
          }
        }
      } catch (error) {
        // If API is unreachable, assume offline
        setIsOffline(true);
        console.warn('[Offline] API unreachable, using cached data');
        
        // Load from localStorage on error
        const cachedCase = localStorage.getItem('currentCase');
        if (cachedCase) {
          try {
            setCurrentCase(JSON.parse(cachedCase));
          } catch (parseError) {
            console.error('[Offline] Failed to parse cached data:', parseError);
          }
        }
      }
    };
    
    // Initial offline status check
    checkOfflineStatus();
    
    // Set up periodic offline status checks
    const offlineCheckInterval = setInterval(
      checkOfflineStatus, 
      OFFLINE_CHECK_INTERVAL
    );
    
    // ========================================================================
    // WEBSOCKET CONNECTION SETUP
    // ========================================================================
    
    /**
     * Initialize WebSocket connection with reconnection logic
     */
    const newSocket = io(API_URL, {
      reconnection: true,
      reconnectionDelay: WEBSOCKET_RECONNECTION_DELAY,
      reconnectionAttempts: WEBSOCKET_MAX_RECONNECTION_ATTEMPTS,
      timeout: 20000
    });
    
    setSocket(newSocket);

    // ========================================================================
    // WEBSOCKET EVENT HANDLERS
    // ========================================================================
    
    /**
     * Handle workflow updates from agents
     * Updates case data and caches to localStorage for offline support
     */
    newSocket.on('workflow:update', (data) => {
      console.log('[WebSocket] Workflow update received:', data);
      setWorkflowStatus(data);
      
      // Agent 1 completed: Case analysis finished
      if (data.step === 'agent1' && data.status === 'completed') {
        console.log('[WebSocket] Agent 1 completed analysis');
        if (data.data) {
          setCurrentCase(prev => {
            const updated = { 
              ...prev, 
              agent1Result: data.data 
            };
            // Cache to localStorage for offline fallback
            localStorage.setItem('currentCase', JSON.stringify(updated));
            return updated;
          });
        }
        // Automatically switch to review tab after analysis
        setTimeout(() => setActiveTab('review'), 500);
      }
      
      // Agent 2 updated: Document feedback received
      if (data.step === 'agent2' && data.status === 'updated') {
        console.log('[WebSocket] Agent 2 updated with feedback');
        setCurrentCase(prev => {
          const updated = { 
            ...prev, 
            agent2Result: data.data 
          };
          localStorage.setItem('currentCase', JSON.stringify(updated));
          return updated;
        });
      }
      
      // Agent 3 completed: Verdict synthesized
      if (data.step === 'agent3' && data.status === 'completed') {
        console.log('[WebSocket] Agent 3 completed verdict synthesis');
        setCurrentCase(prev => {
          const updated = { 
            ...prev, 
            agent3Result: data.data 
          };
          localStorage.setItem('currentCase', JSON.stringify(updated));
          return updated;
        });
        // Automatically switch to verdict tab
        setTimeout(() => setActiveTab('verdict'), 500);
      }
    });

    /**
     * Handle WebSocket connection events
     */
    newSocket.on('connect', () => {
      console.log('[WebSocket] Connected to server');
      setIsOffline(false);
    });
    
    newSocket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected from server');
    });
    
    newSocket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      setIsOffline(true);
    });
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    
    return () => {
      clearInterval(offlineCheckInterval);
      if (newSocket) {
        newSocket.close();
        console.log('[WebSocket] Connection closed');
      }
    };
  }, []); // Empty dependency array - run once on mount

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle case submission from CaseUpload component
   * Stores case data and caches to localStorage
   * 
   * @param {Object} caseData - Case data from Agent 1 analysis
   */
  const handleCaseSubmitted = (caseData) => {
    // Structure case data with agent results
    const caseWithAgent1Result = {
      ...caseData,
      agent1Result: {
        case_summary: caseData.case_summary,
        key_facts: caseData.key_facts,
        entities: caseData.entities,
        timeline: caseData.timeline,
        legal_issues_identified: caseData.legal_issues_identified,
        evidence_analysis: caseData.evidence_analysis,
        analysis_timestamp: caseData.analysis_timestamp
      }
    };
    
    setCurrentCase(caseWithAgent1Result);
    
    // Cache to localStorage for offline fallback
    localStorage.setItem('currentCase', JSON.stringify(caseWithAgent1Result));
    
    // Navigate to dashboard
    setActiveTab('dashboard');
  };

  /**
   * Handle clear all data action
   * Two-step confirmation: first click shows confirmation, second click executes
   * Clears both server and client-side data
   */
  const handleClearAllData = async () => {
    // First click: Show confirmation
    if (!showClearConfirm) {
      setShowClearConfirm(true);
      return;
    }
    
    // Second click: Execute deletion
    try {
      const response = await fetch(`${API_URL}/api/data/clear-all`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Clear local state
        setCurrentCase(null);
        setWorkflowStatus(null);
        
        // Clear localStorage
        localStorage.removeItem('currentCase');
        localStorage.clear();
        
        // Reset UI
        setActiveTab('upload');
        setShowClearConfirm(false);
        
        alert('✅ All data cleared successfully!');
      } else {
        throw new Error('Failed to clear data on server');
      }
    } catch (error) {
      console.error('[Clear Data] Error:', error);
      
      // Clear local data even if API fails
      setCurrentCase(null);
      setWorkflowStatus(null);
      localStorage.clear();
      setActiveTab('upload');
      setShowClearConfirm(false);
      
      alert('⚠️ Local data cleared. Server data may still exist if server is unreachable.');
    }
  };

  /**
   * Handle document approval and trigger Agent 3 verdict synthesis
   * Prepares case data and sends to Agent 3 for verdict generation
   */
  const handleApproveDocument = async () => {
    if (!currentCase?.case_id) {
      console.error('[Approve] No case_id available');
      alert('Error: No case ID found. Please upload a case first.');
      return;
    }
    
    console.log('[Approve] Triggering Agent 3 synthesis for case:', currentCase.case_id);
    
    try {
      // Get data from agent1Result if available, otherwise from currentCase
      const agent1Data = currentCase.agent1Result || currentCase;
      
      // Prepare request body for Agent 3
      const requestBody = {
        case_id: currentCase.case_id,
        key_facts: agent1Data.key_facts || [],
        entities: agent1Data.entities || {},
        legal_issues: agent1Data.legal_issues_identified || agent1Data.legal_issues || [],
        timeline: agent1Data.timeline || [],
        case_summary: agent1Data.case_summary || ""
      };
      
      console.log('[Approve] Sending to Agent 3:', {
        case_id: requestBody.case_id,
        key_facts_count: requestBody.key_facts.length,
        legal_issues_count: requestBody.legal_issues.length
      });
      
      // Call Agent 3 synthesis endpoint
      const response = await fetch(`${API_URL}/api/agents/agent3/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent 3 error: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('[Approve] Agent 3 synthesis completed');
      
      // Update case with verdict result
      setCurrentCase(prev => {
        const updated = { ...prev, agent3Result: result };
        localStorage.setItem('currentCase', JSON.stringify(updated));
        return updated;
      });
      
      // Navigate to verdict tab
      setActiveTab('verdict');
    } catch (error) {
      console.error('[Approve] Error synthesizing verdict:', error);
      alert(`❌ Failed to synthesize verdict: ${error.message}\n\nPlease check if Agent 3 is running.`);
      // Stay on review tab if there's an error
      setActiveTab('review');
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="app">
      {/* ==================================================================== */}
      {/* NAVIGATION BAR */}
      {/* ==================================================================== */}
      <nav className="nav-glass">
        <div className="nav-content">
          {/* Logo and Title */}
          <div className="logo">
            <h1>⚖️ Justice AI</h1>
            <span className="tagline">Multi-Agent Legal Analysis System</span>
          </div>
          
          {/* Navigation Tabs */}
          <div className="nav-tabs">
            <button 
              className={activeTab === 'upload' ? 'active' : ''} 
              onClick={() => setActiveTab('upload')}
              title="Upload case files for analysis"
            >
              📤 Upload Case
            </button>
            
            <button 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={() => setActiveTab('dashboard')}
              disabled={!currentCase}
              title="View agent analysis results"
            >
              🤖 Agent Dashboard
            </button>
            
            <button 
              className={activeTab === 'review' ? 'active' : ''} 
              onClick={() => setActiveTab('review')}
              disabled={!currentCase?.agent1Result}
              title="Review and edit analyzed documents"
            >
              📝 Document Review
            </button>
            
            <button 
              className={activeTab === 'verdict' ? 'active' : ''} 
              onClick={() => setActiveTab('verdict')}
              disabled={!currentCase?.agent3Result}
              title="View synthesized verdict"
            >
              🎯 Verdict
            </button>
            
            <button 
              className={activeTab === 'analysis' ? 'active' : ''} 
              onClick={() => setActiveTab('analysis')}
              title="View analytics and validation metrics"
            >
              📊 Analysis
            </button>
            
            {/* Clear All Data Button */}
            <button 
              className="clear-data-btn"
              onClick={handleClearAllData}
              style={{
                marginLeft: 'auto',
                backgroundColor: showClearConfirm ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                color: '#fff',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                cursor: 'pointer'
              }}
              title="Clear all data from server and local storage"
            >
              {showClearConfirm ? '⚠️ Confirm Clear All' : '🗑️ Clear All Data'}
            </button>
          </div>
          
          {/* Offline Mode Banner */}
          {isOffline && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fff',
              padding: '8px',
              textAlign: 'center',
              fontSize: '12px',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              zIndex: 1000
            }}>
              ⚠️ Offline Mode: Using cached data
            </div>
          )}
        </div>
      </nav>

      {/* ==================================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ==================================================================== */}
      <main className="main-content">
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <CaseUpload 
            apiUrl={API_URL}
            onCaseSubmitted={handleCaseSubmitted}
          />
        )}
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && currentCase && (
          <AgentDashboard 
            currentCase={currentCase}
            apiUrl={API_URL}
            workflowStatus={workflowStatus}
          />
        )}
        
        {/* Review Tab */}
        {activeTab === 'review' && currentCase?.agent1Result && (
          <DocumentEditor 
            caseData={currentCase.agent1Result}
            caseId={currentCase.case_id}
            apiUrl={API_URL}
            onApprove={handleApproveDocument}
            onBack={() => setActiveTab('dashboard')}
          />
        )}
        
        {/* Verdict Tab */}
        {activeTab === 'verdict' && currentCase?.agent3Result && (
          <VerdictViewer 
            verdict={currentCase.agent3Result}
            onBack={() => setActiveTab('review')}
          />
        )}
        
        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <AnalysisTracker 
            apiUrl={API_URL}
          />
        )}
      </main>

      {/* ==================================================================== */}
      {/* WORKFLOW STATUS NOTIFICATION */}
      {/* ==================================================================== */}
      {workflowStatus && (
        <div className="workflow-notification">
          <span>
            📡 Agent {workflowStatus.step}: {workflowStatus.status}
          </span>
        </div>
      )}
    </div>
  );
}

export default App;
