import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import CaseUpload from './components/CaseUpload';
import AgentDashboard from './components/AgentDashboard';
import DocumentEditor from './components/DocumentEditor';
import VerdictViewer from './components/VerdictViewer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [currentCase, setCurrentCase] = useState(null);
  const [socket, setSocket] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('workflow:update', (data) => {
      console.log('Workflow update:', data);
      setWorkflowStatus(data);
      
      if (data.step === 'agent1' && data.status === 'completed') {
        console.log('Agent 1 completed with data:', data.data);
        // Update agent1Result if data exists, otherwise keep what we have
        if (data.data) {
          setCurrentCase(prev => ({ ...prev, agent1Result: data.data }));
        }
        // Automatically switch to review tab after Agent 1 completes
        setTimeout(() => setActiveTab('review'), 500);
      }
      
      if (data.step === 'agent2' && data.status === 'updated') {
        setCurrentCase(prev => ({ ...prev, agent2Result: data.data }));
      }
      
      if (data.step === 'agent3' && data.status === 'completed') {
        setCurrentCase(prev => ({ ...prev, agent3Result: data.data }));
        setTimeout(() => setActiveTab('verdict'), 500);
      }
    });

    return () => newSocket.close();
  }, []);

  const handleCaseSubmitted = (caseData) => {
    // Store the full response as both the initial data and agent1Result
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
    setActiveTab('dashboard');
  };

  const handleApproveDocument = async () => {
    if (!currentCase?.case_id) {
      console.error('No case_id available');
      return;
    }
    
    console.log('Triggering Agent 3 synthesis for case:', currentCase.case_id);
    
    // Trigger Agent 3 synthesis
    try {
      // Get data from agent1Result if available, otherwise from currentCase
      const agent1Data = currentCase.agent1Result || currentCase;
      
      const requestBody = {
        case_id: currentCase.case_id,
        key_facts: agent1Data.key_facts || [],
        entities: agent1Data.entities || {},
        legal_issues: agent1Data.legal_issues_identified || agent1Data.legal_issues || [],
        timeline: agent1Data.timeline || [],
        case_summary: agent1Data.case_summary || ""
      };
      
      console.log('Sending to Agent 3:', requestBody);
      
      const response = await fetch(`${API_URL}/api/agents/agent3/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`Agent 3 error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Agent 3 result:', result);
      
      setCurrentCase(prev => ({ ...prev, agent3Result: result }));
      setActiveTab('verdict');
    } catch (error) {
      console.error('Error synthesizing verdict:', error);
      alert('Failed to synthesize verdict. Check console for details.');
      // Don't switch to verdict tab if there's an error
      setActiveTab('review');
    }
  };

  return (
    <div className="app">
      <nav className="nav-glass">
        <div className="nav-content">
          <div className="logo">
            <h1>⚖️ Justice AI</h1>
            <span className="tagline">Multi-Agent Legal Analysis System</span>
          </div>
          <div className="nav-tabs">
            <button 
              className={activeTab === 'upload' ? 'active' : ''} 
              onClick={() => setActiveTab('upload')}
            >
              📤 Upload Case
            </button>
            <button 
              className={activeTab === 'dashboard' ? 'active' : ''} 
              onClick={() => setActiveTab('dashboard')}
              disabled={!currentCase}
            >
              🤖 Agent Dashboard
            </button>
            <button 
              className={activeTab === 'review' ? 'active' : ''} 
              onClick={() => setActiveTab('review')}
              disabled={!currentCase?.agent1Result}
            >
              📝 Document Review
            </button>
            <button 
              className={activeTab === 'verdict' ? 'active' : ''} 
              onClick={() => setActiveTab('verdict')}
              disabled={!currentCase?.agent3Result}
            >
              🎯 Verdict
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'upload' && (
          <CaseUpload 
            apiUrl={API_URL}
            onCaseSubmitted={handleCaseSubmitted}
          />
        )}
        
        {activeTab === 'dashboard' && currentCase && (
          <AgentDashboard 
            currentCase={currentCase}
            apiUrl={API_URL}
            workflowStatus={workflowStatus}
          />
        )}
        
        {activeTab === 'review' && currentCase?.agent1Result && (
          <DocumentEditor 
            caseData={currentCase.agent1Result}
            caseId={currentCase.case_id}
            apiUrl={API_URL}
            onApprove={handleApproveDocument}
            onBack={() => setActiveTab('dashboard')}
          />
        )}
        
        {activeTab === 'verdict' && currentCase?.agent3Result && (
          <VerdictViewer 
            verdict={currentCase.agent3Result}
            onBack={() => setActiveTab('review')}
          />
        )}
      </main>

      {workflowStatus && (
        <div className="workflow-notification">
          <span>📡 Agent {workflowStatus.step}: {workflowStatus.status}</span>
        </div>
      )}
    </div>
  );
}

export default App;


