import React from 'react';
import './VerdictViewer.css';

function VerdictViewer({ verdict, onBack }) {
  // Debug logging
  console.log('VerdictViewer received verdict:', verdict);
  
  // Show error state if no data
  if (!verdict || !verdict.prediction) {
    return (
      <div className="verdict-viewer">
        <div className="verdict-header glass-card">
          <div>
            <h1>⚖️ Verdict Synthesis</h1>
            <p className="case-id">No verdict data available</p>
          </div>
          <button onClick={onBack} className="back-button">← Back</button>
        </div>
        <div className="glass-card">
          <div className="error-message">
            <h2>⏳ Waiting for verdict synthesis...</h2>
            <p>Please go back and click "Approve & Synthesize Verdict" again.</p>
            <p style={{fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '16px'}}>
              Received data: {verdict ? JSON.stringify(Object.keys(verdict)) : 'null'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const confidencePercentage = (verdict.confidence * 100).toFixed(1);
  
  return (
    <div className="verdict-viewer">
      <div className="verdict-header glass-card">
        <div>
          <h1>⚖️ Verdict Synthesis Complete</h1>
          <p className="case-id">Case ID: {verdict.case_id}</p>
        </div>
        <button onClick={onBack} className="back-button">← Back</button>
      </div>

      <div className="verdict-main glass-card">
        <div className="prediction-section">
          <h2>🎯 Prediction</h2>
          <div className={`prediction-badge ${verdict.prediction}`}>
            {verdict.verdict_tendency || verdict.prediction}
          </div>
          <div className="confidence-meter">
            <div className="confidence-label">Confidence Score</div>
            <div className="confidence-bar">
              <div 
                className="confidence-fill" 
                style={{ width: `${confidencePercentage}%` }}
              ></div>
            </div>
            <div className="confidence-value">{confidencePercentage}%</div>
          </div>
        </div>

        <div className="recommendation-section">
          <h3>💡 Recommended Action</h3>
          <p>{verdict.recommended_action}</p>
        </div>
      </div>

      <div className="glass-card reasoning-section">
        <h2>📋 Legal Reasoning</h2>
        <div className="reasoning-text">
          {verdict.reasoning?.split('\n').map((line, index) => (
            <p key={index} className={line.trim().startsWith('#') ? 'section-header' : ''}>
              {line.trim().replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '')}
            </p>
          ))}
        </div>
      </div>

      {verdict.precedents && verdict.precedents.length > 0 && (
        <div className="glass-card precedents-section">
          <h2>📚 Similar Legal Precedents</h2>
          <div className="precedents-list">
            {verdict.precedents.map((precedent, index) => (
              <div key={index} className="precedent-card">
                <div className="precedent-header">
                  <h3>{precedent.case_name}</h3>
                  <div className="similarity-score">
                    {(precedent.similarity_score * 100).toFixed(0)}% similar
                  </div>
                </div>
                <div className="precedent-meta">
                  <span>{precedent.jurisdiction}</span>
                  <span>{precedent.year}</span>
                </div>
                <div className={`precedent-outcome ${precedent.outcome.toLowerCase().includes('prevailed') ? 'positive' : precedent.outcome.toLowerCase().includes('liable') ? 'negative' : 'neutral'}`}>
                  <strong>Outcome:</strong> {precedent.outcome}
                </div>
                <p className="precedent-reasoning">{precedent.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {verdict.risk_assessment && (
        <div className="glass-card risk-assessment">
          <h2>⚠️ Risk Assessment</h2>
          <div className="risk-grid">
            <div className="risk-item">
              <div className="risk-label">Overall Risk</div>
              <div className={`risk-value ${verdict.risk_assessment.overall_risk}`}>
                {verdict.risk_assessment.overall_risk}
              </div>
            </div>
            <div className="risk-item">
              <div className="risk-label">Confidence Level</div>
              <div className={`risk-value ${verdict.risk_assessment.confidence_level}`}>
                {verdict.risk_assessment.confidence_level}
              </div>
            </div>
          </div>

          <div className="strengths-weaknesses">
            <div className="sw-section">
              <h4>✅ Strengths</h4>
              <ul>
                {verdict.risk_assessment.strengths?.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>
            <div className="sw-section">
              <h4>⚠️ Weaknesses</h4>
              <ul>
                {verdict.risk_assessment.weaknesses?.map((weakness, index) => (
                  <li key={index}>{weakness}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {verdict.alternatives && verdict.alternatives.length > 0 && (
        <div className="glass-card alternatives-section">
          <h2>🔄 Alternative Outcomes</h2>
          <div className="alternatives-list">
            {verdict.alternatives.map((alt, index) => (
              <div key={index} className="alternative-card">
                <h3>{alt.scenario}</h3>
                <div className="alternative-probability">
                  Probability: {(alt.probability * 100).toFixed(0)}%
                </div>
                <p>{alt.description}</p>
                {alt.recommendation && (
                  <div className="alternative-recommendation">
                    💡 {alt.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="completion-actions glass-card">
        <p>✅ Case analysis complete! All three agents have successfully processed your case.</p>
        <button onClick={() => window.print()} className="btn-secondary">
          🖨️ Print Verdict
        </button>
      </div>
    </div>
  );
}

export default VerdictViewer;


