# PowerShell version of run_quick_benchmark.sh
# Usage: .\scripts\run_quick_benchmark.ps1

$ErrorActionPreference = "Stop"

$API_BASE = if ($env:API_BASE) { $env:API_BASE } else { "http://localhost:4000" }
$DATA_ZIP_PATH = ".\data\justice_ai_benchmark_dataset.zip"

Write-Host "API_BASE is $API_BASE" -ForegroundColor Cyan

# Unzip into project root (if zip exists)
if (Test-Path $DATA_ZIP_PATH) {
    Write-Host "Extracting benchmark dataset..." -ForegroundColor Yellow
    Expand-Archive -Path $DATA_ZIP_PATH -DestinationPath "." -Force
    Write-Host "Dataset extracted successfully" -ForegroundColor Green
} elseif (Test-Path "$env:USERPROFILE\Downloads\justice_ai_benchmark_dataset.zip") {
    Write-Host "Found dataset in Downloads folder, copying..." -ForegroundColor Yellow
    Copy-Item "$env:USERPROFILE\Downloads\justice_ai_benchmark_dataset.zip" -Destination $DATA_ZIP_PATH -Force
    Expand-Archive -Path $DATA_ZIP_PATH -DestinationPath "." -Force
    Write-Host "Dataset extracted successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: Dataset zip not found, continuing with existing sample files..." -ForegroundColor Yellow
}

# Python quick runner (ensure requests installed: pip install requests)
$pythonScript = @"
import requests, time, json, os, glob

API_BASE = os.getenv("API_BASE", "http://localhost:4000")

print("API_BASE is", API_BASE)

files = sorted(glob.glob("sample_files/*.txt"))

if not files:
    print("No .txt files found in sample_files/ directory")
    exit(1)

results = []

for f in files:
    print("Processing", f)
    t0 = time.time()
    
    try:
        with open(f, 'rb') as fh:
            # adjust endpoint if your agent expects different path or param
            r = requests.post(f"{API_BASE}/api/agents/agent1/analyze", files={"files": fh}, timeout=300)
        
        elapsed = time.time() - t0
        
        try:
            resp = r.json()
            response_preview = str(list(resp.keys())[:5])
        except:
            resp = {"error": r.text}
            response_preview = "Error in response"
        
        results.append({
            "file": f, 
            "elapsed": elapsed, 
            "status_code": r.status_code,
            "response_preview": response_preview
        })
        print(f"Elapsed: {elapsed:.2f}s, Status: {r.status_code}")
    except Exception as e:
        print(f"Error processing {f}: {e}")
        results.append({
            "file": f,
            "elapsed": 0,
            "error": str(e)
        })

# Save results to JSON
with open("benchmark_quick_results.json", "w") as out:
    json.dump(results, out, indent=2)

print(f"\nWrote benchmark_quick_results.json with {len(results)} results")
"@

# Check if Python is available
$pythonCmd = if (Get-Command python -ErrorAction SilentlyContinue) { "python" } 
             elseif (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" }
             else { $null }

if (-not $pythonCmd) {
    Write-Host "Error: Python not found. Please install Python and ensure it's in your PATH." -ForegroundColor Red
    exit 1
}

# Set environment variable for Python script
$env:API_BASE = $API_BASE

# Run Python script
Write-Host "`nRunning benchmark..." -ForegroundColor Cyan
$pythonScript | & $pythonCmd

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBenchmark completed successfully!" -ForegroundColor Green
    if (Test-Path "benchmark_quick_results.json") {
        Write-Host "Results saved to benchmark_quick_results.json" -ForegroundColor Green
    }
} else {
    Write-Host "`nBenchmark failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

