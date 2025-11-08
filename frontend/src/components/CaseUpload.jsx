import React, { useState } from 'react';
import './CaseUpload.css';

function CaseUpload({ apiUrl, onCaseSubmitted }) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [caseId, setCaseId] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    
    try {
      // Generate a unique case ID
      const generatedCaseId = `case_${Date.now()}`;

      // Create FormData to send actual file contents
      const formData = new FormData();
      formData.append('case_id', generatedCaseId);
      
      // Add all files to FormData
      files.forEach(file => {
        formData.append('files', file);
      });

      console.log(`Uploading ${files.length} files to Agent 1 for real-time processing...`);

      // Submit actual files to Agent 1 for real processing
      const response = await fetch(`${apiUrl}/api/agents/agent1/analyze`, {
        method: 'POST',
        body: formData
        // Don't set Content-Type header - browser will set it with boundary for multipart
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Agent 1 analysis result:', result);
      
      // Use the case_id from result or fall back to generated one
      const caseId = result.case_id || generatedCaseId;

      // Submit to Agent 2 for review
      await fetch(`${apiUrl}/api/agents/agent2/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          document: result
        })
      });

      setCaseId(caseId);
      onCaseSubmitted({ case_id: caseId, file_count: files.length, ...result });
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload case: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="case-upload-container">
      <div className="glass-card upload-area">
        <h2>📤 Upload Case Evidence</h2>
        <p className="subtitle">Drag and drop files or click to browse</p>

        <div
          className={`drop-zone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="drop-zone-content">
            <div className="upload-icon">📁</div>
            <p>Drag files here or click to select</p>
            <input
              type="file"
              id="file-input"
              multiple
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="upload-button">
              Browse Files
            </label>
          </div>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            <h3>Selected Files ({files.length})</h3>
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <span className="file-icon">📎</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                <button onClick={() => removeFile(index)} className="remove-btn">×</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={files.length === 0 || uploading}
          className="submit-button"
        >
          {uploading ? '⏳ Processing...' : '🚀 Submit Case'}
        </button>
      </div>

      <div className="info-card glass">
        <h3>📋 Supported File Types</h3>
        <ul>
          <li><strong>Documents:</strong> PDF, DOC, DOCX</li>
          <li><strong>Images:</strong> JPG, PNG, GIF, WEBP</li>
          <li><strong>Audio:</strong> MP3, WAV, OGG, M4A</li>
          <li><strong>Video:</strong> MP4, AVI, MOV, MKV</li>
        </ul>
      </div>
    </div>
  );
}

export default CaseUpload;


