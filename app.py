import os
import time
from flask import Flask, jsonify, request, send_from_directory
import requests

app = Flask(__name__, static_folder="static")

env_file = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

DEFAULT_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"


@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify({
        "groq_default_key": os.environ.get("GROQ_DEFAULT_KEY", ""),
        "groq_default_model": "qwen/qwen3.8-27b"
    })



def call_openai_compatible_api(endpoint_url, api_key, model, messages, temperature=0.4, top_p=0.9):
    """Calls any OpenAI-compatible chat completion API endpoint."""
    headers = {
        "Content-Type": "application/json",
    }
    if api_key and api_key.strip().lower() != "local":
        headers["Authorization"] = f"Bearer {api_key.strip()}"

    if "openrouter.ai" in endpoint_url:
        headers["HTTP-Referer"] = "http://localhost:8000"
        headers["X-Title"] = "Signature AI Workbench"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": float(temperature),
        "top_p": float(top_p)
    }

    res = requests.post(endpoint_url, headers=headers, json=payload, timeout=45)
    res_json = res.json()

    if res.status_code != 200:
        error_msg = res_json.get("error", {}).get("message") or res_json.get("detail") or res_json.get("message") or f"HTTP Error {res.status_code}"
        raise ValueError(f"API Error ({res.status_code}): {error_msg}")

    return res_json["choices"][0]["message"]["content"]


@app.route("/api/build-persona", methods=["POST"])
def build_persona():
    """Generates a professional 3-sentence system directive using the configured OpenAI-compatible API."""
    data = request.json or {}
    description = data.get("user_description", "").strip()
    api_key = data.get("api_key", "").strip()
    base_url = data.get("base_url", "").strip() or DEFAULT_OPENAI_URL
    model = data.get("model", "").strip() or DEFAULT_MODEL

    if not api_key and "localhost" not in base_url and "127.0.0.1" not in base_url:
        return jsonify({"error": "API Key is required in Settings."}), 400
    if not description:
        return jsonify({"error": "Description is required."}), 400

    meta_prompt = (
        "You are an expert system prompt engineer. Expand the user's role description "
        "into a professional 3-sentence system directive. Specify expertise, tone, "
        "and strict rules for technical responses."
    )
    messages = [
        {"role": "system", "content": meta_prompt},
        {"role": "user", "content": description}
    ]

    try:
        expanded = call_openai_compatible_api(base_url, api_key, model, messages, temperature=0.3, top_p=0.9)
        return jsonify({"expanded_persona": expanded.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    """Processes chat requests for any OpenAI-compatible API."""
    data = request.json or {}
    message = data.get("message", "").strip()
    context_data = data.get("context_data", "").strip()
    system_prompt = data.get("system_prompt", "").strip()
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

    if not system_prompt:
        system_prompt = "You are a helpful, precise technical AI assistant."

    final_user_content = message
    if context_data:
        final_user_content = (
            f"[SYSTEM CONTEXT ENVELOPE]\n"
            f"DATA / CODE UNDER TEST:\n```\n{context_data}\n```\n"
            f"--------------------------------------------------\n"
            f"USER DIRECTIVE: {message}"
        )

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
        ai_reply = call_openai_compatible_api(base_url, api_key, model, messages, temperature=temperature, top_p=top_p)
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


@app.route("/")
def serve_index():
    return send_from_directory("static", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory("static", path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 6769))
    app.run(host="0.0.0.0", port=port, debug=True)
