import React from 'react';
import './AgentDashboard.css';

function AgentDashboard({ currentCase, apiUrl, workflowStatus }) {
  const getStatusFor = (agentKey) => {
    if (workflowStatus?.step === agentKey) {
      return workflowStatus.status || 'processing';
    }
    if (agentKey === 'agent1') {
      return currentCase?.agent1Result ? 'completed' : 'processing';
    }
    if (agentKey === 'agent2') {
      return currentCase?.agent2Result ? 'completed' : (currentCase?.agent1Result ? 'processing' : 'pending');
    }
    if (agentKey === 'agent3') {
      return currentCase?.agent3Result ? 'completed' : 'pending';
    }
    return 'pending';
  };

  const statusBadgeClass = (status) => {
    if (status === 'completed') return 'status-badge status-completed';
    if (status === 'processing') return 'status-badge status-processing';
    return 'status-badge status-pending';
  };

  const progressPercent = (status) => {
    if (status === 'completed') return 100;
    if (status === 'processing') return 60;
    return 0;
  };

  const agent1Status = getStatusFor('agent1');
  const agent2Status = getStatusFor('agent2');
  const agent3Status = getStatusFor('agent3');

  return (
    <div className="agent-dashboard">
      <div className="dashboard-header">
        <h2>🤖 Agent Workflow</h2>
        <div className="case-info">{currentCase?.case_id ? `Case ID: ${currentCase.case_id}` : 'No case loaded yet'}</div>
      </div>

      <div className="agents-container">
        <div className="agent-card" data-status={agent1Status}>
          <div className="agent-header">
            <div className="agent-title-section">
              <div className="icon">🧠</div>
              <div>
                <h3>Agent 1 — Case Analyzer</h3>
                <p className="agent-description">Extracts key facts, entities, issues, and timeline</p>
              </div>
            </div>
            <div className={statusBadgeClass(agent1Status)}>{agent1Status}</div>
          </div>
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent(agent1Status)}%` }}></div>
            </div>
            <div className="progress-text">{progressPercent(agent1Status)}%</div>
          </div>
          {currentCase?.agent1Result ? (
            <div className="agent-result">
              <strong>Summary</strong>
              <ul>
                <li>Key facts: {currentCase.agent1Result.key_facts?.length || 0}</li>
                <li>Entities: {Object.keys(currentCase.agent1Result.entities || {}).length}</li>
                <li>Issues: {currentCase.agent1Result.legal_issues_identified?.length || 0}</li>
              </ul>
            </div>
          ) : (
            <div className="waiting-message">⏳ Waiting for analysis results from Agent 1...</div>
          )}
        </div>

        <div className="agent-card" data-status={agent2Status}>
          <div className="agent-header">
            <div className="agent-title-section">
              <div className="icon">✍️</div>
              <div>
                <h3>Agent 2 — Human Feedback Integrator</h3>
                <p className="agent-description">Review, edit, and confirm the generated document</p>
              </div>
            </div>
            <div className={statusBadgeClass(agent2Status)}>{agent2Status}</div>
          </div>
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent(agent2Status)}%` }}></div>
            </div>
            <div className="progress-text">{progressPercent(agent2Status)}%</div>
          </div>
          {currentCase?.agent2Result ? (
            <div className="agent-result">
              <strong>Latest Update</strong>
              <ul>
                <li>Document status: updated</li>
              </ul>
            </div>
          ) : (
            <div className="waiting-message">🕒 Awaiting review/approval in the Document Review tab...</div>
          )}
        </div>

        <div className="agent-card" data-status={agent3Status}>
          <div className="agent-header">
            <div className="agent-title-section">
              <div className="icon">⚖️</div>
              <div>
                <h3>Agent 3 — Verdict Synthesizer</h3>
                <p className="agent-description">Generates judgment prediction and legal reasoning</p>
              </div>
            </div>
            <div className={statusBadgeClass(agent3Status)}>{agent3Status}</div>
          </div>
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPercent(agent3Status)}%` }}></div>
            </div>
            <div className="progress-text">{progressPercent(agent3Status)}%</div>
          </div>
          {currentCase?.agent3Result ? (
            <div className="agent-result">
              <strong>Prediction Ready</strong>
              <ul>
                <li>Outcome: {currentCase.agent3Result.verdict_tendency || currentCase.agent3Result.prediction}</li>
                <li>Confidence: {Math.round((currentCase.agent3Result.confidence || 0) * 100)}%</li>
              </ul>
            </div>
          ) : (
            <div className="waiting-message">🧩 Will start after approval in Document Review...</div>
          )}
        </div>
      </div>

      <div className="workflow-info">
        <h4>Workflow</h4>
        <div className="workflow-steps">
          <div className={`workflow-step ${agent1Status === 'completed' ? 'completed' : agent1Status === 'processing' ? 'processing' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-info">
              <strong>Analyze</strong>
              <span>Agent 1</span>
            </div>
          </div>
          <div className={`workflow-connector ${agent1Status === 'completed' ? 'active' : ''}`}></div>
          <div className={`workflow-step ${agent2Status === 'completed' ? 'completed' : agent2Status === 'processing' ? 'processing' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-info">
              <strong>Review</strong>
              <span>Agent 2</span>
            </div>
          </div>
          <div className={`workflow-connector ${(agent1Status === 'completed' && agent2Status !== 'pending') ? 'active' : ''}`}></div>
          <div className={`workflow-step ${agent3Status === 'completed' ? 'completed' : agent3Status === 'processing' ? 'processing' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-info">
              <strong>Synthesize</strong>
              <span>Agent 3</span>
            </div>
          </div>
        </div>
        <div className="connection-line"><div className="flow-arrow"></div></div>
      </div>
    </div>
  );
}

export default AgentDashboard;




