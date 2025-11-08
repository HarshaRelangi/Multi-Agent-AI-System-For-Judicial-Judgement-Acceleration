/**
 * ============================================================================
 * JUSTICE AI - ANALYSIS TRACKER COMPONENT
 * ============================================================================
 * 
 * This component displays validation metrics and justifications for the
 * project's key claims:
 * 
 * - Time Reduction (avg case processing time)
 * - Extraction Accuracy (entity/fact extraction precision/recall)
 * - Precedent Retrieval Speedup (latency comparison vs baseline)
 * - Encryption Success (encryption/decryption round-trip success rate)
 * 
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import './AnalysisTracker.css';

function AnalysisTracker({ apiUrl }) {
  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================
  
  const [summary, setSummary] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkStatus, setBenchmarkStatus] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    minAccuracy: '',
    encryptionOnly: false
  });

  // ========================================================================
  // EFFECTS
  // ========================================================================

  useEffect(() => {
    loadData();
  }, [filters]);

  /**
   * Load analytics summary and cases data
   */
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load summary
      const summaryResponse = await fetch(`${apiUrl}/api/analytics/summary`);
      const summaryData = await summaryResponse.json();
      setSummary(summaryData);
      
      // Build query string for cases
      const queryParams = new URLSearchParams();
      queryParams.append('limit', '50');
      if (filters.from) queryParams.append('from', filters.from);
      if (filters.to) queryParams.append('to', filters.to);
      if (filters.minAccuracy) queryParams.append('min_accuracy', filters.minAccuracy);
      if (filters.encryptionOnly) queryParams.append('encryption_only', 'true');
      
      // Load cases
      const casesResponse = await fetch(`${apiUrl}/api/analytics/cases?${queryParams.toString()}`);
      const casesData = await casesResponse.json();
      setCases(casesData);
      
    } catch (error) {
      console.error('[AnalysisTracker] Error loading data:', error);
      alert('Failed to load analytics data. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle benchmark run
   */
  const handleRunBenchmark = async () => {
    if (benchmarkRunning) return;
    
    const sampleCount = prompt('Enter number of sample files to process (1-20):', '5');
    if (!sampleCount) return;
    
    const count = parseInt(sampleCount);
    if (isNaN(count) || count < 1 || count > 20) {
      alert('Please enter a number between 1 and 20');
      return;
    }
    
    try {
      setBenchmarkRunning(true);
      setBenchmarkStatus('Starting benchmark...');
      
      const response = await fetch(`${apiUrl}/api/analytics/run-benchmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample_count: count })
      });
      
      const result = await response.json();
      setBenchmarkStatus(`Benchmark started: ${result.message}`);
      
      // Poll for completion (for PoC, wait a bit then reload)
      setTimeout(async () => {
        setBenchmarkStatus('Benchmark running... This may take a few minutes.');
        // Wait for benchmark to complete (in production, poll task status)
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        setBenchmarkStatus('Reloading data...');
        await loadData();
        setBenchmarkStatus('Benchmark completed!');
        setTimeout(() => {
          setBenchmarkRunning(false);
          setBenchmarkStatus(null);
        }, 2000);
      }, 1000);
      
    } catch (error) {
      console.error('[AnalysisTracker] Benchmark error:', error);
      alert(`Failed to run benchmark: ${error.message}`);
      setBenchmarkRunning(false);
      setBenchmarkStatus(null);
    }
  };

  /**
   * Handle CSV export
   */
  const handleExportCSV = () => {
    if (cases.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Create CSV header
    const headers = [
      'Case ID',
      'Uploaded At',
      'Processing Time (s)',
      'Extraction Precision',
      'Extraction Recall',
      'Retrieval Latency (ms)',
      'Encryption Success',
      'Verdict Generated At'
    ];
    
    // Create CSV rows
    const rows = cases.map(c => [
      c.case_id || '',
      c.uploaded_at || '',
      c.processing_time_seconds || '',
      c.extraction_precision !== null ? c.extraction_precision.toFixed(3) : '',
      c.extraction_recall !== null ? c.extraction_recall.toFixed(3) : '',
      c.retrieval_latency_ms || '',
      c.encryption_success ? 'Yes' : 'No',
      c.verdict_generated_at || ''
    ]);
    
    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `analytics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Handle filter changes
   */
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // ========================================================================
  // CHART RENDERING HELPERS
  // ========================================================================

  /**
   * Render simple line chart for processing time trend
   */
  const renderProcessingTimeChart = () => {
    if (cases.length === 0) return <div className="chart-empty">No data available</div>;
    
    const recentCases = [...cases].slice(0, 10).reverse(); // Last 10 cases
    const maxTime = Math.max(...recentCases.map(c => c.processing_time_seconds || 0), 1);
    const chartHeight = 200;
    const chartWidth = 600;
    const padding = 40;
    
    const points = recentCases.map((c, i) => {
      const x = padding + (i * (chartWidth - 2 * padding) / (recentCases.length - 1 || 1));
      const y = padding + chartHeight - padding - ((c.processing_time_seconds || 0) / maxTime) * (chartHeight - 2 * padding);
      return { x, y, time: c.processing_time_seconds || 0 };
    });
    
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    return (
      <svg width={chartWidth} height={chartHeight + 60} className="chart-svg">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
          <line
            key={ratio}
            x1={padding}
            y1={padding + (chartHeight - 2 * padding) * (1 - ratio)}
            x2={chartWidth - padding}
            y2={padding + (chartHeight - 2 * padding) * (1 - ratio)}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="1"
          />
        ))}
        
        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
        />
        
        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#60a5fa"
            className="chart-point"
            title={`${p.time.toFixed(1)}s`}
          />
        ))}
        
        {/* Labels */}
        <text x={chartWidth / 2} y={chartHeight + 50} textAnchor="middle" fill="rgba(255, 255, 255, 0.6)" fontSize="12">
          Recent Cases (Last 10)
        </text>
        <text x={20} y={chartHeight / 2 + 30} textAnchor="middle" fill="rgba(255, 255, 255, 0.6)" fontSize="12" transform={`rotate(-90, 20, ${chartHeight / 2 + 30})`}>
          Processing Time (seconds)
        </text>
      </svg>
    );
  };

  /**
   * Render bar chart for extraction metrics
   */
  const renderExtractionChart = () => {
    const casesWithMetrics = cases.filter(c => c.extraction_precision !== null && c.extraction_recall !== null);
    if (casesWithMetrics.length === 0) return <div className="chart-empty">No accuracy data available</div>;
    
    const avgPrecision = casesWithMetrics.reduce((sum, c) => sum + c.extraction_precision, 0) / casesWithMetrics.length;
    const avgRecall = casesWithMetrics.reduce((sum, c) => sum + c.extraction_recall, 0) / casesWithMetrics.length;
    const avgF1 = casesWithMetrics.reduce((sum, c) => sum + (c.extraction_f1 || 0), 0) / casesWithMetrics.length;
    
    const chartHeight = 200;
    const chartWidth = 300;
    const barWidth = 60;
    const spacing = 40;
    
    return (
      <svg width={chartWidth} height={chartHeight + 60} className="chart-svg">
        {/* Bars */}
        <rect
          x={spacing}
          y={chartHeight - (avgPrecision * chartHeight)}
          width={barWidth}
          height={avgPrecision * chartHeight}
          fill="#60a5fa"
          className="chart-bar"
        />
        <text x={spacing + barWidth / 2} y={chartHeight + 20} textAnchor="middle" fill="rgba(255, 255, 255, 0.7)" fontSize="12">
          Precision
        </text>
        <text x={spacing + barWidth / 2} y={chartHeight - (avgPrecision * chartHeight) - 5} textAnchor="middle" fill="#60a5fa" fontSize="11" fontWeight="600">
          {(avgPrecision * 100).toFixed(1)}%
        </text>
        
        <rect
          x={spacing + barWidth + spacing}
          y={chartHeight - (avgRecall * chartHeight)}
          width={barWidth}
          height={avgRecall * chartHeight}
          fill="#a78bfa"
          className="chart-bar"
        />
        <text x={spacing + barWidth + spacing + barWidth / 2} y={chartHeight + 20} textAnchor="middle" fill="rgba(255, 255, 255, 0.7)" fontSize="12">
          Recall
        </text>
        <text x={spacing + barWidth + spacing + barWidth / 2} y={chartHeight - (avgRecall * chartHeight) - 5} textAnchor="middle" fill="#a78bfa" fontSize="11" fontWeight="600">
          {(avgRecall * 100).toFixed(1)}%
        </text>
        
        <rect
          x={spacing + (barWidth + spacing) * 2}
          y={chartHeight - (avgF1 * chartHeight)}
          width={barWidth}
          height={avgF1 * chartHeight}
          fill="#34d399"
          className="chart-bar"
        />
        <text x={spacing + (barWidth + spacing) * 2 + barWidth / 2} y={chartHeight + 20} textAnchor="middle" fill="rgba(255, 255, 255, 0.7)" fontSize="12">
          F1 Score
        </text>
        <text x={spacing + (barWidth + spacing) * 2 + barWidth / 2} y={chartHeight - (avgF1 * chartHeight) - 5} textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="600">
          {(avgF1 * 100).toFixed(1)}%
        </text>
        
        {/* Y-axis label */}
        <text x={20} y={chartHeight / 2 + 30} textAnchor="middle" fill="rgba(255, 255, 255, 0.6)" fontSize="12" transform={`rotate(-90, 20, ${chartHeight / 2 + 30})`}>
          Score (0-1)
        </text>
      </svg>
    );
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  if (loading) {
    return (
      <div className="analysis-tracker">
        <div className="loading-spinner">Loading analytics data...</div>
      </div>
    );
  }

  return (
    <div className="analysis-tracker">
      {/* Header */}
      <div className="tracker-header">
        <h2>📊 Analytics & Validation Metrics</h2>
        <div className="header-actions">
          <button
            className="btn-primary"
            onClick={handleRunBenchmark}
            disabled={benchmarkRunning}
          >
            {benchmarkRunning ? '⏳ Running...' : '▶️ Run Benchmark'}
          </button>
          <button
            className="btn-secondary"
            onClick={handleExportCSV}
            disabled={cases.length === 0}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Benchmark Status */}
      {benchmarkStatus && (
        <div className="benchmark-status">
          {benchmarkStatus}
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <div className="metric-label">Time Reduction</div>
            <div className="metric-value">{summary?.time_reduction_pct || 0}%</div>
            <div className="metric-description">
              Avg: {summary?.avg_processing_time_seconds || 0}s
            </div>
          </div>
          <div className="metric-tooltip" title="Percentage reduction in average case processing time compared to baseline (2 hours)">
            ℹ️
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <div className="metric-label">Extraction Accuracy</div>
            <div className="metric-value">{summary?.extraction_accuracy_pct || 0}%</div>
            <div className="metric-description">
              Precision & Recall
            </div>
          </div>
          <div className="metric-tooltip" title="Average precision and recall for entity/fact extraction">
            ℹ️
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚡</div>
          <div className="metric-content">
            <div className="metric-label">Retrieval Speedup</div>
            <div className="metric-value">{summary?.retrieval_speedup_x || 0}x</div>
            <div className="metric-description">
              vs Baseline
            </div>
          </div>
          <div className="metric-tooltip" title="Speedup factor for precedent retrieval compared to baseline (2s)">
            ℹ️
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔒</div>
          <div className="metric-content">
            <div className="metric-label">Encryption Success</div>
            <div className="metric-value">{summary?.encryption_success_pct || 0}%</div>
            <div className="metric-description">
              Round-trip success
            </div>
          </div>
          <div className="metric-tooltip" title="Percentage of successful encryption/decryption round-trips">
            ℹ️
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-card">
          <h3>Processing Time Trend</h3>
          <div className="chart-container">
            {renderProcessingTimeChart()}
          </div>
        </div>

        <div className="chart-card">
          <h3>Extraction Metrics</h3>
          <div className="chart-container">
            {renderExtractionChart()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <h3>Filters</h3>
        <div className="filters-grid">
          <div className="filter-item">
            <label>From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => handleFilterChange('from', e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label>To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => handleFilterChange('to', e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label>Min Accuracy</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={filters.minAccuracy}
              onChange={(e) => handleFilterChange('minAccuracy', e.target.value)}
              placeholder="0.0-1.0"
            />
          </div>
          <div className="filter-item">
            <label>
              <input
                type="checkbox"
                checked={filters.encryptionOnly}
                onChange={(e) => handleFilterChange('encryptionOnly', e.target.checked)}
              />
              Encryption Only
            </label>
          </div>
        </div>
      </div>

      {/* Cases Table */}
      <div className="cases-table-section">
        <h3>Recent Cases ({cases.length})</h3>
        {cases.length === 0 ? (
          <div className="empty-state">
            No cases found. Run a benchmark to generate analytics data.
          </div>
        ) : (
          <div className="table-container">
            <table className="cases-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Uploaded At</th>
                  <th>Processing Time (s)</th>
                  <th>Extraction Precision</th>
                  <th>Extraction Recall</th>
                  <th>Retrieval Latency (ms)</th>
                  <th>Encryption Success</th>
                  <th>Verdict Generated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, i) => (
                  <tr key={i}>
                    <td>{c.case_id}</td>
                    <td>{new Date(c.uploaded_at).toLocaleString()}</td>
                    <td>{c.processing_time_seconds || '-'}</td>
                    <td>{c.extraction_precision !== null ? (c.extraction_precision * 100).toFixed(1) + '%' : '-'}</td>
                    <td>{c.extraction_recall !== null ? (c.extraction_recall * 100).toFixed(1) + '%' : '-'}</td>
                    <td>{c.retrieval_latency_ms || '-'}</td>
                    <td>
                      <span className={c.encryption_success ? 'status-success' : 'status-failure'}>
                        {c.encryption_success ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td>{c.verdict_generated_at ? new Date(c.verdict_generated_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Last Updated */}
      {summary?.last_updated && (
        <div className="last-updated">
          Last updated: {new Date(summary.last_updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}

export default AnalysisTracker;

