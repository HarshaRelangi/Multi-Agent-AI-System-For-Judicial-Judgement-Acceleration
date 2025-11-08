import React, { useState } from 'react';
import './DocumentEditor.css';

function DocumentEditor({ caseData, caseId, apiUrl, onApprove, onBack }) {
  const [feedback, setFeedback] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('pending');
  
  // Debug logging
  console.log('DocumentEditor received caseData:', caseData);
  console.log('DocumentEditor received caseId:', caseId);

  // Show loading/empty state if no data
  if (!caseData || Object.keys(caseData).length === 0) {
    return (
      <div className="document-editor">
        <div className="editor-header glass-card">
          <div>
            <h1>📝 Document Review - Agent 2</h1>
            <p className="case-id">Case ID: {caseId || 'Unknown'}</p>
          </div>
          <button onClick={onBack} className="back-button">← Back</button>
        </div>
        <div className="editor-content">
          <div className="document-view glass-card">
            <div className="error-message">
              <h2>⏳ Waiting for Agent 1 analysis...</h2>
              <p>Please go back to the Dashboard and wait for Agent 1 to complete.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleApprove = () => {
    onApprove();
  };

  const handleRequestChanges = async () => {
    setApprovalStatus('needs_revision');
    try {
      const requestBody = {
        case_id: caseId,
        approval_status: 'needs_revision',
        reviewer_notes: feedback || 'User requested changes',
        timestamp: new Date().toISOString(),
        feedback_items: [
          {
            section: 'general',
            feedback_type: 'edit',
            content: feedback || 'Please revise the generated document.',
            action: 'user_feedback'
          }
        ]
      };

      const response = await fetch(`${apiUrl}/api/agents/agent2/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Agent 2 feedback failed: ${response.status} ${text}`);
      }

      alert('Feedback sent to Agent 2. You can continue editing or approve when ready.');
    } catch (err) {
      console.error('Error sending feedback to Agent 2:', err);
      alert('Failed to send feedback. Check console for details.');
    }
  };

  return (
    <div className="document-editor">
      <div className="editor-header glass-card">
        <div>
          <h1>📝 Document Review - Agent 2</h1>
          <p className="case-id">Case ID: {caseId}</p>
        </div>
        <button onClick={onBack} className="back-button">← Back</button>
      </div>

      <div className="editor-content">
        <div className="document-view glass-card">
          <h2>Case Summary</h2>
          <div className="document-section">
            <p className="summary-text">{caseData.case_summary}</p>
          </div>
        </div>

        <div className="document-view glass-card">
          <h2>Key Facts</h2>
          <div className="facts-list">
            {caseData.key_facts?.map((fact, index) => (
              <div key={index} className="fact-item">
                <span className="fact-number">{index + 1}</span>
                <p>{fact}</p>
              </div>
            ))}
          </div>
        </div>

        {caseData.timeline && (
          <div className="document-view glass-card">
            <h2>Timeline of Events</h2>
            <div className="timeline">
              {caseData.timeline.map((event, index) => (
                <div key={index} className="timeline-item">
                  <div className="timeline-date">{event.date} {event.time || ''}</div>
                  <div className="timeline-content">
                    <h4>{event.event}</h4>
                    <span className={`importance ${event.importance}`}>
                      {event.importance}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="document-view glass-card">
          <h2>Entities Identified</h2>
          <div className="entities-grid">
            <div className="entity-group">
              <h3>People</h3>
              {caseData.entities?.people?.map((person, index) => (
                <div key={index} className="entity-item">
                  <strong>{person.name}</strong> - {person.role}
                </div>
              ))}
            </div>
            <div className="entity-group">
              <h3>Organizations</h3>
              {caseData.entities?.organizations?.map((org, index) => (
                <div key={index} className="entity-item">
                  <strong>{org.name}</strong> - {org.type}
                </div>
              ))}
            </div>
            <div className="entity-group">
              <h3>Locations</h3>
              {caseData.entities?.locations?.map((loc, index) => (
                <div key={index} className="entity-item">
                  <strong>{loc.name}</strong> - {loc.type}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="document-view glass-card">
          <h2>Legal Issues</h2>
          <div className="issues-list">
            {caseData.legal_issues_identified?.map((issue, index) => (
              <div key={index} className={`issue-item ${issue.severity}`}>
                <div className="issue-header">
                  <h3>{issue.issue}</h3>
                  <span className={`severity-badge ${issue.severity}`}>
                    {issue.severity}
                  </span>
                </div>
                <p>{issue.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="editor-actions glass-card">
          <div className="feedback-section">
            <h3>Add Feedback (Optional)</h3>
            <textarea
              className="feedback-input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add any additional notes or corrections here..."
              rows="4"
            />
          </div>

          <div className="action-buttons">
            <button onClick={handleRequestChanges} className="btn-secondary">
              ✏️ Request Changes
            </button>
            <button onClick={handleApprove} className="btn-primary">
              ✓ Approve & Synthesize Verdict
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentEditor;


