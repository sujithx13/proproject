# Signature AI Workbench 🛡️

**Signature AI** is a lightweight, full-stack developer workbench designed for context-aware AI interaction, security auditing, multi-LLM prototyping, and code debugging. Built with a **Python Flask** backend and a **Vanilla HTML5/CSS3/JS** frontend, it features dynamic persona synthesis, context-injection envelopes, multi-provider model selection, real-time performance telemetry, and single-click Markdown report exports.

---

## ⚡ Key Features

* **Multi-Provider AI Support:** Integrates seamlessly with **Groq Cloud**, **OpenRouter AI**, **NVIDIA NIM**, **OpenAI (GPT)**, **Anthropic Claude**, **Google Gemini**, and **Opencode / Custom Local Endpoints (Ollama/vLLM)**.
* **Dynamic Persona Synthesizer:** Expand raw role descriptions into concise, professional 3-sentence system prompt directives using LLM meta-prompting.
* **Context Injection Envelopes:** Attach raw code snippets, server logs, or JSON payloads into a structured evaluation envelope before sending queries.
* **Multi-Turn Dialogue Memory:** Remembers conversation history across follow-up queries for deep debugging sessions.
* **Code Block Actions:** 1-click **Copy Code** button overlays on all AI code snippets with syntax highlighting.
* **Per-Provider API Key Caching:** Automatically caches API keys per provider in browser `localStorage`.
* **Real-Time Session Telemetry:** Measures round-trip latency in milliseconds (`⚡ ms`), tracks query counts, and displays live statistics in the sidebar.
* **One-Click Markdown Export:** Downloads structured Markdown (`.md`) audit reports containing telemetry, system directives, and complete conversation transcripts.

---

## 🛠️ Tech Stack

* **Backend:** Python 3, Flask, Requests
* **Frontend:** Vanilla HTML5, CSS3 (Cyber-Dark Glassmorphism Theme), Vanilla JavaScript (ES6)
* **Libraries:** `marked.js` (Markdown parsing), `highlight.js` (Syntax highlighting), Google Fonts (`Outfit` & `Fira Code`)

---

## 🚀 Quickstart & Local Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Run Application
```bash
python app.py
```

### 3. Access Workbench
Open your browser at `http://localhost:8000`. Select your preferred AI provider, paste your API key, and start querying!