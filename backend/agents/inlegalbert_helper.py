"""
InLegalBERT Helper Module
Provides NER and FAISS precedent retrieval functionality for integration into other agents.
"""
import os
import json
import numpy as np
from typing import List, Dict, Optional, Tuple
import torch

# Try to import transformers and faiss
try:
    from transformers import AutoTokenizer, AutoModelForTokenClassification, AutoModel
    import faiss
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    print("Warning: transformers or faiss not available. InLegalBERT features will be disabled.")

MODEL_ID = "law-ai/InLegalBERT"
DB_PATH = os.path.join(os.path.dirname(__file__), "precedent_index")

# Global model variables
tokenizer = None
ner_model = None
embed_model = None
device = None

# Initialize models
def initialize_models():
    """Initialize InLegalBERT models."""
    global tokenizer, ner_model, embed_model, device
    
    if not TRANSFORMERS_AVAILABLE:
        return False
    
    if tokenizer is not None:
        return True  # Already initialized
    
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
        print(f"✅ InLegalBERT models loaded successfully on {device}")
        return True
    except Exception as e:
        print(f"❌ Error loading InLegalBERT models: {e}")
        return False


def mean_pooling(token_embeds, attention_mask):
    """Mean pooling for sentence embeddings."""
    input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeds.size()).float()
    sum_embeddings = torch.sum(token_embeds * input_mask_expanded, 1)
    sum_mask = input_mask_expanded.sum(1).clamp(min=1e-9)
    return sum_embeddings / sum_mask


def embed_text(text: str) -> Optional[np.ndarray]:
    """
    Generate embedding for input text using InLegalBERT.
    
    Args:
        text: Input text to embed
        
    Returns:
        Normalized embedding vector (768-dim) or None if models not available
    """
    if not TRANSFORMERS_AVAILABLE or tokenizer is None or embed_model is None:
        return None
    
    try:
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            out = embed_model(**inputs, return_dict=True)
            token_embeds = out.last_hidden_state
            emb = mean_pooling(token_embeds, inputs["attention_mask"]).cpu().numpy()[0]
        
        # Normalize embedding
        emb = emb / np.linalg.norm(emb).clip(min=1e-9)
        return emb
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None


def perform_ner(text: str) -> List[Dict]:
    """
    Perform Named Entity Recognition on text.
    
    Args:
        text: Input text for NER
        
    Returns:
        List of NER results with tokens and label IDs
    """
    if not TRANSFORMERS_AVAILABLE or tokenizer is None or ner_model is None:
        return []
    
    try:
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(device)
        with torch.no_grad():
            logits = ner_model(**inputs).logits
        preds = torch.argmax(logits, dim=-1).cpu().numpy()[0]
        tokens = tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
        ner_output = [{"token": t, "label_id": int(p)} for t, p in zip(tokens, preds)]
        return ner_output
    except Exception as e:
        print(f"Error performing NER: {e}")
        return []


def load_or_create_faiss() -> Tuple[Optional[object], List[Dict], str, str]:
    """
    Load existing FAISS index or create a new one.
    
    Returns:
        tuple: (index, metadata, index_file_path, meta_file_path)
    """
    if not TRANSFORMERS_AVAILABLE:
        return None, [], "", ""
    
    dim = 768
    os.makedirs(DB_PATH, exist_ok=True)
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


def search_precedents(text: str, top_k: int = 5) -> List[Dict]:
    """
    Search for similar precedents using FAISS.
    
    Args:
        text: Input text to search for
        top_k: Number of top precedents to retrieve
        
    Returns:
        List of precedent dictionaries with text, distance, case_id, similarity_score
    """
    if not TRANSFORMERS_AVAILABLE:
        return []
    
    try:
        # Generate embedding
        emb = embed_text(text)
        if emb is None:
            return []
        
        # Load FAISS index
        index, meta, _, _ = load_or_create_faiss()
        if index is None or len(meta) == 0:
            return []
        
        # Search
        k = min(top_k, len(meta))
        D, I = index.search(np.array([emb]).astype('float32'), k)
        
        precedents = []
        for dist, idx in zip(D[0], I[0]):
            if idx < len(meta):
                precedents.append({
                    "text": meta[idx]["text"][:150] + "..." if len(meta[idx]["text"]) > 150 else meta[idx]["text"],
                    "distance": float(dist),
                    "case_id": meta[idx].get("id", idx),
                    "similarity_score": float(1 / (1 + dist))
                })
        
        return precedents
    except Exception as e:
        print(f"Error searching precedents: {e}")
        return []


def analyze_with_inlegalbert(text: str, top_k_precedents: int = 5) -> Dict:
    """
    Perform complete InLegalBERT analysis: NER + precedent search.
    
    Args:
        text: Input text to analyze
        top_k_precedents: Number of precedents to retrieve
        
    Returns:
        Dictionary with ner, precedents, and embedding info
    """
    result = {
        "ner": [],
        "precedents": [],
        "embedding_dim": 0,
        "inlegalbert_available": False
    }
    
    if not TRANSFORMERS_AVAILABLE:
        return result
    
    # Initialize models if not already done
    if tokenizer is None:
        if not initialize_models():
            return result
    
    result["inlegalbert_available"] = True
    
    # Perform NER
    try:
        ner_output = perform_ner(text)
        result["ner"] = ner_output
    except Exception as e:
        print(f"NER failed: {e}")
    
    # Search precedents
    try:
        precedents = search_precedents(text, top_k_precedents)
        result["precedents"] = precedents
    except Exception as e:
        print(f"Precedent search failed: {e}")
    
    # Get embedding dimension
    try:
        emb = embed_text(text)
        if emb is not None:
            result["embedding_dim"] = len(emb)
    except Exception as e:
        print(f"Embedding failed: {e}")
    
    return result

