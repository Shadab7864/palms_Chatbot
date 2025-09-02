/**
 * script.js
 * Production-ready frontend logic for PALMS WMS AI Assistant
 *
 * Features:
 * - Sidebar open/close (no overlap — main shifts)
 * - Model selection and badge update
 * - File upload / refresh / select & delete (server-backed)
 * - Session-level history (local + server mirror)
 * - Send message -> streaming response parsing (SSE-style JSON chunks)
 * - Abort streaming, error handling, UX states
 *
 * IMPORTANT: set API_BASE for your deployment.
 */

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:8000' : ''; // set to deployed backend domain if needed

// DOM
const body = document.body;
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sessionIdEl = document.getElementById('session-id');

const modelSelect = document.getElementById('model-select');
const modelBadge = document.getElementById('current-model-badge');

const fileUploadArea = document.getElementById('file-upload-area');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const refreshFilesBtn = document.getElementById('refresh-files');
const selectAllBtn = document.getElementById('select-all-files');
const deleteSelectedBtn = document.getElementById('delete-selected-files');

const recentChatsEl = document.getElementById('recent-chats');
const clearHistoryBtn = document.getElementById('clear-history');

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const cancelBtn = document.getElementById('cancel-btn');
const newChatBtn = document.getElementById('new-chat-btn');

const liveStatus = document.getElementById('live-status'); // hidden region for ARIA

// State
let sessionId = null;
let selectedModel = modelSelect.value;
let uploadedFiles = []; // {name,size,uploaded_at}
let fileSelections = new Set();
let chatHistory = []; // {type,content,timestamp}
let streamController = null;
let streaming = false;

/* ---------- Utilities ---------- */
function uuid() {
  return 's_' + Math.random().toString(36).slice(2, 10);
}
function nowISO() { return new Date().toISOString(); }
function fmtTime(ts) { return new Date(ts||Date.now()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function setLive(msg){ if (liveStatus) liveStatus.textContent = msg; }

/* ---------- Session Init ---------- */
function initSession() {
  sessionId = localStorage.getItem('palms_session_id');
  if (!sessionId) {
    sessionId = uuid();
    localStorage.setItem('palms_session_id', sessionId);
  }
  sessionIdEl.textContent = sessionId;

  // load local persisted session resources
  const filesKey = `palms_files_${sessionId}`;
  const histKey = `palms_history_${sessionId}`;

  try {
    uploadedFiles = JSON.parse(localStorage.getItem(filesKey) || '[]');
  } catch(e) { uploadedFiles = []; }
  try {
    chatHistory = JSON.parse(localStorage.getItem(histKey) || '[]');
  } catch(e) { chatHistory = []; }

  // show last history
  renderChatHistory();
  renderFileList();
  renderRecentChats();
}

/* ---------- Sidebar behavior (no overlap) ---------- */
function toggleSidebar(open) {
  if (typeof open === 'undefined') {
    open = !sidebar.classList.contains('open');
  }
  if (open) {
    sidebar.classList.add('open');
    body.classList.add('sidebar-open');
    sidebarToggle.setAttribute('aria-pressed','true');
  } else {
    sidebar.classList.remove('open');
    body.classList.remove('sidebar-open');
    sidebarToggle.setAttribute('aria-pressed','false');
  }
}

/* ---------- Model selection ---------- */
function onModelChange() {
  selectedModel = modelSelect.value;
  modelBadge.textContent = modelSelect.options[modelSelect.selectedIndex].text;
}

/* ---------- File UI ---------- */
function renderFileList() {
  fileListEl.innerHTML = '';
  if (!uploadedFiles || uploadedFiles.length === 0) {
    const e = document.createElement('div'); e.className = 'file-item'; e.textContent = 'No documents uploaded.';
    fileListEl.appendChild(e);
    return;
  }
  uploadedFiles.forEach(f => {
    const item = document.createElement('div'); item.className = 'file-item';
    const left = document.createElement('div'); left.className = 'file-left';
    const checkbox = document.createElement('div'); checkbox.className = 'check';
    checkbox.innerHTML = fileSelections.has(f.name) ? '<i class="fas fa-check"></i>' : '';
    checkbox.title = 'Select';
    checkbox.addEventListener('click', () => {
      if (fileSelections.has(f.name)) fileSelections.delete(f.name); else fileSelections.add(f.name);
      renderFileList();
    });

    const name = document.createElement('div'); name.className = 'file-name'; name.textContent = f.name; name.title = f.name;

    left.appendChild(checkbox); left.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'file-actions-inline';
    const dl = document.createElement('button'); dl.className='btn small ghost'; dl.title='Download'; dl.innerHTML='<i class="fas fa-download"></i>';
    dl.addEventListener('click', () => downloadFile(f.name));
    actions.appendChild(dl);
    item.appendChild(left);
    item.appendChild(actions);
    fileListEl.appendChild(item);
  });
}

/* ---------- Recent chats list ---------- */
function renderRecentChats() {
  recentChatsEl.innerHTML = '';
  if (!chatHistory || chatHistory.length === 0) {
    const e = document.createElement('div'); e.className='chat-item'; e.textContent = 'No chat history yet.';
    recentChatsEl.appendChild(e); return;
  }

  // Show items grouped by user messages with timestamp (like ChatGPT conversation list)
  // We'll display each user message as a history entry (most recent first)
  const items = chatHistory.filter(m => m.type === 'user').slice(-50).reverse();
  items.forEach(it => {
    const el = document.createElement('div'); el.className='chat-item';
    const t = document.createElement('div'); t.textContent = (it.content.length > 50) ? it.content.slice(0,50)+'…' : it.content;
    const time = document.createElement('div'); time.className='muted'; time.style.fontSize='12px'; time.textContent = fmtTime(it.timestamp);
    el.appendChild(t); el.appendChild(time);
    el.addEventListener('click', () => {
      // simple behavior: re-render full chat (we already have session history)
      renderChatHistory();
      scrollToBottom();
    });
    recentChatsEl.appendChild(el);
  });
}

/* ---------- Chat rendering ---------- */
function renderChatHistory() {
  chatBox.innerHTML = '';
  if (!chatHistory || chatHistory.length === 0) {
    const sys = document.createElement('div'); sys.className='system-message'; sys.textContent = 'Welcome to PALMS Warehouse AI Assistant. Ask about inventory, shipments, or docs.';
    chatBox.appendChild(sys); return;
  }
  chatHistory.forEach(m => addMessageDom(m.content, m.type, m.timestamp, false));
  scrollToBottom();
}

function addMessageDom(content, type='bot', timestamp=null, save=true) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${type}-message`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content ' + (type === 'user' ? 'user-content':'bot-content');
  contentDiv.innerHTML = `<div class="msg-text">${escapeHtml(content)}</div><div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:6px;text-align:${type==='user'?'right':'left'}">${fmtTime(timestamp)}</div>`;
  wrapper.appendChild(contentDiv);
  chatBox.appendChild(wrapper);
  if (save) {
    chatHistory.push({type, content, timestamp: timestamp || nowISO()});
    persistHistory();
    renderRecentChats();
  }
  scrollToBottom();
}

function updateLastBotContent(incrementalText) {
  const botMessages = chatBox.querySelectorAll('.message.bot-message .message-content');
  let last = botMessages[botMessages.length - 1];
  if (!last) {
    // create one if missing
    addMessageDom(incrementalText, 'bot', nowISO(), false);
    return;
  }
  // update inner text while preserving timestamp container
  const ts = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  last.innerHTML = `<div class="msg-text">${escapeHtml(incrementalText)}</div><div style="font-size:11px;color:rgba(0,0,0,0.45);margin-top:6px;text-align:left">${ts}</div>`;
  scrollToBottom();
}

/* ---------- Persistence ---------- */
function persistHistory() {
  try { localStorage.setItem(`palms_history_${sessionId}`, JSON.stringify(chatHistory)); } catch(e){}
}
function persistFiles() {
  try { localStorage.setItem(`palms_files_${sessionId}`, JSON.stringify(uploadedFiles)); } catch(e){}
}

/* ---------- File operations (server-integrated) ---------- */
async function uploadFilesToServer() {
  const files = Array.from(fileInput.files || []);
  if (!files.length) { speak('No files selected'); return; }

  // Client-side basic validation: allowed extensions
  const ALLOWED = ['pdf','csv','xlsx','xls','txt'];
  for (const f of files) {
    const ext = f.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
      alert(`File type not allowed: ${f.name}`);
      return;
    }
    // 20 MB limit
    if (f.size > 20 * 1024 * 1024) {
      alert(`File too large (max 20MB): ${f.name}`);
      return;
    }
  }

  const form = new FormData();
  form.append('session_id', sessionId);
  for (const f of files) form.append('files', f, f.name);

  try {
    setLive('Uploading files...');
    const res = await fetch(`${API_BASE}/upload`, { method:'POST', body: form });
    if (!res.ok) {
      const err = await res.json().catch(()=>({detail:res.statusText}));
      alert('Upload failed: ' + (err.detail || res.statusText));
      setLive('');
      return;
    }
    const body = await res.json();
    // server returns saved file metadata
    uploadedFiles = (uploadedFiles || []).concat(body.files || []);
    persistFiles(); renderFileList();
    setLive('Upload complete');
  } catch (e) {
    console.error(e);
    alert('Upload failed: ' + e.message);
  } finally {
    fileInput.value = '';
    setTimeout(()=>setLive(''), 1200);
  }
}

async function refreshFilesFromServer() {
  try {
    setLive('Refreshing files...');
    const res = await fetch(`${API_BASE}/files?session_id=${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      const err = await res.json().catch(()=>({detail:res.statusText}));
      alert('Refresh failed: ' + (err.detail || res.statusText));
      setLive(''); return;
    }
    const body = await res.json();
    uploadedFiles = body.files || [];
    persistFiles(); renderFileList();
    setLive('');
  } catch(e) {
    console.error(e); alert('Refresh failed'); setLive('');
  }
}

async function downloadFile(name) {
  const url = `${API_BASE}/files/download?session_id=${encodeURIComponent(sessionId)}&filename=${encodeURIComponent(name)}`;
  window.open(url, '_blank');
}

async function deleteSelectedFiles() {
  if (fileSelections.size === 0) { alert('No files selected'); return; }
  if (!confirm(`Delete ${fileSelections.size} selected file(s)?`)) return;
  try {
    setLive('Deleting files...');
    const res = await fetch(`${API_BASE}/delete-file`, {
      method:'DELETE',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ session_id: sessionId, filenames: Array.from(fileSelections) })
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({detail:res.statusText}));
      alert('Delete failed: ' + (err.detail || res.statusText));
      setLive(''); return;
    }
    // remove locally
    uploadedFiles = uploadedFiles.filter(f => !fileSelections.has(f.name));
    fileSelections.clear();
    persistFiles(); renderFileList();
    setLive('');
  } catch(e) { console.error(e); alert('Delete failed'); setLive(''); }
}

/* ---------- Chat streaming logic ---------- */
function createMessagePlaceholder() {
  // create an empty bot message placeholder (we will fill incrementally)
  addMessageDom('', 'bot', nowISO(), false);
}

function abortStream() {
  if (streamController) {
    streamController.abort();
    streamController = null;
    streaming = false;
    cancelBtn.hidden = true;
    setLive('Stream cancelled');
  }
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  // push user message
  addMessageDom(text, 'user', nowISO(), true);
  userInput.value = '';
  setLive('Sending...');

  // prepare payload
  const payload = { session_id: sessionId, message: text, model: selectedModel };

  // start streaming
  const controller = new AbortController();
  streamController = controller;
  streaming = true;
  cancelBtn.hidden = false;
  createMessagePlaceholder();
  let accumulated = '';

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.json().catch(()=>null);
      alert('Server error: ' + (err?.detail || res.statusText));
      setLive('');
      abortStream();
      return;
    }

    // streaming via readable stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while(true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream:true });

      // SSE-style fragments separated by \n\n
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop(); // remainder

      for (const part of parts) {
        const lines = part.split(/\n/).map(l => l.replace(/^data:\s?/, ''));
        for (const line of lines) {
          if (!line) continue;
          if (line.trim() === '[DONE]') {
            // finalize
            streaming = false;
            cancelBtn.hidden = true;
            setLive('');
            // save assistant message
            if (accumulated.trim()) {
              chatHistory.push({ type:'bot', content: accumulated, timestamp: nowISO() });
              persistHistory();
              renderRecentChats();
            }
            streamController = null;
            return;
          }
          // try parse JSON
          let obj = null;
          try { obj = JSON.parse(line); } catch(e) {
            // not JSON => append raw
            accumulated += line;
            updateLastBotContent(accumulated);
            continue;
          }
          if (obj.error) {
            alert('Error: ' + obj.error);
            setLive('');
            abortStream();
            return;
          }
          if (obj.chunk) {
            accumulated += obj.chunk;
            updateLastBotContent(accumulated);
          } else if (obj.partial) {
            // alternative key name
            accumulated += obj.partial;
            updateLastBotContent(accumulated);
          }
        }
      }
    }

    // stream ended without [DONE] — finalize
    if (accumulated.trim()) {
      chatHistory.push({ type:'bot', content: accumulated, timestamp: nowISO() });
      persistHistory(); renderRecentChats();
    }
    setLive('');
    cancelBtn.hidden = true;
    streaming = false;
    streamController = null;
  } catch (err) {
    if (err.name === 'AbortError') {
      setLive('Stream aborted');
    } else {
      console.error(err);
      alert('Streaming error: ' + (err.message || err));
      setLive('');
    }
    streaming = false;
    cancelBtn.hidden = true;
    streamController = null;
  }
}

/* ---------- Helpers ---------- */
function escapeHtml(str) {
  return str.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}
function scrollToBottom() { chatBox.scrollTop = chatBox.scrollHeight; }
function speak(msg) { setLive(msg); }

/* ---------- Events & Wiring ---------- */
function setupEventHandlers() {
  // sidebar toggle
  sidebarToggle.addEventListener('click', () => {
    const open = !sidebar.classList.contains('open');
    toggleSidebar(open);
  });

  // model change
  modelSelect.addEventListener('change', () => { onModelChange(); });

  // file upload
  fileUploadArea.addEventListener('click', () => fileInput.click());
  fileUploadArea.addEventListener('keypress', (e) => { if (e.key === 'Enter') fileInput.click(); });
  fileInput.addEventListener('change', uploadFilesToServer);
  refreshFilesBtn.addEventListener('click', refreshFilesFromServer);
  selectAllBtn.addEventListener('click', () => {
    uploadedFiles.forEach(f => fileSelections.add(f.name));
    renderFileList();
  });
  deleteSelectedBtn.addEventListener('click', deleteSelectedFiles);

  // compose
  sendBtn.addEventListener('click', () => { if (!streaming) sendMessage(); });
  cancelBtn.addEventListener('click', () => abortStream());
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!streaming) sendMessage(); }
  });

  // history & clear
  clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Clear session chat history?')) return;
    chatHistory = []; persistHistory(); renderChatHistory(); renderRecentChats();
  });

  // new chat
  newChatBtn.addEventListener('click', () => {
    if (!confirm('Start a new conversation? This keeps files but clears the current messages.')) return;
    chatHistory = []; persistHistory(); renderChatHistory(); renderRecentChats();
  });

  // initial model badge
  onModelChange();
}

/* ---------- Init ---------- */
function init() {
  initSession();
  setupEventHandlers();
  setLive('');
  // Try to refresh files from server (non-blocking)
  refreshFilesFromServer().catch(()=>{ /* ignore */ });
}

init();
