import os
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# Use env var if provided; otherwise fall back to the baked-in key so it works out of the box.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyD0ABfEA2_N2yYvSrEnvaMAzCp_y0w2ZNs")
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

app = Flask(__name__)
CORS(app, origins=["http://localhost:8000", "http://127.0.0.1:8000"], supports_credentials=True)


def call_gemini(prompt: str, max_tokens: int = 600, model: str | None = None):
    url = GEMINI_ENDPOINT
    headers = {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json"
    }
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    # Model is already baked into GEMINI_ENDPOINT, ignore model parameter
    resp = requests.post(url, headers=headers, json=body, timeout=20)
    # Return both status and payload to improve error visibility upstream
    data = {}
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}
    if not resp.ok:
        return {"error": "gemini_error", "status": resp.status_code, "payload": data}
    text = (
        (data.get("candidates") or [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text")
    )
    return text or data


@app.route("/api/generate", methods=["POST", "OPTIONS"])
def generate():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    payload = request.get_json(silent=True) or {}
    print(f"[DEBUG] Received payload: {payload}")
    prompt = payload.get("prompt", "")
    max_tokens = int(payload.get("maxTokens", 600) or 600)
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
            return jsonify(result), result.get("status", 502)
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
def fetch_papers():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"}), 200
    payload = request.get_json(silent=True) or {}
    query = payload.get("query", "")
    if not query:
        return jsonify({"error": "Query required"}), 400
    
    # Fetch from arXiv
    try:
        arxiv_url = f"https://export.arxiv.org/api/query?search_query=all:{query}&start=0&max_results=5"
        resp = requests.get(arxiv_url, timeout=10)
        if resp.ok:
            import re
            titles = re.findall(r'<title>([^<]+)</title>', resp.text)
            # Filter out arXiv metadata titles
            papers = [
                {"title": t.strip(), "source": "arXiv"} 
                for t in titles 
                if t.strip().lower() not in ["arxiv query", "arxiv.org", "arxiv"]
                and not t.strip().startswith("arXiv Query:")
            ][:5]
            print(f"[DEBUG] Found {len(papers)} arXiv papers for query: {query}")
            return jsonify({"papers": papers})
    except Exception as e:
        print(f"[ERROR] arXiv fetch failed: {str(e)}")
        return jsonify({"error": "arXiv API error", "details": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
