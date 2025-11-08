"""
Agent 2: Human Feedback Integrator
Interactive refinement and validation system
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

app = FastAPI(title="Agent 2 - Human Feedback Integrator")

class FeedbackItem(BaseModel):
    section: str
    feedback_type: str  # add, edit, delete, approve
    content: Optional[str] = None
    action: str  # Description of the change

class HumanFeedback(BaseModel):
    case_id: str
    feedback_items: List[FeedbackItem]
    reviewer_notes: Optional[str] = None
    approval_status: str  # pending, approved, rejected, needs_revision
    timestamp: datetime

class CaseDocument(BaseModel):
    case_id: str
    original_document: Dict[str, Any]
    modified_document: Optional[Dict[str, Any]] = None
    feedback_history: List[HumanFeedback] = []
    version: int = 1
    current_status: str = "pending_review"
    created_at: datetime
    updated_at: datetime

# In-memory storage (in production, use database)
case_documents: Dict[str, CaseDocument] = {}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent2"}

@app.post("/documents/submit")
async def submit_for_review(case_id: str, document: Dict[str, Any]):
    """Submit a document from Agent 1 for human review"""
    now = datetime.now()
    
    case_documents[case_id] = CaseDocument(
        case_id=case_id,
        original_document=document,
        version=1,
        current_status="pending_review",
        created_at=now,
        updated_at=now
    )
    
    return {
        "status": "submitted",
        "case_id": case_id,
        "version": 1,
        "message": "Document ready for human review",
        "review_url": f"/documents/{case_id}"
    }

@app.get("/documents/{case_id}")
async def get_document(case_id: str):
    """Retrieve a case document for review"""
    if case_id not in case_documents:
        raise HTTPException(status_code=404, detail="Case not found")
    
    doc = case_documents[case_id]
    return {
        "case_id": doc.case_id,
        "document": doc.modified_document or doc.original_document,
        "version": doc.version,
        "status": doc.current_status,
        "feedback_count": len(doc.feedback_history),
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat()
    }

@app.post("/documents/{case_id}/feedback")
async def submit_feedback(case_id: str, feedback: dict):
    """Submit human feedback for a case document"""
    # Edge case: Validate case_id
    if not case_id or not isinstance(case_id, str) or len(case_id.strip()) == 0:
        raise HTTPException(status_code=400, detail="Invalid case_id")
    
    # Edge case: Validate feedback
    if not feedback or not isinstance(feedback, dict):
        raise HTTPException(status_code=400, detail="Invalid feedback data")
    
    print(f"Received feedback for case {case_id}: {feedback}")
    
    # Handle case where document might not exist yet (create it)
    if case_id not in case_documents:
        print(f"Case {case_id} not found in documents, creating new entry")
        # Create a minimal document entry
        case_documents[case_id] = CaseDocument(
            case_id=case_id,
            original_document={},
            version=1,
            current_status="pending_review",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
    
    doc = case_documents[case_id]
    
    # Convert feedback dict to HumanFeedback model
    try:
        if isinstance(feedback, dict):
            feedback_obj = HumanFeedback(
                case_id=case_id,
                feedback_items=feedback.get("feedback_items", []),
                reviewer_notes=feedback.get("reviewer_notes", ""),
                approval_status=feedback.get("approval_status", "pending"),
                timestamp=datetime.fromisoformat(feedback.get("timestamp", datetime.now().isoformat())) if isinstance(feedback.get("timestamp"), str) else datetime.now()
            )
        else:
            feedback_obj = feedback
    except Exception as e:
        print(f"Error creating feedback object: {e}")
        # Create a basic feedback object
        feedback_obj = HumanFeedback(
            case_id=case_id,
            feedback_items=feedback.get("feedback_items", []) if isinstance(feedback, dict) else [],
            reviewer_notes=feedback.get("reviewer_notes", "") if isinstance(feedback, dict) else "",
            approval_status=feedback.get("approval_status", "pending") if isinstance(feedback, dict) else "pending",
            timestamp=datetime.now()
        )
    
    # Add feedback to history
    doc.feedback_history.append(feedback_obj)
    
    # Update status based on approval
    doc.current_status = feedback_obj.approval_status
    
    # Process feedback items to modify document
    if feedback_obj.approval_status in ["approved", "needs_revision"] and feedback_obj.feedback_items:
        doc.modified_document = process_feedback(
            doc.original_document,
            feedback_obj.feedback_items,
            doc.version
        )
        doc.version += 1
    
    doc.updated_at = datetime.now()
    
    print(f"Feedback processed successfully for case {case_id}, status: {feedback_obj.approval_status}")
    
    return {
        "status": "feedback_received",
        "case_id": case_id,
        "approval_status": feedback_obj.approval_status,
        "version": doc.version,
        "message": "Feedback successfully processed"
    }

@app.post("/documents/{case_id}/approve")
async def approve_document(case_id: str, approved: bool = True):
    """Approve a document and mark as ready for Agent 3"""
    if case_id not in case_documents:
        raise HTTPException(status_code=404, detail="Case not found")
    
    doc = case_documents[case_id]
    doc.current_status = "approved" if approved else "rejected"
    doc.updated_at = datetime.now()
    
    return {
        "status": "approved" if approved else "rejected",
        "case_id": case_id,
        "version": doc.version,
        "message": "Document approval updated"
    }

@app.get("/documents/{case_id}/history")
async def get_feedback_history(case_id: str):
    """Get all feedback history for a case"""
    if case_id not in case_documents:
        raise HTTPException(status_code=404, detail="Case not found")
    
    return {
        "case_id": case_id,
        "feedback_history": [
            {
                "timestamp": feedback.timestamp,
                "approval_status": feedback.approval_status,
                "reviewer_notes": feedback.reviewer_notes,
                "items_count": len(feedback.feedback_items),
                "items": [item.model_dump() for item in feedback.feedback_items]
            }
            for feedback in case_documents[case_id].feedback_history
        ]
    }

@app.get("/documents")
async def list_documents(status: Optional[str] = None):
    """List all documents with optional status filter"""
    documents = []
    for case_id, doc in case_documents.items():
        if not status or doc.current_status == status:
            documents.append({
                "case_id": doc.case_id,
                "status": doc.current_status,
                "version": doc.version,
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat()
            })
    
    return {"documents": documents, "total": len(documents)}

def process_feedback(original: Dict[str, Any], feedback_items: List[FeedbackItem], version: int) -> Dict[str, Any]:
    """Process feedback items to create modified document"""
    modified = original.copy()
    
    for item in feedback_items:
        if item.feedback_type == "add":
            if item.section not in modified:
                modified[item.section] = []
            if isinstance(modified[item.section], list):
                modified[item.section].append(item.content)
        elif item.feedback_type == "edit":
            modified[item.section] = item.content
        elif item.feedback_type == "delete":
            if item.section in modified:
                del modified[item.section]
    
    modified["_metadata"] = {
        "modified_version": version + 1,
        "last_modified": datetime.now().isoformat(),
        "feedback_applied": len(feedback_items)
    }
    
    return modified

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)


