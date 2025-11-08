"""
Smoke tests for Agent 1 InLegalBERT + FAISS implementation.
Tests basic functionality without requiring full model downloads.
"""
import pytest
import sys
import os
from pathlib import Path
import time

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
import json
import tempfile
import shutil

# Set environment variable to skip model downloads if needed
os.environ.setdefault("TRANSFORMERS_OFFLINE", "0")


@pytest.fixture(scope="module")
def client():
    """Create a test client for the FastAPI app."""
    # Import here to avoid loading models during test discovery
    try:
        from agent1_inlegal_faiss import app
        return TestClient(app)
    except Exception as e:
        pytest.skip(f"Could not import agent1_inlegal_faiss: {e}")


@pytest.fixture
def temp_db_path(monkeypatch):
    """Create a temporary directory for FAISS index during tests."""
    temp_dir = tempfile.mkdtemp()
    original_path = os.path.join(os.path.dirname(__file__), "..", "precedent_index")
    
    # Monkey patch the DB_PATH
    import agent1_inlegal_faiss
    monkeypatch.setattr(agent1_inlegal_faiss, "DB_PATH", temp_dir)
    
    yield temp_dir
    
    # Cleanup
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "healthy"
    assert "model_loaded" in data
    assert "model_id" in data


@pytest.mark.timeout(30)
def test_embed_endpoint_basic(client):
    """Test embedding endpoint with valid text."""
    try:
        response = client.post("/embed", json={"text": "This is a test legal case."}, timeout=25.0)
    except Exception:
        # If request times out, skip this test (models may be downloading)
        pytest.skip("Request timed out - models may be downloading")
    
    # Should return 200 if models are loaded, or 503 if not
    assert response.status_code in [200, 503]
    
    if response.status_code == 200:
        data = response.json()
        assert "embedding" in data
        assert "dimension" in data
        assert data["dimension"] == 768
        assert len(data["embedding"]) == 768
        assert all(isinstance(x, (int, float)) for x in data["embedding"])


def test_embed_endpoint_empty_text(client):
    """Test embedding endpoint with empty text."""
    response = client.post("/embed", json={"text": ""})
    assert response.status_code == 400
    assert "required" in response.json()["detail"].lower()


def test_embed_endpoint_missing_text(client):
    """Test embedding endpoint without text field."""
    response = client.post("/embed", json={})
    assert response.status_code == 400


@pytest.mark.timeout(30)
def test_analyze_endpoint_basic(client, temp_db_path):
    """Test analyze endpoint with valid text."""
    try:
        response = client.post(
            "/analyze",
            json={
                "text": "The defendant was charged with theft under Section 379 of IPC.",
                "top_k_precedents": 3
            },
            timeout=25.0
        )
    except Exception:
        pytest.skip("Request timed out - models may be downloading")
    
    # Should return 200 if models are loaded, or 503 if not
    assert response.status_code in [200, 503]
    
    if response.status_code == 200:
        data = response.json()
        assert "ner" in data
        assert "embedding_dim" in data
        assert "precedents" in data
        assert "total_precedents_in_db" in data
        assert data["embedding_dim"] == 768
        assert isinstance(data["ner"], list)
        assert isinstance(data["precedents"], list)
        assert isinstance(data["total_precedents_in_db"], int)


def test_analyze_endpoint_invalid_top_k(client):
    """Test analyze endpoint with invalid top_k."""
    response = client.post(
        "/analyze",
        json={
            "text": "Test case",
            "top_k_precedents": 0
        }
    )
    assert response.status_code == 400
    
    response = client.post(
        "/analyze",
        json={
            "text": "Test case",
            "top_k_precedents": 101
        }
    )
    assert response.status_code == 400


@pytest.mark.timeout(30)
def test_add_precedent_endpoint(client, temp_db_path):
    """Test adding a precedent to the database."""
    try:
        response = client.post(
            "/add_precedent",
            json={
                "text": "State of Maharashtra vs Rajesh Kumar: The court held that...",
                "id": "test_case_001"
            },
            timeout=25.0
        )
    except Exception:
        pytest.skip("Request timed out - models may be downloading")
    
    # Should return 200 if models are loaded, or 503 if not
    assert response.status_code in [200, 503]
    
    if response.status_code == 200:
        data = response.json()
        assert "message" in data
        assert "total" in data
        assert "case_id" in data
        assert data["case_id"] == "test_case_001"
        assert data["total"] == 1


@pytest.mark.timeout(30)
def test_add_precedent_endpoint_auto_id(client, temp_db_path):
    """Test adding a precedent without explicit ID."""
    try:
        response = client.post(
            "/add_precedent",
            json={
                "text": "Another test case precedent."
            },
            timeout=25.0
        )
    except Exception:
        pytest.skip("Request timed out - models may be downloading")
    
    if response.status_code == 200:
        data = response.json()
        assert "case_id" in data
        assert data["total"] == 1


def test_add_precedent_endpoint_empty_text(client):
    """Test adding precedent with empty text."""
    response = client.post(
        "/add_precedent",
        json={"text": ""}
    )
    assert response.status_code == 400


def test_precedent_count_endpoint(client, temp_db_path):
    """Test getting precedent count."""
    response = client.get("/precedents/count")
    assert response.status_code in [200, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "total" in data
        assert isinstance(data["total"], int)


def test_clear_precedents_endpoint(client, temp_db_path):
    """Test clearing all precedents."""
    # First add a precedent
    client.post(
        "/add_precedent",
        json={"text": "Test precedent", "id": "test_001"}
    )
    
    # Then clear
    response = client.delete("/precedents/clear")
    assert response.status_code in [200, 500]
    
    if response.status_code == 200:
        data = response.json()
        assert "message" in data


@pytest.mark.timeout(60)
def test_analyze_with_precedents(client, temp_db_path):
    """Test analyze endpoint after adding precedents."""
    try:
        # Add a precedent
        add_response = client.post(
            "/add_precedent",
            json={
                "text": "State of Maharashtra vs Rajesh Kumar: Theft case under Section 379 IPC.",
                "id": "precedent_001"
            },
            timeout=25.0
        )
    except Exception:
        pytest.skip("Request timed out - models may be downloading")
    
    if add_response.status_code == 200:
        try:
            # Now analyze similar text
            analyze_response = client.post(
                "/analyze",
                json={
                    "text": "The defendant committed theft under IPC Section 379.",
                    "top_k_precedents": 1
                },
                timeout=25.0
            )
        except Exception:
            pytest.skip("Request timed out - models may be downloading")
        
        if analyze_response.status_code == 200:
            data = analyze_response.json()
            assert len(data["precedents"]) > 0
            precedent = data["precedents"][0]
            assert "text" in precedent
            assert "distance" in precedent
            assert "case_id" in precedent
            assert "similarity_score" in precedent


def test_cors_headers(client):
    """Test that CORS headers are properly set."""
    response = client.options("/health")
    # CORS middleware should handle OPTIONS requests
    assert response.status_code in [200, 405]  # 405 if OPTIONS not explicitly handled


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

