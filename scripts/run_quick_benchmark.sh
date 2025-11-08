#!/usr/bin/env bash

set -e

API_BASE=${API_BASE:-http://localhost:4000}
DATA_ZIP_PATH="./data/justice_ai_benchmark_dataset.zip"

# Unzip into project root (if not already)
if [ -f "$DATA_ZIP_PATH" ]; then
    echo "Extracting benchmark dataset..."
    unzip -o "$DATA_ZIP_PATH" -d .
    echo "Dataset extracted successfully"
elif [ -f "$HOME/Downloads/justice_ai_benchmark_dataset.zip" ]; then
    echo "Found dataset in Downloads folder, copying..."
    cp "$HOME/Downloads/justice_ai_benchmark_dataset.zip" "$DATA_ZIP_PATH"
    unzip -o "$DATA_ZIP_PATH" -d .
    echo "Dataset extracted successfully"
else
    echo "Warning: Dataset zip not found, continuing with existing sample files..."
fi

# Python quick runner (ensure requests installed: pip install requests)
python3 - <<PY
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
PY

