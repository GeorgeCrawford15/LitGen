import os
import requests
import xml.etree.ElementTree as ET
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from typing import Union, Tuple
from dotenv import load_dotenv

load_dotenv()
FlaskReturn = Union[Response, Tuple[Response, int]]

# Use env var if provided; otherwise fall back to the baked-in key so it works out of the box.
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyD0ABfEA2_N2yYvSrEnvaMAzCp_y0w2ZNs")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not set in environment")

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

#app = Flask(__name__)
#CORS(app, origins=["http://localhost:8000", "http://127.0.0.1:8000"], supports_credentials=True)

app = Flask(__name__)
CORS(
    app, 
    origins=[
        "http://localhost:8000", 
        "http://127.0.0.1:8000", 
        "http://localhost:5500",      # <-- ADD THIS
        "http://127.0.0.1:5500"       # <-- AND THIS
    ], 
    supports_credentials=True
)


def call_gemini(prompt: str, max_tokens: int = 65535, model: str | None = None):
    url = GEMINI_ENDPOINT
    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json"
    }
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }

    print(f"[DEBUG] Full API Key: {GEMINI_API_KEY}")
    # Model is already baked into GEMINI_ENDPOINT, ignore model parameter
    resp = requests.post(url, headers=headers, json=body, timeout=45)

    # Return both status and payload to improve error visibility upstream
    data = {}
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}

    if not resp.ok:
        return {"error": "gemini_error", "status": resp.status_code, "payload": data}

    #text = (
    #    (data.get("candidates") or [{}])[0]
    #    .get("content", {})
    #    .get("parts", [{}])[0]
    #    .get("text")
    #)

    text = None

    candidates = data.get("candidates")
    if candidates and isinstance(candidates, list) and len(candidates) > 0:
        candidate = candidates[0]
        
        # Check if the candidate is a dictionary before accessing 'content'
        if isinstance(candidate, dict):
            content = candidate.get("content")
            
            # Check if content is a dictionary before accessing 'parts'
            if isinstance(content, dict):
                parts = content.get("parts")
                
                if parts and isinstance(parts, list) and len(parts) > 0:
                    part = parts[0]
                    
                    # Check if the part is a dictionary before accessing 'text'
                    if isinstance(part, dict):
                        text = part.get("text")

    return text or data


@app.route("/api/generate", methods=["POST", "OPTIONS"])
def generate() -> FlaskReturn:
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    payload = request.get_json(silent=True) or {}
    print(f"[DEBUG] Received payload: {payload}")

    prompt = payload.get("prompt", "")
    max_tokens = int(payload.get("maxTokens", 65535) or 65535)
    model = payload.get("model")

    if not prompt:
        print("[ERROR] No prompt provided")
        return jsonify({"error": "Prompt required"}), 400

    print(f"[DEBUG] Calling Gemini with prompt: {prompt[:50]}...")
    try:
        result = call_gemini(prompt, max_tokens=max_tokens, model=model)
        print(f"[DEBUG] Gemini result: {str(result)[:100]}")

        if isinstance(result, dict) and result.get("error"):
            print(f"[ERROR] Gemini error: {result}")
            return jsonify(result), int(result.get("status", 502))

        if isinstance(result, str):
            return jsonify({"text": result})

        return jsonify({"output": result})
    except requests.HTTPError as e:
        status = e.response.status_code if e.response else 500
        payload = e.response.text if e.response else str(e)
        print(f"[ERROR] HTTP error: {status} - {payload}")
        return jsonify({"error": "Gemini API error", "details": payload}), status
    except Exception as e:  # pragma: no cover - general fallback
        print(f"[ERROR] Exception: {str(e)}")
        return jsonify({"error": "Server error", "details": str(e)}), 500


@app.route("/api/papers", methods=["POST", "OPTIONS"])
def fetch_papers() -> FlaskReturn:
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200

    payload = request.get_json(silent=True) or {}
    query = payload.get("query", "")

    if not query:
        return jsonify({"error": "Query required"}), 400
    
    # Fetch from arXiv
    try:
        # Increased max_results from 5 to 10
        arxiv_url = f"https://export.arxiv.org/api/query?search_query=all:{query}&start=0&max_results=10"
        resp = requests.get(arxiv_url, timeout=10)

        if resp.ok:
            # Parse Atom XML response
            root = ET.fromstring(resp.content)
            ns = {'atom': 'http://www.w3.org/2005/Atom', 'arxiv': 'http://arxiv.org/schemas/atom'}
            entries = root.findall('atom:entry', ns)
            
            papers = []
            for entry in entries:
                title_elem = entry.find('atom:title', ns)
                id_elem = entry.find('atom:id', ns)
                
                # Find the DOI link
                #doi_elem = entry.find('atom:link[@rel="doi"]', ns)
                #doi = doi_elem.get('href').replace('http://dx.doi.org/', '').replace('https://doi.org/', '') if doi_elem is not None else ""

                # In app.py, inside fetch_papers, replace the DOI extraction line:

                # Find the DOI link
                doi_elem = entry.find('atom:link[@rel="doi"]', ns)
                
                # REVISED LINE: Safely get the href, and only call replace() if it's a string
                href = doi_elem.get('href') if doi_elem is not None else None
                
                if href:
                    # Only proceed with replace chain if href is a non-None string
                    doi = href.replace('http://dx.doi.org/', '').replace('https://doi.org/', '')
                else:
                    doi = ""

                # ... rest of the loop continues ...

                # 1. Safely extract title and check if it exists
                title = title_elem.text.strip().replace('\n', ' ') if title_elem is not None and title_elem.text else None
                
                # 2. Skip this paper if the title is missing
                if title is None or title == "":
                    continue

                # 3. Safely extract link
                link = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
                
                papers.append({"title": title, "source": "arXiv", "link": link, "doi": doi})

            print(f"[DEBUG] Found {len(papers)} arXiv papers for query: {query}")
            return jsonify({"papers": papers})
        
        else: 
            # Handle HTTP errors (4xx/5xx) that don't raise an exception
            print(f"[ERROR] arXiv API returned status: {resp.status_code}")
            return jsonify({
                "error": "arXiv API HTTP error", 
                "status": resp.status_code
            }), resp.status_code

    except Exception as e:
        print(f"[ERROR] arXiv fetch failed: {str(e)}")
        return jsonify({"error": "arXiv API error", "details": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
