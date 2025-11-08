import React, { useState, useEffect } from 'react';
import './VerdictViewer.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function VerdictViewer({ verdict, onBack }) {
  const [decryptedVerdict, setDecryptedVerdict] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  
  // Debug logging
  console.log('VerdictViewer received verdict:', verdict);
  
  // Decrypt verdict if encrypted
  useEffect(() => {
    if (verdict && verdict.encrypted && verdict.verdict_encrypted) {
      setDecrypting(true);
      fetch(`${API_URL}/api/verdict/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted_data: verdict.verdict_encrypted })
      })
      .then(res => res.json())
      .then(data => {
        setDecryptedVerdict({ ...verdict, ...data.verdict });
        setDecrypting(false);
      })
      .catch(err => {
        console.error('Decryption error:', err);
        setDecryptedVerdict(verdict); // Fallback to encrypted version
        setDecrypting(false);
      });
    } else {
      setDecryptedVerdict(verdict);
    }
  }, [verdict]);
  
  const displayVerdict = decryptedVerdict || verdict;
  
  // Show error state if no data
  if (!displayVerdict || (!displayVerdict.prediction && !decrypting)) {
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
            {decrypting ? (
              <>
                <h2>🔒 Decrypting verdict...</h2>
                <p>Securing your verdict data...</p>
              </>
            ) : (
              <>
                <h2>⏳ Waiting for verdict synthesis...</h2>
                <p>Please go back and click "Approve & Synthesize Verdict" again.</p>
                <p style={{fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginTop: '16px'}}>
                  Received data: {verdict ? JSON.stringify(Object.keys(verdict)) : 'null'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  const confidencePercentage = (displayVerdict.confidence * 100).toFixed(1);
  
  return (
    <div className="verdict-viewer">
      <div className="verdict-header glass-card">
        <div>
          <h1>⚖️ Verdict Synthesis Complete {displayVerdict.encrypted && '🔒'}</h1>
          <p className="case-id">Case ID: {displayVerdict.case_id}</p>
          {displayVerdict.encrypted && (
            <p style={{fontSize: '12px', color: '#4ade80', marginTop: '4px'}}>
              🔒 Verdict data is encrypted and secure
            </p>
          )}
        </div>
        <button onClick={onBack} className="back-button">← Back</button>
      </div>

      <div className="verdict-main glass-card">
        <div className="prediction-section">
          <h2>🎯 Prediction</h2>
          <div className={`prediction-badge ${displayVerdict.prediction}`}>
            {displayVerdict.verdict_tendency || displayVerdict.prediction}
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
          <p>{displayVerdict.recommended_action}</p>
        </div>
      </div>

      <div className="glass-card reasoning-section">
        <h2>📋 Legal Reasoning</h2>
        <div className="reasoning-text">
          {displayVerdict.reasoning?.split('\n').map((line, index) => (
            <p key={index} className={line.trim().startsWith('#') ? 'section-header' : ''}>
              {line.trim().replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '')}
            </p>
          ))}
        </div>
      </div>

      {displayVerdict.precedents && displayVerdict.precedents.length > 0 && (
        <div className="glass-card precedents-section">
          <h2>📚 Similar Legal Precedents</h2>
          <div className="precedents-list">
            {displayVerdict.precedents.map((precedent, index) => (
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

      {displayVerdict.risk_assessment && (
        <div className="glass-card risk-assessment">
          <h2>⚠️ Risk Assessment</h2>
          <div className="risk-grid">
            <div className="risk-item">
              <div className="risk-label">Overall Risk</div>
              <div className={`risk-value ${displayVerdict.risk_assessment.overall_risk}`}>
                {displayVerdict.risk_assessment.overall_risk}
              </div>
            </div>
            <div className="risk-item">
              <div className="risk-label">Confidence Level</div>
              <div className={`risk-value ${displayVerdict.risk_assessment.confidence_level}`}>
                {displayVerdict.risk_assessment.confidence_level}
              </div>
            </div>
          </div>

          <div className="strengths-weaknesses">
            <div className="sw-section">
              <h4>✅ Strengths</h4>
              <ul>
                {displayVerdict.risk_assessment.strengths?.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            </div>
            <div className="sw-section">
              <h4>⚠️ Weaknesses</h4>
              <ul>
                {displayVerdict.risk_assessment.weaknesses?.map((weakness, index) => (
                  <li key={index}>{weakness}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {displayVerdict.alternatives && displayVerdict.alternatives.length > 0 && (
        <div className="glass-card alternatives-section">
          <h2>🔄 Alternative Outcomes</h2>
          <div className="alternatives-list">
            {displayVerdict.alternatives.map((alt, index) => (
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


