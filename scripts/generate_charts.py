#!/usr/bin/env python3
"""
============================================================================
JUSTICE AI - CHART GENERATOR
============================================================================

Generates PNG charts from analytics data:
- processing_time_trend.png
- extraction_metrics.png
- retrieval_latency.png

Usage:
    pip install matplotlib pandas
    python3 scripts/generate_charts.py

============================================================================
"""

import json
import os
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import pandas as pd

# ============================================================================
# CONFIGURATION
# ============================================================================

BASE_DIR = Path(__file__).parent.parent
ANALYTICS_FILE = BASE_DIR / "backend" / "api" / "data" / "analytics.json"
SUMMARY_FILE = BASE_DIR / "backend" / "api" / "data" / "analytics_summary.json"
CHARTS_DIR = BASE_DIR / "backend" / "api" / "data" / "charts"

# Chart style
plt.style.use('dark_background')
COLORS = {
    'primary': '#60a5fa',
    'secondary': '#a78bfa',
    'success': '#34d399',
    'warning': '#fbbf24',
    'error': '#ef4444'
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def ensure_charts_dir():
    """Ensure charts directory exists"""
    CHARTS_DIR.mkdir(parents=True, exist_ok=True)

def load_analytics():
    """Load analytics data from JSON file"""
    try:
        with open(ANALYTICS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('cases', [])
    except FileNotFoundError:
        print(f"Warning: {ANALYTICS_FILE} not found. No analytics data available.")
        return []
    except json.JSONDecodeError as e:
        print(f"Error parsing {ANALYTICS_FILE}: {e}")
        return []

def load_summary():
    """Load analytics summary from JSON file"""
    try:
        with open(SUMMARY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Warning: {SUMMARY_FILE} not found.")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing {SUMMARY_FILE}: {e}")
        return {}

# ============================================================================
# CHART GENERATION
# ============================================================================

def generate_processing_time_trend(cases):
    """Generate processing time trend chart"""
    if not cases:
        print("No cases data available for processing time trend")
        return

    # Sort by uploaded_at
    sorted_cases = sorted(cases, key=lambda x: x.get('uploaded_at', ''))
    
    # Get last 20 cases
    recent_cases = sorted_cases[-20:]
    
    # Extract data
    case_ids = [c.get('case_id', f"Case {i}") for i, c in enumerate(recent_cases)]
    processing_times = [c.get('processing_time_seconds', 0) for c in recent_cases]
    
    # Create chart
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(range(len(recent_cases)), processing_times, 
            marker='o', color=COLORS['primary'], linewidth=2, markersize=6)
    ax.fill_between(range(len(recent_cases)), processing_times, 
                    alpha=0.3, color=COLORS['primary'])
    
    ax.set_xlabel('Case Index (Recent Cases)', fontsize=12, color='white')
    ax.set_ylabel('Processing Time (seconds)', fontsize=12, color='white')
    ax.set_title('Processing Time Trend (Last 20 Cases)', fontsize=14, color='white', pad=20)
    ax.grid(True, alpha=0.3, color='white')
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')
    
    # Rotate x-axis labels if needed
    if len(recent_cases) > 10:
        plt.xticks(rotation=45, ha='right')
    
    plt.tight_layout()
    output_path = CHARTS_DIR / "processing_time_trend.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='#0f172a')
    plt.close()
    print(f"✅ Generated: {output_path}")

def generate_extraction_metrics(cases):
    """Generate extraction metrics bar chart"""
    if not cases:
        print("No cases data available for extraction metrics")
        return

    # Filter cases with metrics
    cases_with_metrics = [c for c in cases 
                         if c.get('extraction_precision') is not None 
                         and c.get('extraction_recall') is not None]
    
    if not cases_with_metrics:
        print("No cases with extraction metrics available")
        return

    # Calculate averages
    avg_precision = sum(c.get('extraction_precision', 0) for c in cases_with_metrics) / len(cases_with_metrics)
    avg_recall = sum(c.get('extraction_recall', 0) for c in cases_with_metrics) / len(cases_with_metrics)
    avg_f1 = sum(c.get('extraction_f1', 0) for c in cases_with_metrics) / len(cases_with_metrics)

    # Create chart
    fig, ax = plt.subplots(figsize=(10, 6))
    
    metrics = ['Precision', 'Recall', 'F1 Score']
    values = [avg_precision * 100, avg_recall * 100, avg_f1 * 100]
    colors = [COLORS['primary'], COLORS['secondary'], COLORS['success']]
    
    bars = ax.bar(metrics, values, color=colors, alpha=0.8, edgecolor='white', linewidth=1.5)
    
    # Add value labels on bars
    for bar, val in zip(bars, values):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
               f'{val:.1f}%',
               ha='center', va='bottom', fontsize=12, color='white', fontweight='bold')
    
    ax.set_ylabel('Score (%)', fontsize=12, color='white')
    ax.set_title('Extraction Metrics (Average)', fontsize=14, color='white', pad=20)
    ax.set_ylim(0, 100)
    ax.grid(True, alpha=0.3, color='white', axis='y')
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')
    
    plt.tight_layout()
    output_path = CHARTS_DIR / "extraction_metrics.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='#0f172a')
    plt.close()
    print(f"✅ Generated: {output_path}")

def generate_retrieval_latency(cases):
    """Generate retrieval latency chart"""
    if not cases:
        print("No cases data available for retrieval latency")
        return

    # Filter cases with retrieval latency
    cases_with_latency = [c for c in cases if c.get('retrieval_latency_ms') is not None]
    
    if not cases_with_latency:
        print("No cases with retrieval latency data available")
        return

    # Sort by uploaded_at
    sorted_cases = sorted(cases_with_latency, key=lambda x: x.get('uploaded_at', ''))
    
    # Get last 20 cases
    recent_cases = sorted_cases[-20:]
    
    # Extract data
    case_ids = [c.get('case_id', f"Case {i}") for i, c in enumerate(recent_cases)]
    latencies = [c.get('retrieval_latency_ms', 0) for c in recent_cases]
    
    # Create chart
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.bar(range(len(recent_cases)), latencies, 
           color=COLORS['secondary'], alpha=0.8, edgecolor='white', linewidth=1)
    
    ax.set_xlabel('Case Index (Recent Cases)', fontsize=12, color='white')
    ax.set_ylabel('Retrieval Latency (ms)', fontsize=12, color='white')
    ax.set_title('Retrieval Latency (Last 20 Cases)', fontsize=14, color='white', pad=20)
    ax.grid(True, alpha=0.3, color='white', axis='y')
    ax.set_facecolor('#0f172a')
    fig.patch.set_facecolor('#0f172a')
    
    # Rotate x-axis labels if needed
    if len(recent_cases) > 10:
        plt.xticks(rotation=45, ha='right')
    
    plt.tight_layout()
    output_path = CHARTS_DIR / "retrieval_latency.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='#0f172a')
    plt.close()
    print(f"✅ Generated: {output_path}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n" + "="*60)
    print("📊 JUSTICE AI - CHART GENERATOR")
    print("="*60 + "\n")
    
    # Ensure charts directory exists
    ensure_charts_dir()
    
    # Load data
    cases = load_analytics()
    summary = load_summary()
    
    if not cases:
        print("⚠️  No analytics data found. Run a benchmark first.")
        print("   Use: POST /api/analytics/run-benchmark")
        return
    
    print(f"📈 Generating charts from {len(cases)} cases...\n")
    
    # Generate charts
    generate_processing_time_trend(cases)
    generate_extraction_metrics(cases)
    generate_retrieval_latency(cases)
    
    print(f"\n✅ All charts generated successfully!")
    print(f"📁 Charts saved to: {CHARTS_DIR}\n")

if __name__ == "__main__":
    try:
        main()
    except ImportError as e:
        print(f"\n❌ Error: Missing required package: {e}")
        print("   Install with: pip install matplotlib pandas")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

