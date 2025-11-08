"""
Agent 1: InLegalBERT + FAISS Case Analyzer
Performs NER and text embeddings on case documents.
Retrieves top-k similar precedents using FAISS similarity search.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForTokenClassification, AutoModel
import torch
import numpy as np
import faiss
import os
import json
from typing import List, Dict, Optional

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

# Initialize models
tokenizer = None
ner_model = None
embed_model = None
device = None

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    try:
        ner_model = AutoModelForTokenClassification.from_pretrained(MODEL_ID)
    except Exception as e:
        print(f"Warning: Could not load NER model: {e}. Continuing without NER.")
        ner_model = None
    
    embed_model = AutoModel.from_pretrained(MODEL_ID)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    embed_model.to(device)
    if ner_model:
        ner_model.to(device)
    print(f"✅ Models loaded successfully on {device}")
except Exception as e:
    print(f"❌ Error loading models: {e}")
    print("Please ensure transformers and torch are installed: pip install transformers torch")


def mean_pooling(token_embeds, attention_mask):
    """Mean pooling for sentence embeddings."""
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeds.size()).float()
    sum_embeddings = torch.sum(token_embeds * input_mask_expanded, 1)
    sum_mask = input_mask_expanded.sum(1).clamp(min=1e-9)
    return sum_embeddings / sum_mask


def embed_text(text: str) -> np.ndarray:
    """
    Generate embedding for input text using InLegalBERT.
    
    Args:
        text: Input text to embed
        
    Returns:
        Normalized embedding vector (768-dim)
    """
    if not tokenizer or not embed_model:
        raise HTTPException(status_code=503, detail="Models not loaded. Please check installation.")
    
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
    with torch.no_grad():
        out = embed_model(**inputs, return_dict=True)
        token_embeds = out.last_hidden_state
        emb = mean_pooling(token_embeds, inputs["attention_mask"]).cpu().numpy()[0]
    
    # Normalize embedding
    emb = emb / np.linalg.norm(emb).clip(min=1e-9)
    return emb


def load_or_create_faiss():
    """
    Load existing FAISS index or create a new one.
    
    Returns:
        tuple: (index, metadata, index_file_path, meta_file_path)
    """
    dim = 768
    index_file = os.path.join(DB_PATH, "precedent.index")
    meta_file = os.path.join(DB_PATH, "meta.json")
    
    if os.path.exists(index_file) and os.path.exists(meta_file):
        try:
            index = faiss.read_index(index_file)
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            print(f"✅ Loaded FAISS index with {len(meta)} precedents")
        except Exception as e:
            print(f"⚠️ Error loading index: {e}. Creating new index.")
            index = faiss.IndexFlatL2(dim)
            meta = []
    else:
        index = faiss.IndexFlatL2(dim)
        meta = []
        print("📝 Created new FAISS index")
    
    return index, meta, index_file, meta_file


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
        return {
            "embedding": emb.tolist(),
            "dimension": len(emb)
        }
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
        # Generate embedding
        emb = embed_text(req.text)
        
        # NER pass
        ner_output = []
        if ner_model:
            try:
                inputs = tokenizer(req.text, return_tensors="pt", truncation=True, max_length=512).to(device)
                with torch.no_grad():
                    logits = ner_model(**inputs).logits
                preds = torch.argmax(logits, dim=-1).cpu().numpy()[0]
                tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
                ner_output = [{"token": t, "label_id": int(p)} for t, p in zip(tokens, preds)]
            except Exception as e:
                print(f"⚠️ NER failed: {e}")
                ner_output = []
        
        # Load FAISS index and search
        index, meta, index_file, meta_file = load_or_create_faiss()
        precedents = []
        
        if len(meta) > 0:
            try:
                k = min(req.top_k_precedents, len(meta))
                D, I = index.search(np.array([emb]).astype('float32'), k)
                
                for dist, idx in zip(D[0], I[0]):
                    if idx < len(meta):
                        precedents.append({
                            "text": meta[idx]["text"][:150] + "..." if len(meta[idx]["text"]) > 150 else meta[idx]["text"],
                            "distance": float(dist),
                            "case_id": meta[idx].get("id", idx),
                            "similarity_score": float(1 / (1 + dist))  # Convert distance to similarity
                        })
            except Exception as e:
                print(f"⚠️ FAISS search failed: {e}")
                precedents = []
        else:
            precedents = []
        
        return {
            "ner": ner_output,
            "embedding_dim": len(emb),
            "precedents": precedents,
            "total_precedents_in_db": len(meta)
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
    text = data.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    case_id = data.get("id", f"case_{len(text)}")
    
    try:
        # Generate embedding
        emb = embed_text(text)
        
        # Load index
        index, meta, index_file, meta_file = load_or_create_faiss()
        
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

