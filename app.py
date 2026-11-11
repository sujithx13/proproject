import os
import time
from flask import Flask, jsonify, request, send_from_directory
import requests

# ---------------------------------------------------------------------------
# 1. FLASK APPLICATION INITIALIZATION & CONFIG
# ---------------------------------------------------------------------------
app = Flask(__name__, static_folder="static")

# Load environment variables from local .env if present
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

DEFAULT_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"


# ---------------------------------------------------------------------------
# 2. CORE LLM API PROXY
# ---------------------------------------------------------------------------
def call_openai_compatible_api(endpoint_url, api_key, model, messages, temperature=0.4, top_p=0.9, referer="http://localhost:6767"):
    """
    Sends chat completions request to any OpenAI-compatible API endpoint
    (OpenAI, Groq Cloud, OpenRouter, Ollama, etc.)
    """
    headers = {"Content-Type": "application/json"}
    if api_key and api_key.strip().lower() != "local":
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    if "openrouter.ai" in endpoint_url:
        headers["HTTP-Referer"] = referer
        headers["X-Title"] = "Signature AI Workbench"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": float(temperature),
        "top_p": float(top_p)
    }

    res = requests.post(endpoint_url, headers=headers, json=payload, timeout=45)

    try:
        res_json = res.json()
    except Exception:
        res_json = {}

    if res.status_code != 200:
        err = res_json.get("error")
        error_msg = (
            err.get("message") if isinstance(err, dict)
            else err if isinstance(err, str)
            else res_json.get("detail") or res_json.get("message") or (res.text[:200] if res.text else f"HTTP Error {res.status_code}")
        )
        raise ValueError(f"API Error ({res.status_code}): {error_msg}")

    return res_json["choices"][0]["message"]["content"]


# ---------------------------------------------------------------------------
# 3. BACKEND API ROUTES
# ---------------------------------------------------------------------------
@app.route("/api/config", methods=["GET"])
def get_config():
    """Returns server-level defaults (e.g. testing key and model) without hardcoding secrets."""
    return jsonify({
        "groq_default_key": os.environ.get("GROQ_DEFAULT_KEY", ""),
        "groq_default_model": "qwen/qwen3.8-27b"
    })


@app.route("/api/build-persona", methods=["POST"])
def build_persona():
    """Expands a short role description into a 3-sentence technical directive."""
    data = request.json or {}
    description = data.get("user_description", "").strip()
    api_key = data.get("api_key", "").strip()
    base_url = data.get("base_url", "").strip() or DEFAULT_OPENAI_URL
    model = data.get("model", "").strip() or DEFAULT_MODEL

    if not api_key and "localhost" not in base_url and "127.0.0.1" not in base_url:
        return jsonify({"error": "API Key is required in Settings."}), 400
    if not description:
        return jsonify({"error": "Description is required."}), 400

    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert system prompt engineer. Expand the user's role description "
                "into a professional 3-sentence system directive. Specify expertise, tone, "
                "and strict rules for technical responses."
            )
        },
        {"role": "user", "content": description}
    ]

    try:
        expanded = call_openai_compatible_api(
            base_url, api_key, model, messages, temperature=0.3, top_p=0.9, referer=request.host_url.rstrip('/')
        )
        return jsonify({"expanded_persona": expanded.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """Handles multi-turn AI chat queries with optional attached context envelopes."""
    data = request.json or {}
    message = data.get("message", "").strip()
    context_data = data.get("context_data", "").strip()
    system_prompt = data.get("system_prompt", "").strip() or "You are a helpful, precise technical AI assistant."
    api_key = data.get("api_key", "").strip()
    base_url = data.get("base_url", "").strip() or DEFAULT_OPENAI_URL
    model = data.get("model", "").strip() or DEFAULT_MODEL
    temperature = data.get("temperature", 0.4)
    top_p = data.get("top_p", 0.9)
    max_history = int(data.get("max_history", 10))
    history = data.get("history", [])

    if not api_key and "localhost" not in base_url and "127.0.0.1" not in base_url:
        return jsonify({"error": "API Key is required. Please set your API Key in Settings."}), 400
    if not message:
        return jsonify({"error": "Message content is required."}), 400

    # Build user content (with context envelope if provided)
    final_user_content = message
    if context_data:
        final_user_content = (
            f"[SYSTEM CONTEXT ENVELOPE]\n"
            f"DATA / CODE UNDER TEST:\n```\n{context_data}\n```\n"
            f"--------------------------------------------------\n"
            f"USER DIRECTIVE: {message}"
        )

    # Assemble conversation messages
    messages = [{"role": "system", "content": system_prompt}]
    if isinstance(history, list) and max_history > 0:
        for item in history[-max_history:]:
            role = item.get("role")
            content = item.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": final_user_content})

    start_time = time.time()
    try:
        ai_reply = call_openai_compatible_api(
            base_url, api_key, model, messages, temperature=temperature, top_p=top_p, referer=request.host_url.rstrip('/')
        )
        latency_ms = int((time.time() - start_time) * 1000)
        return jsonify({
            "reply": ai_reply,
            "latency_ms": latency_ms,
            "model": model
        })
    except requests.exceptions.Timeout:
        return jsonify({"error": "Request timed out while waiting for AI response."}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# 4. STATIC FILE SERVING
# ---------------------------------------------------------------------------
@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


# ---------------------------------------------------------------------------
# 5. SERVER ENTRYPOINT
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 6767))
    app.run(host="0.0.0.0", port=port, debug=True)
