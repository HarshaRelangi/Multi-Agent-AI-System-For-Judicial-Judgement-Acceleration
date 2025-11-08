"""
Agent 1: InLegalBERT + FAISS Case Analyzer
Performs NER and text embeddings on case documents.
Retrieves top-k similar precedents using FAISS similarity search.

This is a standalone FastAPI service that uses the inlegalbert_helper module.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import faiss
from typing import List, Dict, Optional

# Import helper functions
from inlegalbert_helper import (
    initialize_models, embed_text, perform_ner, search_precedents,
    analyze_with_inlegalbert, load_or_create_faiss
)

app = FastAPI(title="Agent-1: InLegalBERT + FAISS Case Analyzer")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_ID = "law-ai/InLegalBERT"
DB_PATH = os.path.join(os.path.dirname(__file__), "precedent_index")

# Ensure directory exists
os.makedirs(DB_PATH, exist_ok=True)

# Models will be initialized lazily when first needed
# This avoids blocking on import (important for tests)


def save_index(index, meta, index_file, meta_file):
    """Save FAISS index and metadata to disk."""
    try:
        faiss.write_index(index, index_file)
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"💾 Saved FAISS index with {len(meta)} precedents")
    except Exception as e:
        print(f"❌ Error saving index: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save index: {e}")


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Try to initialize models if not already done
    from inlegalbert_helper import initialize_models, tokenizer, ner_model, embed_model, device
    if tokenizer is None:
        # Models not initialized yet - try to initialize (non-blocking for health check)
        try:
            initialize_models()
        except Exception:
            pass  # Models may be downloading or unavailable
    
    return {
        "status": "healthy",
        "model_loaded": embed_model is not None,
        "ner_available": ner_model is not None,
        "device": str(device) if device else "unknown",
        "model_id": MODEL_ID
    }


@app.post("/embed")
async def embed_endpoint(data: dict):
    """
    Generate embedding for input text.
    
    Request body:
        {
            "text": "Your legal case text here..."
        }
    
    Returns:
        {
            "embedding": [list of 768 floats],
            "dimension": 768
        }
    """
    text = data.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    try:
        emb = embed_text(text)
        if emb is None:
            raise HTTPException(status_code=503, detail="Models not available. Cannot generate embedding.")
        return {
            "embedding": emb.tolist(),
            "dimension": len(emb)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


class AnalyzeRequest(BaseModel):
    text: str
    top_k_precedents: int = 5


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Analyze case text: perform NER and retrieve similar precedents.
    
    Request body:
        {
            "text": "Case text to analyze...",
            "top_k_precedents": 5  # optional, default 5
        }
    
    Returns:
        {
            "ner": [list of NER results],
            "embedding_dim": 768,
            "precedents": [list of similar precedents]
        }
    """
    if not req.text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    if req.top_k_precedents < 1 or req.top_k_precedents > 100:
        raise HTTPException(status_code=400, detail="top_k_precedents must be between 1 and 100")
    
    try:
        # Use the helper function for complete analysis
        result = analyze_with_inlegalbert(req.text, req.top_k_precedents)
        
        # Get total precedents in DB
        _, meta, _, _ = load_or_create_faiss()
        
        return {
            "ner": result.get("ner", []),
            "embedding_dim": result.get("embedding_dim", 0),
            "precedents": result.get("precedents", []),
            "total_precedents_in_db": len(meta) if meta else 0,
            "inlegalbert_available": result.get("inlegalbert_available", False)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/add_precedent")
async def add_precedent(data: dict):
    """
    Add new precedent text to FAISS database.
    
    Request body:
        {
            "text": "Precedent case text...",
            "id": "case_123"  # optional, auto-generated if not provided
        }
    
    Returns:
        {
            "message": "Precedent added. Total: N",
            "total": N
        }
    """
    import numpy as np
    
    text = data.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    case_id = data.get("id", f"case_{len(text)}")
    
    try:
        # Generate embedding
        emb = embed_text(text)
        if emb is None:
            raise HTTPException(status_code=503, detail="Models not available. Cannot generate embedding.")
        
        # Load index
        index, meta, index_file, meta_file = load_or_create_faiss()
        if index is None:
            raise HTTPException(status_code=500, detail="Failed to load FAISS index")
        
        # Add to index
        index.add(np.array([emb]).astype('float32'))
        meta.append({"id": case_id, "text": text})
        
        # Save index
        save_index(index, meta, index_file, meta_file)
        
        return {
            "message": f"Precedent added. Total: {len(meta)}",
            "total": len(meta),
            "case_id": case_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add precedent: {str(e)}")


@app.get("/precedents/count")
async def get_precedent_count():
    """Get the total number of precedents in the database."""
    try:
        _, meta, _, _ = load_or_create_faiss()
        return {"total": len(meta)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get count: {str(e)}")


@app.delete("/precedents/clear")
async def clear_precedents():
    """Clear all precedents from the database."""
    try:
        index_file = os.path.join(DB_PATH, "precedent.index")
        meta_file = os.path.join(DB_PATH, "meta.json")
        
        if os.path.exists(index_file):
            os.remove(index_file)
        if os.path.exists(meta_file):
            os.remove(meta_file)
        
        return {"message": "All precedents cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear precedents: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

