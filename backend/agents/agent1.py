"""
Agent 1: Case Analyzer
Multimodal evidence processing and structured document generation
REAL FILE PROCESSING WITH OPENAI API
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import json
import base64
import io
import re
from datetime import datetime
import tempfile

app = FastAPI(title="Agent 1 - Case Analyzer")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set OpenAI API Key (hardcoded - same as agent3)
OPENAI_API_KEY = "sk-i6oD0lB6SZmxYYAB9PoEQipoCdqUnUMG1QOkDRGAvNnl1y3D"

# Try to import OpenAI
try:
    from openai import OpenAI
    client = OpenAI(
        api_key=OPENAI_API_KEY,
        base_url="https://api.chatanywhere.tech/v1"
    )
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    client = None
    print("Warning: openai not installed. Install with: pip install openai")

# Try to import file processing libraries
try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("Warning: PyPDF2 not installed. Install with: pip install PyPDF2")

try:
    from docx import Document
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("Warning: python-docx not installed. Install with: pip install python-docx")

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    print("Warning: Pillow not available")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    print("Warning: pytesseract not available (optional for OCR)")

# Try to import InLegalBERT helper
try:
    from inlegalbert_helper import analyze_with_inlegalbert, initialize_models as init_inlegalbert
    INLEGALBERT_AVAILABLE = True
    # Initialize models on import
    init_inlegalbert()
except ImportError:
    INLEGALBERT_AVAILABLE = False
    print("Warning: InLegalBERT helper not available. Install transformers, torch, and faiss-cpu for precedent search.")
except Exception as e:
    INLEGALBERT_AVAILABLE = False
    print(f"Warning: InLegalBERT initialization failed: {e}")

class CaseAnalysisRequest(BaseModel):
    case_id: Optional[str] = None

@app.get("/health")
async def health():
    return {
        "status": "ok", 
        "service": "agent1",
        "openai_enabled": bool(OPENAI_API_KEY) and OPENAI_AVAILABLE,
        "pdf_available": PDF_AVAILABLE,
        "docx_available": DOCX_AVAILABLE,
        "inlegalbert_enabled": INLEGALBERT_AVAILABLE
    }

async def extract_text_from_pdf(file_content: bytes) -> str:
    """Extract text from PDF file"""
    if not PDF_AVAILABLE:
        print("WARNING: PDF processing not available. Install PyPDF2.")
        return "PDF processing not available. Install PyPDF2."
    
    try:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        page_count = len(pdf_reader.pages)
        print(f"Extracting text from PDF with {page_count} pages...")
        
        for i, page in enumerate(pdf_reader.pages):
            try:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            except Exception as e:
                print(f"Warning: Error extracting page {i+1}: {e}")
                continue
        
        extracted_text = text.strip()
        print(f"Extracted {len(extracted_text)} characters from PDF")
        
        if len(extracted_text) < 10:
            print("WARNING: Very little text extracted from PDF. It may be scanned/image-based.")
            return f"PDF extracted but minimal text found ({len(extracted_text)} chars). PDF may be image-based and require OCR."
        
        return extracted_text
    except Exception as e:
        print(f"Error extracting PDF text: {str(e)}")
        import traceback
        traceback.print_exc()
        return f"Error extracting PDF text: {str(e)}"

async def extract_text_from_docx(file_content: bytes) -> str:
    """Extract text from DOCX file"""
    if not DOCX_AVAILABLE:
        return "DOCX processing not available. Install python-docx."
    
    try:
        docx_file = io.BytesIO(file_content)
        doc = Document(docx_file)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return text.strip()
    except Exception as e:
        return f"Error extracting DOCX text: {str(e)}"

async def analyze_image_with_openai(image_content: bytes, mime_type: str) -> dict:
    """Analyze image using OpenAI Vision API and extract structured legal information"""
    if not OPENAI_AVAILABLE or not client:
        print("OpenAI API not available for image analysis")
        return {"error": "OpenAI API not available"}
    
    try:
        # Convert image to base64 for OpenAI
        import base64
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        
        # Determine image format
        image_format = "png" if "png" in mime_type else "jpeg"
        image_url = f"data:image/{image_format};base64,{image_base64}"
        
        print(f"Analyzing image with OpenAI Vision API (size: {len(image_content)} bytes)")
        
        prompt = """You are a legal document analyst. Analyze this image and extract ALL relevant legal information in JSON format.

Extract and return ONLY valid JSON with this exact structure:

{
    "key_facts": ["Specific fact 1 from image", "Specific fact 2 from image", ...],
    "entities": {
        "people": [{"name": "Full Name if visible", "role": "their role/position if identifiable"}, ...],
        "organizations": [{"name": "Organization Name if visible", "type": "Company/Government/etc"}, ...],
        "locations": [{"name": "Location Name if visible", "type": "Address/City/State"}, ...]
    },
    "timeline": [
        {"date": "YYYY-MM-DD if visible", "time": "HH:MM if visible", "event": "What is shown/described", "importance": "high/medium/low"},
        ...
    ],
    "legal_issues": [
        {"issue": "Specific legal issue visible/mentioned", "severity": "high/medium/low", "description": "Detailed description"},
        ...
    ],
    "summary": "Comprehensive 2-3 sentence summary of what the image shows and its legal relevance",
    "text_extracted": "All visible text extracted from the image (OCR)",
    "objects_detected": ["Object 1", "Object 2", ...]
}

CRITICAL REQUIREMENTS:
1. Extract ALL visible text using OCR
2. Identify actual people, organizations, locations mentioned or shown
3. Extract dates, timestamps if visible
4. Identify legal documents, evidence, or relevant items shown
5. Base everything on what you actually see in the image
6. Return ONLY valid JSON, no other text

Return ONLY valid JSON:"""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using vision-capable model
            messages=[
                {"role": "system", "content": "You are a legal document analyst. Always return valid JSON."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            max_tokens=2000
        )
        
        analysis_text = response.choices[0].message.content.strip()
        
        print(f"OpenAI Vision response length: {len(analysis_text)} chars")
        
        # Try to parse JSON from response
        try:
            # Extract JSON if wrapped in markdown
            if "```json" in analysis_text:
                json_start = analysis_text.find("```json") + 7
                json_end = analysis_text.find("```", json_start)
                analysis_text = analysis_text[json_start:json_end].strip()
            elif "```" in analysis_text:
                json_start = analysis_text.find("```") + 3
                json_end = analysis_text.find("```", json_start)
                analysis_text = analysis_text[json_start:json_end].strip()
            
            analysis = json.loads(analysis_text)
            print(f"Successfully extracted from image: {len(analysis.get('key_facts', []))} facts, {len(analysis.get('legal_issues', []))} issues")
            return analysis
        except json.JSONDecodeError as e:
            print(f"JSON parsing error for image: {e}")
            # Extract text from response for fallback
            text_from_image = analysis_text[:1000]
            
            # Use fallback extraction on the text extracted from image
            fallback = await extract_basic_info_from_text(text_from_image, "image")
            fallback["text_extracted"] = text_from_image
            fallback["image_analysis_raw"] = analysis_text[:500]
            return fallback
    except Exception as e:
        print(f"OpenAI image analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"OpenAI analysis failed: {str(e)}", "fallback": "Image processing attempted"}

async def extract_basic_info_from_text(text: str, file_type: str) -> dict:
    """Extract basic information from text when OpenAI is unavailable"""
    print("Using fallback text extraction (OpenAI unavailable or failed)")
    
    key_facts = []
    entities = {"people": [], "organizations": [], "locations": []}
    timeline = []
    legal_issues = []
    
    # Extract sentences as potential facts (first 20 sentences)
    sentences = re.split(r'[.!?]+', text)
    for sentence in sentences[:20]:
        sentence = sentence.strip()
        if len(sentence) > 20 and len(sentence) < 300:
            key_facts.append(sentence)
    
    # Extract potential names (capitalized words that might be names)
    # Look for patterns like "John Doe", "Mr. Smith", etc.
    name_pattern = r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b'
    potential_names = re.findall(name_pattern, text)
    for name in set(potential_names[:10]):
        if len(name.split()) <= 3:  # Reasonable name length
            entities["people"].append({"name": name, "role": "mentioned in document"})
    
    # Extract dates (various formats)
    date_patterns = [
        r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',  # MM/DD/YYYY or DD/MM/YYYY
        r'\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b',  # Month Day, Year
        r'\b\d{4}-\d{2}-\d{2}\b'  # YYYY-MM-DD
    ]
    
    dates_found = []
    for pattern in date_patterns:
        dates_found.extend(re.findall(pattern, text, re.IGNORECASE))
    
    # Create timeline entries from dates found
    for i, date in enumerate(set(dates_found[:10])):
        timeline.append({
            "date": str(date),
            "time": "",
            "event": f"Event mentioned in document",
            "importance": "medium"
        })
    
    # Extract potential legal issues (look for keywords)
    legal_keywords = ['violation', 'breach', 'crime', 'illegal', 'fraud', 'negligence', 
                      'contract', 'lawsuit', 'liability', 'damages', 'evidence', 'witness',
                      'testimony', 'allegation', 'charge', 'conviction', 'sentence']
    
    sentences_lower = text.lower()
    for keyword in legal_keywords:
        if keyword in sentences_lower:
            # Find the sentence containing the keyword
            for sentence in sentences:
                if keyword.lower() in sentence.lower() and len(sentence) > 30:
                    legal_issues.append({
                        "issue": f"Potential {keyword} issue identified",
                        "severity": "medium",
                        "description": sentence[:200]
                    })
                    break
    
    # Generate summary from first few sentences
    summary = " ".join(sentences[:3])[:300] if sentences else f"Document processed: {file_type}"
    
    return {
        "key_facts": key_facts[:15],
        "entities": entities,
        "timeline": timeline[:10],
        "legal_issues": legal_issues[:5],
        "summary": summary
    }

async def analyze_text_with_openai(text: str, file_type: str) -> dict:
    """Analyze text content using OpenAI for legal extraction"""
    if not OPENAI_AVAILABLE or not client:
        print("OpenAI API not available for text analysis, using fallback extraction")
        # Use fallback extraction when OpenAI is not available
        fallback_result = await extract_basic_info_from_text(text, file_type)
        fallback_result["error"] = "OpenAI API not available"
        fallback_result["fallback_used"] = True
        return fallback_result
    
    try:
        # Limit text to avoid token limits (keep it reasonable)
        text_sample = text[:12000] if len(text) > 12000 else text
        
        prompt = f"""You are a legal document analyst. Analyze this document and extract ALL relevant legal information.

DOCUMENT CONTENT:
{text_sample}

Extract and return ONLY valid JSON with this exact structure:

{{
    "key_facts": ["Specific fact 1", "Specific fact 2", "Specific fact 3", ...],
    "entities": {{
        "people": [{{"name": "Full Name", "role": "their role/position"}}, ...],
        "organizations": [{{"name": "Organization Name", "type": "Company/Government/Legal Firm/etc"}}, ...],
        "locations": [{{"name": "Location Name", "type": "Address/City/State/Country"}}, ...]
    }},
    "timeline": [
        {{"date": "YYYY-MM-DD", "time": "HH:MM", "event": "What happened", "importance": "high/medium/low"}},
        ...
    ],
    "legal_issues": [
        {{"issue": "Specific legal issue name", "severity": "high/medium/low", "description": "Detailed description of the issue"}},
        ...
    ],
    "summary": "Comprehensive 2-3 sentence summary of the document's legal content"
}}

CRITICAL REQUIREMENTS:
1. Extract REAL facts from the document text - do not make up generic facts
2. Identify actual people, organizations, and locations mentioned
3. Extract dates and events to build timeline
4. Identify actual legal issues, violations, or problems mentioned
5. Base everything on the actual document content provided
6. Return ONLY the JSON, no other text

Return ONLY valid JSON:"""
        
        print(f"Calling OpenAI API for text analysis (text length: {len(text)} chars)")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a legal document analyst. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        response_text = response.choices[0].message.content.strip()
        
        print(f"OpenAI response length: {len(response_text)} chars")
        
        # Clean JSON response
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        # Remove any leading/trailing whitespace
        response_text = response_text.strip()
        
        # Parse JSON
        try:
            extracted = json.loads(response_text)
            print(f"Successfully extracted: {len(extracted.get('key_facts', []))} facts, {len(extracted.get('legal_issues', []))} issues")
            return extracted
        except json.JSONDecodeError as e:
            print(f"JSON parsing error: {e}")
            print(f"Response preview: {response_text[:300]}")
            print("Falling back to basic text extraction...")
            
            # Use fallback extraction when JSON parsing fails
            fallback_result = await extract_basic_info_from_text(text, file_type)
            fallback_result["json_parse_error"] = True
            fallback_result["openai_response"] = response_text[:500]
            return fallback_result
    except Exception as e:
        print(f"OpenAI analysis error: {str(e)}")
        import traceback
        traceback.print_exc()
        print("Falling back to basic text extraction...")
        
        # Use fallback extraction when OpenAI fails
        fallback_result = await extract_basic_info_from_text(text, file_type)
        fallback_result["error"] = f"OpenAI analysis failed: {str(e)}"
        fallback_result["fallback_used"] = True
        return fallback_result

async def process_file(file: UploadFile, case_id: str) -> dict:
    """Process a single uploaded file"""
    content = await file.read()
    file_type = file.content_type or "application/octet-stream"
    file_name = file.filename or "unknown"
    
    print(f"Processing file: {file_name}, type: {file_type}, size: {len(content)} bytes")
    
    result = {
        "file_name": file_name,
        "file_type": file_type,
        "file_size": len(content),
        "processed": False
    }
    
    extracted_text = ""
    
    # Process based on file type
    if file_type == "application/pdf":
        extracted_text = await extract_text_from_pdf(content)
        try:
            if PDF_AVAILABLE:
                pdf_file = io.BytesIO(content)
                pdf_reader = PyPDF2.PdfReader(pdf_file)
                result["pages"] = len(pdf_reader.pages)
            else:
                result["pages"] = 0
        except:
            result["pages"] = 0
        result["type"] = "pdf"
        print(f"PDF extraction result: {len(extracted_text)} chars extracted")
        
    elif file_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", 
                       "application/msword"]:
        extracted_text = await extract_text_from_docx(content)
        result["type"] = "document"
        
    elif file_type.startswith("text/"):
        try:
            extracted_text = content.decode('utf-8')
        except:
            extracted_text = content.decode('latin-1', errors='ignore')
        result["type"] = "text"
        
    elif file_type.startswith("image/"):
        # Analyze image with OpenAI Vision
        print(f"Processing image: {file_name}")
        image_analysis = await analyze_image_with_openai(content, file_type)
        result["type"] = "image"
        result["image_analysis"] = image_analysis
        
        # Extract structured data from image analysis
        if "key_facts" in image_analysis:
            # Image analysis already has structured data
            result["analysis"] = image_analysis
            extracted_text = image_analysis.get("text_extracted", "") or image_analysis.get("summary", f"Image analyzed: {file_name}")
        elif "full_analysis" in image_analysis:
            extracted_text = image_analysis["full_analysis"]
        elif "description" in image_analysis:
            extracted_text = image_analysis["description"]
        else:
            extracted_text = f"Image analyzed: {file_name}"
        
        result["objects_detected"] = image_analysis.get("objects_detected", [])
        result["text_extracted"] = image_analysis.get("text_extracted", "")
        
        # If image analysis has structured data, mark as processed
        if "key_facts" in image_analysis:
            result["processed"] = True
            print(f"Image analysis complete with {len(image_analysis.get('key_facts', []))} facts extracted")
        
    elif file_type.startswith("audio/"):
        result["type"] = "audio"
        extracted_text = f"Audio file: {file_name}. Audio transcription requires Whisper API integration."
        result["note"] = "Audio transcription not yet implemented"
        
    elif file_type.startswith("video/"):
        result["type"] = "video"
        extracted_text = f"Video file: {file_name}. Video analysis requires video processing integration."
        result["note"] = "Video processing not yet implemented"
        
    else:
        # Try to extract as text
        try:
            extracted_text = content.decode('utf-8')
        except:
            extracted_text = f"Unsupported file type: {file_type}"
        result["type"] = "unknown"
    
    # Analyze extracted text with OpenAI (skip if already processed from image)
    if not result.get("processed", False) and extracted_text and len(extracted_text.strip()) > 10:
        print(f"Analyzing {len(extracted_text)} chars of text with OpenAI...")
        analysis = await analyze_text_with_openai(extracted_text, file_type)
        result["analysis"] = analysis
        result["extracted_text_preview"] = extracted_text[:500]
        result["processed"] = True
        
        # Validate analysis has required fields
        if "key_facts" not in analysis:
            print(f"WARNING: Analysis missing 'key_facts', adding fallback")
            analysis["key_facts"] = [f"Content extracted from {file_name}"]
        if "entities" not in analysis:
            print(f"WARNING: Analysis missing 'entities', adding fallback")
            analysis["entities"] = {"people": [], "organizations": [], "locations": []}
        if "legal_issues" not in analysis:
            print(f"WARNING: Analysis missing 'legal_issues', adding fallback")
            analysis["legal_issues"] = []
        if "timeline" not in analysis:
            print(f"WARNING: Analysis missing 'timeline', adding fallback")
            analysis["timeline"] = []
        if "summary" not in analysis:
            print(f"WARNING: Analysis missing 'summary', adding fallback")
            analysis["summary"] = f"Document processed: {file_name}"
        
        # Run InLegalBERT analysis for NER and precedent retrieval
        if INLEGALBERT_AVAILABLE and extracted_text:
            try:
                print(f"Running InLegalBERT analysis (NER + precedent search)...")
                inlegalbert_result = analyze_with_inlegalbert(extracted_text, top_k_precedents=5)
                if inlegalbert_result.get("inlegalbert_available"):
                    result["inlegalbert_analysis"] = {
                        "ner": inlegalbert_result.get("ner", []),
                        "precedents": inlegalbert_result.get("precedents", []),
                        "embedding_dim": inlegalbert_result.get("embedding_dim", 0),
                        "precedents_found": len(inlegalbert_result.get("precedents", []))
                    }
                    print(f"✅ InLegalBERT: Found {len(inlegalbert_result.get('precedents', []))} precedents, {len(inlegalbert_result.get('ner', []))} NER tokens")
                else:
                    result["inlegalbert_analysis"] = {
                        "error": "InLegalBERT models not available",
                        "ner": [],
                        "precedents": []
                    }
            except Exception as e:
                print(f"⚠️ InLegalBERT analysis failed: {e}")
                result["inlegalbert_analysis"] = {
                    "error": str(e),
                    "ner": [],
                    "precedents": []
                }
            
    elif not result.get("processed", False):
        print(f"WARNING: Insufficient text extracted ({len(extracted_text) if extracted_text else 0} chars)")
        result["analysis"] = {
            "key_facts": [f"File processed: {file_name}"],
            "entities": {"people": [], "organizations": [], "locations": []},
            "timeline": [],
            "legal_issues": [],
            "summary": f"File {file_name} of type {file_type} was uploaded. Text extraction may have failed."
        }
        result["processed"] = True
    
    return result

@app.post("/analyze")
async def analyze_case(
    case_id: Optional[str] = Form(None),
    files: List[UploadFile] = File(...)
):
    """Analyze a case with real uploaded files"""
    try:
        case_id = case_id or f"case_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        print(f"Analyzing case {case_id} with {len(files)} files")
        
        # Validate files were received
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="No files provided")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_case endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error parsing request: {str(e)}")
    
    # Process all files
    processed_files = []
    all_key_facts = []
    all_entities = {"people": [], "organizations": [], "locations": []}
    all_timeline = []
    all_legal_issues = []
    summaries = []
    # InLegalBERT results aggregation
    all_precedents = []
    all_ner_tokens = []
    
    for file in files:
        try:
            file_result = await process_file(file, case_id)
            processed_files.append(file_result)
            
            # Aggregate analysis results
            if "analysis" in file_result:
                analysis = file_result["analysis"]
                
                # Check for errors first
                if "error" in analysis:
                    print(f"Warning: Analysis error for {file_result['file_name']}: {analysis.get('error', 'Unknown error')}")
                    # Still try to use what we have
                
                # Extract key facts
                if "key_facts" in analysis and isinstance(analysis["key_facts"], list):
                    facts = [f for f in analysis["key_facts"] if f and isinstance(f, str)]
                    all_key_facts.extend(facts)
                    print(f"Added {len(facts)} facts from {file_result['file_name']}")
                
                # Extract entities
                if "entities" in analysis and isinstance(analysis["entities"], dict):
                    for entity_type in ["people", "organizations", "locations"]:
                        if entity_type in analysis["entities"] and isinstance(analysis["entities"][entity_type], list):
                            entities = [e for e in analysis["entities"][entity_type] if e]
                            all_entities[entity_type].extend(entities)
                            print(f"Added {len(entities)} {entity_type} from {file_result['file_name']}")
                
                # Extract timeline
                if "timeline" in analysis and isinstance(analysis["timeline"], list):
                    events = [e for e in analysis["timeline"] if e]
                    all_timeline.extend(events)
                    print(f"Added {len(events)} timeline events from {file_result['file_name']}")
                
                # Extract legal issues
                if "legal_issues" in analysis and isinstance(analysis["legal_issues"], list):
                    issues = [i for i in analysis["legal_issues"] if i]
                    all_legal_issues.extend(issues)
                    print(f"Added {len(issues)} legal issues from {file_result['file_name']}")
                
                # Extract summary
                if "summary" in analysis and isinstance(analysis["summary"], str) and analysis["summary"].strip():
                    summaries.append(analysis["summary"])
                    print(f"Added summary from {file_result['file_name']}")
            
            # Extract InLegalBERT results if available
            if "inlegalbert_analysis" in file_result:
                inlegalbert = file_result["inlegalbert_analysis"]
                # Aggregate precedents
                if "precedents" in inlegalbert and isinstance(inlegalbert["precedents"], list):
                    all_precedents.extend(inlegalbert["precedents"])
                    print(f"Added {len(inlegalbert['precedents'])} precedents from {file_result['file_name']}")
                # Aggregate NER tokens
                if "ner" in inlegalbert and isinstance(inlegalbert["ner"], list):
                    all_ner_tokens.extend(inlegalbert["ner"])
            
            summaries.append(f"Processed {file_result['file_name']} ({file_result['type']})")
            
        except Exception as e:
            print(f"Error processing file {file.filename}: {str(e)}")
            processed_files.append({
                "file_name": file.filename,
                "error": str(e),
                "processed": False
            })
    
    # Deduplicate entities
    seen_people = {}
    for person in all_entities["people"]:
        if isinstance(person, dict):
            name = person.get("name", "").lower()
        else:
            name = str(person).lower()
        if name and name not in seen_people:
            seen_people[name] = person
    
    seen_orgs = {}
    for org in all_entities["organizations"]:
        if isinstance(org, dict):
            name = org.get("name", "").lower()
        else:
            name = str(org).lower()
        if name and name not in seen_orgs:
            seen_orgs[name] = org
    
    seen_locs = {}
    for loc in all_entities["locations"]:
        if isinstance(loc, dict):
            name = loc.get("name", "").lower()
        else:
            name = str(loc).lower()
        if name and name not in seen_locs:
            seen_locs[name] = loc
    
    all_entities = {
        "people": list(seen_people.values()),
        "organizations": list(seen_orgs.values()),
        "locations": list(seen_locs.values())
    }
                
    # Generate comprehensive case summary
    case_summary = f"""
    Case Analysis Summary for {case_id}
    
    This case involves analysis of {len(files)} evidence file(s).
    {' '.join(summaries[:3])}
    
    Key Facts Extracted: {len(all_key_facts)} facts identified
    Entities Identified: {len(all_entities['people'])} people, {len(all_entities['organizations'])} organizations, {len(all_entities['locations'])} locations
    Legal Issues: {len(all_legal_issues)} issues identified
    Timeline Events: {len(all_timeline)} events extracted
    
    All evidence has been processed using AI-powered analysis to extract legally relevant information.
    """
    
    # Print summary of extracted data
    print(f"\n=== Extraction Summary ===")
    print(f"Key Facts: {len(all_key_facts)}")
    print(f"Entities - People: {len(all_entities['people'])}, Orgs: {len(all_entities['organizations'])}, Locations: {len(all_entities['locations'])}")
    print(f"Timeline Events: {len(all_timeline)}")
    print(f"Legal Issues: {len(all_legal_issues)}")
    print(f"Summaries: {len(summaries)}")
    print("========================\n")
    
    # Ensure we have at least some data
    if not all_key_facts:
        all_key_facts = [f"Evidence files processed: {len(files)} files"]
        print("Warning: No key facts extracted - using fallback")
    
    if not all_legal_issues:
        all_legal_issues = [{
            "issue": "Case evidence analysis",
            "severity": "medium",
            "description": "Evidence files have been processed and analyzed. Review extracted information for legal issues."
        }]
        print("Warning: No legal issues extracted - using fallback")
    
    # Deduplicate precedents by case_id
    seen_precedents = {}
    for prec in all_precedents:
        case_id_prec = prec.get("case_id", "")
        if case_id_prec and case_id_prec not in seen_precedents:
            seen_precedents[case_id_prec] = prec
        elif not case_id_prec:
            # If no case_id, use text hash
            text_hash = hash(prec.get("text", ""))
            if text_hash not in seen_precedents:
                seen_precedents[text_hash] = prec
    
    unique_precedents = list(seen_precedents.values())
    # Sort by similarity score (higher is better)
    unique_precedents.sort(key=lambda x: x.get("similarity_score", 0), reverse=True)
    
    # Update case summary to include InLegalBERT results
    if unique_precedents:
        case_summary += f"\n    Precedents Found: {len(unique_precedents)} similar legal precedents identified using InLegalBERT."
    
    return {
        "case_id": case_id,
        "case_summary": case_summary.strip(),
        "key_facts": all_key_facts[:20],  # Limit to top 20
        "evidence_analysis": {
            "files_processed": len(processed_files),
            "files": processed_files
        },
        "entities": all_entities,
        "timeline": sorted(all_timeline, key=lambda x: x.get("date", ""))[:20],  # Sort by date
        "legal_issues_identified": all_legal_issues[:10],  # Top 10 issues
        "inlegalbert_results": {
            "precedents": unique_precedents[:10],  # Top 10 precedents
            "total_precedents": len(unique_precedents),
            "ner_tokens_count": len(all_ner_tokens),
            "enabled": INLEGALBERT_AVAILABLE
        },
        "analysis_timestamp": datetime.now().isoformat()
    }

@app.post("/analyze/file")
async def analyze_file(file: UploadFile = File(...), case_id: Optional[str] = Form(None)):
    """Analyze a single file"""
    result = await process_file(file, case_id or f"case_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
