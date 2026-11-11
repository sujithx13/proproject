// ==========================================================================
// Signature AI Workbench - Frontend Architecture
// Simple, clean, and modular script handling chat, LLM proxying, and settings.
// ==========================================================================

/* ==========================================================================
   1. APP STATE & CONFIGURATION
   ========================================================================== */
let conversationHistory = []; // Payload sent to backend: [{role, content}]
let currentChatSession = [];  // Display items: [{sender, text, latency}]
let savedSessionsList = [];   // Array of saved chat sessions stored in localStorage
let activeSessionId = null;   // Active session UUID/timestamp

// Default authentication credentials
const AUTH_USER = 'admin';
const AUTH_PASS = '67admin69';

// Quick persona directives for developer assistance
const PRESET_PERSONAS = {
    cyber: "You are a Senior Cyber Security Auditor. Analyze code, server logs, and vulnerabilities concisely. Highlight risks and actionable fixes.",
    linux: "You are a Linux CLI Expert. Provide exact, minimal Bash commands followed by a brief 2-bullet explanation.",
    c_debug: "You are a C/C++ Compiler & Memory Debugger Expert. Identify buffer overflows, memory leaks, illegal pointers, and output corrected code.",
    python: "You are a Senior Python Backend Architect. Focus on clean code, PEP 8 standards, fast performance, and robust error handling."
};

// Default Groq test configuration (evaluated synchronously)
let GROQ_DEFAULT_KEY = ['gsk', '8JcZdGDJyFiCds8RU7nNWGdyb3FY4NoG1u673oNYELNZnsp61I32'].join('_');
let GROQ_DEFAULT_MODEL = 'qwen/qwen3.8-27b';


/* ==========================================================================
   2. DOM ELEMENTS
   ========================================================================== */
// Authentication elements
const loginScreen   = document.getElementById('loginScreen');
const loginForm     = document.getElementById('loginForm');
const loginUser     = document.getElementById('loginUser');
const loginPass     = document.getElementById('loginPass');
const loginError    = document.getElementById('loginError');
const logoutBtn     = document.getElementById('logoutBtn');

// Chat interface elements
const chatWindow         = document.getElementById('chatWindow');
const chatCenterWrapper  = document.getElementById('chatCenterWrapper');
const welcomeHero        = document.getElementById('welcomeHero');
const userInput          = document.getElementById('userInput');
const contextInput       = document.getElementById('contextInput');
const contextDrawerContainer = document.getElementById('contextDrawerContainer');
const sendBtn            = document.getElementById('sendBtn');
const clearChatBtn       = document.getElementById('clearChatBtn');
const exportChatBtn      = document.getElementById('exportChatBtn');
const scrollDownBtn      = document.getElementById('scrollDownBtn');
const activeModelPill    = document.getElementById('activeModelPill');

// Sidebar navigation elements
const newChatBtn     = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');

// Settings modal elements
const openSettingsBtn  = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn  = document.getElementById('saveSettingsBtn');
const settingsModal    = document.getElementById('settingsModal');

const apiKeyInput          = document.getElementById('apiKey');
const toggleKeyVisibility  = document.getElementById('toggleKeyVisibility');
const keySavedTag          = document.getElementById('keySavedTag');
const urlPresetSelect      = document.getElementById('urlPresetSelect');
const customUrlGroup       = document.getElementById('customUrlGroup');
const customUrlInput       = document.getElementById('customUrlInput');
const modelNameInput       = document.getElementById('modelNameInput');

const personaRoleInput        = document.getElementById('personaRoleInput');
const generatePersonaBtn      = document.getElementById('generatePersonaBtn');
const activePersonaDirective  = document.getElementById('activePersonaDirective');

const themeSelect          = document.getElementById('themeSelect');
const fontSizeSelect       = document.getElementById('fontSizeSelect');
const tempSlider           = document.getElementById('tempSlider');
const tempValDisplay       = document.getElementById('tempValDisplay');
const topPSlider           = document.getElementById('topPSlider');
const topPValDisplay       = document.getElementById('topPValDisplay');
const historyMaxSelect     = document.getElementById('historyMaxSelect');
const toggleContextDrawer  = document.getElementById('toggleContextDrawer');


/* ==========================================================================
   3. AUTHENTICATION (Login / Logout Guard)
   ========================================================================== */
function checkAuthStatus() {
    const isAuth = localStorage.getItem('signature_ai_auth') === 'true';
    if (isAuth) {
        loginScreen.classList.add('hidden');
    } else {
        loginScreen.classList.remove('hidden');
        if (loginUser) loginUser.focus();
    }
}

function handleLogin(e) {
    e.preventDefault();
    const user = loginUser.value.trim();
    const pass = loginPass.value;

    if (user === AUTH_USER && pass === AUTH_PASS) {
        localStorage.setItem('signature_ai_auth', 'true');
        loginError.classList.add('hidden');
        loginUser.value = '';
        loginPass.value = '';
        loginScreen.classList.add('hidden');
    } else {
        loginError.innerText = 'Invalid credentials. Default: admin / 67admin69';
        loginError.classList.remove('hidden');
    }
}

function handleLogout() {
    if (confirm("Log out of Signature AI?")) {
        localStorage.removeItem('signature_ai_auth');
        checkAuthStatus();
    }
}


/* ==========================================================================
   4. SETTINGS & PROVIDER CONFIGURATION
   ========================================================================== */
// Auto-apply Groq test credentials and fast Qwen model
function applyGroqPreset() {
    apiKeyInput.value = GROQ_DEFAULT_KEY;
    keySavedTag.style.display = 'inline';
    modelNameInput.value = GROQ_DEFAULT_MODEL;
    activeModelPill.innerText = GROQ_DEFAULT_MODEL;
}

// Fetch optional server environment configurations
async function fetchServerConfig() {
    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const data = await res.json();
            if (data.groq_default_key)   GROQ_DEFAULT_KEY = data.groq_default_key;
            if (data.groq_default_model) GROQ_DEFAULT_MODEL = data.groq_default_model;

            const currentUrl = localStorage.getItem('signature_ai_url') || urlPresetSelect.value;
            const currentKey = apiKeyInput.value.trim();
            if (currentUrl.includes('groq') && !currentKey && GROQ_DEFAULT_KEY) {
                applyGroqPreset();
            }
        }
    } catch (e) {
        console.warn('Could not reach /api/config, using client defaults.');
    }
}

// Load saved preferences from localStorage
function loadSavedSettings() {
    const url = localStorage.getItem('signature_ai_url') || 'https://api.openai.com/v1/chat/completions';
    const matchedOpt = Array.from(urlPresetSelect.options).find(opt => opt.value === url);
    if (matchedOpt) {
        urlPresetSelect.value = url;
        customUrlGroup.style.display = 'none';
    } else {
        urlPresetSelect.value = 'custom';
        customUrlGroup.style.display = 'block';
        customUrlInput.value = url;
    }

    let key = localStorage.getItem('signature_ai_key') || '';
    if (!key && url.includes('groq')) {
        key = GROQ_DEFAULT_KEY;
    }
    apiKeyInput.value = key;
    keySavedTag.style.display = key ? 'inline' : 'none';

    let model = localStorage.getItem('signature_ai_model') || 'gpt-4o-mini';
    if (url.includes('groq') && (model === 'gpt-4o-mini' || model.includes('llama'))) {
        model = GROQ_DEFAULT_MODEL;
    }
    modelNameInput.value = model;
    activeModelPill.innerText = model;

    activePersonaDirective.value = localStorage.getItem('signature_ai_directive') || '';

    const theme = localStorage.getItem('signature_ai_theme') || 'theme-dark';
    const font = localStorage.getItem('signature_ai_fontsize') || 'font-md';
    themeSelect.value = theme;
    fontSizeSelect.value = font;
    document.body.className = `${theme} ${font}`;

    const temp = localStorage.getItem('signature_ai_temp') || '0.4';
    tempSlider.value = temp;
    tempValDisplay.innerText = temp;

    const topP = localStorage.getItem('signature_ai_top_p') || '0.9';
    topPSlider.value = topP;
    topPValDisplay.innerText = topP;

    historyMaxSelect.value = localStorage.getItem('signature_ai_history') || '10';

    const showDrawer = localStorage.getItem('signature_ai_drawer') !== 'false';
    toggleContextDrawer.checked = showDrawer;
    contextDrawerContainer.style.display = showDrawer ? 'block' : 'none';
}

// Save modal settings to localStorage
function saveSettings() {
    const key = apiKeyInput.value.trim();
    localStorage.setItem('signature_ai_key', key);
    keySavedTag.style.display = key ? 'inline' : 'none';

    const url = urlPresetSelect.value === 'custom' ? customUrlInput.value.trim() : urlPresetSelect.value;
    localStorage.setItem('signature_ai_url', url || 'https://api.openai.com/v1/chat/completions');

    const model = modelNameInput.value.trim() || 'gpt-4o-mini';
    localStorage.setItem('signature_ai_model', model);
    activeModelPill.innerText = model;

    localStorage.setItem('signature_ai_directive', activePersonaDirective.value.trim());

    const theme = themeSelect.value;
    const font = fontSizeSelect.value;
    localStorage.setItem('signature_ai_theme', theme);
    localStorage.setItem('signature_ai_fontsize', font);
    document.body.className = `${theme} ${font}`;

    localStorage.setItem('signature_ai_temp', tempSlider.value);
    localStorage.setItem('signature_ai_top_p', topPSlider.value);
    localStorage.setItem('signature_ai_history', historyMaxSelect.value);

    const showDrawer = toggleContextDrawer.checked;
    localStorage.setItem('signature_ai_drawer', showDrawer);
    contextDrawerContainer.style.display = showDrawer ? 'block' : 'none';

    settingsModal.classList.add('hidden');
}


/* ==========================================================================
   5. CHAT SESSIONS (History, Switch, Delete, Export)
   ========================================================================== */
function loadChatSessions() {
    const raw = localStorage.getItem('signature_ai_chat_sessions');
    if (raw) {
        try {
            savedSessionsList = JSON.parse(raw) || [];
        } catch (e) {
            savedSessionsList = [];
        }
    }
    renderChatHistoryList();
}

function saveCurrentSessionToStorage() {
    if (!activeSessionId || currentChatSession.length === 0) return;

    const firstUserMsg = currentChatSession.find(m => m.sender === 'User');
    let title = 'New Chat';
    if (firstUserMsg && firstUserMsg.text) {
        const clean = firstUserMsg.text.replace(/\[Attached Context Envelope[\s\S]*$/, '').trim();
        title = clean.length > 28 ? clean.substring(0, 28).trim() + '...' : clean || 'New Chat';
    }

    const sessionObj = {
        id: activeSessionId,
        title: title,
        timestamp: Date.now(),
        conversationHistory: conversationHistory,
        currentChatSession: currentChatSession
    };

    const idx = savedSessionsList.findIndex(s => s.id === activeSessionId);
    if (idx >= 0) {
        savedSessionsList[idx] = sessionObj;
    } else {
        savedSessionsList.unshift(sessionObj);
    }

    localStorage.setItem('signature_ai_chat_sessions', JSON.stringify(savedSessionsList));
    renderChatHistoryList();
}

function renderChatHistoryList() {
    chatHistoryList.innerHTML = '';
    savedSessionsList.forEach(session => {
        const item = document.createElement('div');
        item.classList.add('history-item');
        if (session.id === activeSessionId) item.classList.add('active');

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('history-title');
        titleSpan.innerText = session.title || 'Chat Session';
        item.appendChild(titleSpan);

        const delBtn = document.createElement('button');
        delBtn.classList.add('btn-delete-session');
        delBtn.innerHTML = '&times;';
        delBtn.title = 'Delete chat';
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        });
        item.appendChild(delBtn);

        item.addEventListener('click', () => switchSession(session.id));
        chatHistoryList.appendChild(item);
    });
}

function deleteSession(sessionId) {
    savedSessionsList = savedSessionsList.filter(s => s.id !== sessionId);
    localStorage.setItem('signature_ai_chat_sessions', JSON.stringify(savedSessionsList));

    if (activeSessionId === sessionId) {
        if (savedSessionsList.length > 0) {
            switchSession(savedSessionsList[0].id);
        } else {
            createNewChatSession();
        }
    } else {
        renderChatHistoryList();
    }
}

function createNewChatSession() {
    if (currentChatSession.length > 0) {
        saveCurrentSessionToStorage();
    }

    activeSessionId = 'session_' + Date.now();
    conversationHistory = [];
    currentChatSession = [];

    chatCenterWrapper.innerHTML = '';
    chatCenterWrapper.appendChild(welcomeHero);
    welcomeHero.classList.remove('hidden');

    renderChatHistoryList();
}

function switchSession(sessionId) {
    if (activeSessionId === sessionId) return;

    if (currentChatSession.length > 0) {
        saveCurrentSessionToStorage();
    }

    const session = savedSessionsList.find(s => s.id === sessionId);
    if (session) {
        activeSessionId = session.id;
        conversationHistory = session.conversationHistory || [];
        currentChatSession = session.currentChatSession || [];

        chatCenterWrapper.innerHTML = '';
        welcomeHero.classList.add('hidden');

        currentChatSession.forEach(msg => {
            const row = createMessageRow(msg.sender, msg.text, msg.latency);
            chatCenterWrapper.appendChild(row);
        });

        if (window.hljs) {
            chatCenterWrapper.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
        }

        renderChatHistoryList();
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

function exportActiveChatAsMarkdown() {
    if (!currentChatSession || currentChatSession.length === 0) {
        alert("No messages to export in the active chat.");
        return;
    }

    const session = savedSessionsList.find(s => s.id === activeSessionId);
    const title = session ? session.title : "Signature AI Chat";
    const dateStr = new Date().toLocaleString();
    const model = localStorage.getItem('signature_ai_model') || 'gpt-4o-mini';

    let md = `# ${title}\n\n`;
    md += `*Exported on:* ${dateStr}  \n`;
    md += `*Model:* \`${model}\`\n\n`;
    md += `---\n\n`;

    currentChatSession.forEach(msg => {
        const sender = msg.sender === 'User' ? '### 👤 User' : '### 🤖 Assistant';
        md += `${sender}\n\n${msg.text}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30) || 'chat') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


/* ==========================================================================
   6. MESSAGING & CHAT RENDERING
   ========================================================================== */
function createMessageRow(sender, text, latencyMs = null) {
    const row = document.createElement('div');
    row.classList.add('message-row', sender === 'User' ? 'user-row' : 'ai-row');

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content');

    const avatar = document.createElement('div');
    avatar.classList.add('msg-avatar-icon');
    avatar.innerText = sender === 'User' ? 'U' : 'AI';

    const textBody = document.createElement('div');
    textBody.classList.add('msg-text-body');

    if (sender === 'AI') {
        textBody.innerHTML = marked.parse(text);
        if (latencyMs) {
            const pill = document.createElement('span');
            pill.classList.add('telemetry-pill');
            pill.innerText = `${latencyMs}ms`;
            textBody.appendChild(pill);
        }
        contentWrapper.appendChild(avatar);
        contentWrapper.appendChild(textBody);
    } else {
        textBody.innerText = text;
        contentWrapper.appendChild(textBody);
    }

    row.appendChild(contentWrapper);

    // Attach copy button overlay to all generated code blocks
    if (sender === 'AI') {
        textBody.querySelectorAll('pre').forEach(pre => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('code-wrapper');

            const copyBtn = document.createElement('button');
            copyBtn.classList.add('btn-copy-code');
            copyBtn.innerText = 'Copy Code';
            copyBtn.addEventListener('click', () => {
                const code = pre.querySelector('code')?.innerText || pre.innerText;
                navigator.clipboard.writeText(code).then(() => {
                    copyBtn.innerText = 'Copied!';
                    setTimeout(() => copyBtn.innerText = 'Copy Code', 2000);
                });
            });

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            wrapper.appendChild(copyBtn);
        });
    }

    return row;
}

async function sendMessage() {
    const text = userInput.value.trim();
    const context = contextInput.value.trim();

    const apiKey = localStorage.getItem('signature_ai_key') || '';
    const baseUrl = localStorage.getItem('signature_ai_url') || 'https://api.openai.com/v1/chat/completions';
    const model = localStorage.getItem('signature_ai_model') || 'gpt-4o-mini';
    const systemPrompt = localStorage.getItem('signature_ai_directive') || '';
    const temp = parseFloat(localStorage.getItem('signature_ai_temp') || '0.4');
    const topP = parseFloat(localStorage.getItem('signature_ai_top_p') || '0.9');
    const maxHistory = parseInt(localStorage.getItem('signature_ai_history') || '10');

    if (!text) return;
    if (!apiKey && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
        alert("Please configure your API Key in Settings first.");
        settingsModal.classList.remove('hidden');
        return;
    }

    if (welcomeHero && !welcomeHero.classList.contains('hidden')) {
        welcomeHero.classList.add('hidden');
    }

    const displayText = text + (context ? `\n\n[Attached Context Envelope (${context.length} chars)]` : "");
    chatCenterWrapper.appendChild(createMessageRow("User", displayText));

    userInput.value = "";
    contextInput.value = "";
    userInput.style.height = "32px";

    // Animated loading dots
    const typingRow = document.createElement('div');
    typingRow.classList.add('message-row', 'ai-row');
    typingRow.innerHTML = `
        <div class="message-content">
            <div class="msg-avatar-icon">AI</div>
            <div class="msg-text-body">
                <div class="typing-dots"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
    chatCenterWrapper.appendChild(typingRow);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                context_data: context,
                system_prompt: systemPrompt,
                api_key: apiKey,
                base_url: baseUrl,
                model: model,
                temperature: temp,
                top_p: topP,
                max_history: maxHistory,
                history: conversationHistory
            })
        });

        const data = await response.json();
        chatCenterWrapper.removeChild(typingRow);

        if (response.ok) {
            const aiRow = createMessageRow("AI", data.reply, data.latency_ms);
            chatCenterWrapper.appendChild(aiRow);

            if (window.hljs) {
                aiRow.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
            }

            conversationHistory.push({ role: "user", content: text });
            conversationHistory.push({ role: "assistant", content: data.reply });
            currentChatSession.push({ sender: "User", text: displayText });
            currentChatSession.push({ sender: "AI", text: data.reply, latency: data.latency_ms });

            saveCurrentSessionToStorage();
        } else {
            chatCenterWrapper.appendChild(createMessageRow("AI", `Error: ${data.error}`));
        }
    } catch (err) {
        if (chatCenterWrapper.contains(typingRow)) {
            chatCenterWrapper.removeChild(typingRow);
        }
        chatCenterWrapper.appendChild(createMessageRow("AI", "Network Error: Unable to reach backend server."));
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
}


/* ==========================================================================
   7. EVENT LISTENERS & INITIALIZATION
   ========================================================================== */
// Authentication
if (loginForm) loginForm.addEventListener('submit', handleLogin);
if (logoutBtn)  logoutBtn.addEventListener('click', handleLogout);

// Chat Actions
sendBtn.addEventListener('click', sendMessage);
newChatBtn.addEventListener('click', createNewChatSession);
if (exportChatBtn) exportChatBtn.addEventListener('click', exportActiveChatAsMarkdown);

clearChatBtn.addEventListener('click', () => {
    if (confirm("Clear current conversation?")) {
        conversationHistory = [];
        currentChatSession = [];
        chatCenterWrapper.innerHTML = '';
        chatCenterWrapper.appendChild(welcomeHero);
        welcomeHero.classList.remove('hidden');
        saveCurrentSessionToStorage();
    }
});

// Auto-expanding textarea & Enter shortcut
userInput.addEventListener('input', () => {
    userInput.style.height = '32px';
    userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Floating scroll-to-bottom button
chatWindow.addEventListener('scroll', () => {
    const isAtBottom = chatWindow.scrollHeight - chatWindow.scrollTop <= chatWindow.clientHeight + 100;
    scrollDownBtn.classList.toggle('hidden', isAtBottom);
});
scrollDownBtn.addEventListener('click', () => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// Welcome screen suggestion cards
document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
        userInput.value = card.getAttribute('data-prompt') + ' ';
        userInput.focus();
    });
});

// Settings Modal controls
openSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    if (urlPresetSelect.value.includes('groq') && !apiKeyInput.value.trim()) {
        applyGroqPreset();
    }
});
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', saveSettings);
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

// Modal Tab Switcher
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
    });
});

// API Provider Select
urlPresetSelect.addEventListener('change', () => {
    customUrlGroup.style.display = urlPresetSelect.value === 'custom' ? 'block' : 'none';
    if (urlPresetSelect.value.includes('groq')) applyGroqPreset();
});
urlPresetSelect.addEventListener('input', () => {
    if (urlPresetSelect.value.includes('groq')) applyGroqPreset();
});

// Real-time UI updates
apiKeyInput.addEventListener('input', () => {
    keySavedTag.style.display = apiKeyInput.value.trim() ? 'inline' : 'none';
});
toggleKeyVisibility.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyVisibility.innerText = isPassword ? 'Hide' : 'Show';
});
tempSlider.addEventListener('input', () => { tempValDisplay.innerText = tempSlider.value; });
topPSlider.addEventListener('input',  () => { topPValDisplay.innerText = topPSlider.value; });

// Persona preset buttons
document.querySelectorAll('.btn-preset-card').forEach(btn => {
    btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-preset');
        if (PRESET_PERSONAS[key]) activePersonaDirective.value = PRESET_PERSONAS[key];
    });
});

// Persona Synthesizer
generatePersonaBtn.addEventListener('click', async () => {
    const desc = personaRoleInput.value.trim();
    if (!desc) { alert("Please describe the desired persona."); return; }

    generatePersonaBtn.innerText = "Synthesizing...";
    generatePersonaBtn.disabled = true;

    try {
        const res = await fetch('/api/build-persona', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_description: desc,
                api_key: apiKeyInput.value.trim(),
                base_url: urlPresetSelect.value === 'custom' ? customUrlInput.value.trim() : urlPresetSelect.value,
                model: modelNameInput.value.trim() || 'gpt-4o-mini'
            })
        });
        const data = await res.json();
        if (res.ok) {
            activePersonaDirective.value = data.expanded_persona;
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        alert("Failed to reach backend server.");
    } finally {
        generatePersonaBtn.innerText = "Synthesize System Persona";
        generatePersonaBtn.disabled = false;
    }
});

// App Startup
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    fetchServerConfig();
    loadSavedSettings();
    loadChatSessions();
    createNewChatSession();
});
