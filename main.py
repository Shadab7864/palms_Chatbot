"""
main.py - production-ready FastAPI backend for PALMS WMS AI Assistant

Features:
 - /chat supports streaming (SSE-style JSON chunks) and non-stream fallback
 - /upload receives multipart files, stores under uploads/<session_id>/ safely
 - /files lists uploaded files for a session
 - /files/download serves specific session's files (safe lookup)
 - /delete-file deletes one or multiple files for a session
 - /history endpoints for server-side history (optional)
 - SQLite persistence for messages & files
 - Basic filename sanitization + allowed extensions + max file size check
"""

import os
import pathlib
import shutil
import sqlite3
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import ollama  # ensure installed & configured
import uvicorn

BASE = pathlib.Path(__file__).parent.resolve()
UPLOAD_DIR = BASE / "uploads"
DB_PATH = BASE / "palms_prod.db"
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
ALLOWED_EXT = {"pdf","csv","xlsx","xls","txt"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="PALMS WMS AI Assistant API")

# In production restrict to actual domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_MODEL = "phi3:mini"
CHUNK_DELAY = 0.01  # small delay to yield between SSE events

# ---------------- DB helpers ----------------
def get_db_conn():
    con = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    con = get_db_conn()
    cur = con.cursor()
    cur.execute("""
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    """)
    cur.execute("""
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        filename TEXT,
        filepath TEXT,
        size INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    """)
    con.commit()
    con.close()

init_db()

# ---------------- utilities ----------------
def safe_filename(filename: str) -> str:
    name = os.path.basename(filename)
    allowed = "".join(c for c in name if c.isalnum() or c in "._- ")
    return allowed[:255]

def allowed_file(filename: str) -> bool:
    ext = filename.rsplit(".",1)[-1].lower() if "." in filename else ""
    return ext in ALLOWED_EXT

def save_upload(session_id: str, upload: UploadFile) -> dict:
    if not allowed_file(upload.filename):
        raise HTTPException(status_code=400, detail=f"File type not allowed: {upload.filename}")
    safe_name = safe_filename(upload.filename)
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    dest = session_dir / safe_name
    # avoid overwrite
    base, ext = os.path.splitext(safe_name)
    counter = 1
    while dest.exists():
        dest = session_dir / f"{base}_{counter}{ext}"
        counter += 1
    total = 0
    with open(dest, "wb") as f:
        while True:
            chunk = upload.file.read(1024 * 32)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_FILE_SIZE:
                f.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="File too large")
            f.write(chunk)
    return {"name": dest.name, "path": str(dest), "size": dest.stat().st_size}

def record_file_db(session_id: str, meta: dict):
    con = get_db_conn(); cur = con.cursor()
    cur.execute("INSERT INTO files (session_id, filename, filepath, size) VALUES (?,?,?,?)", (session_id, meta['name'], meta['path'], meta['size']))
    con.commit(); con.close()

def list_files_db(session_id: str):
    con = get_db_conn(); cur = con.cursor()
    cur.execute("SELECT filename, filepath, size, uploaded_at FROM files WHERE session_id=? ORDER BY uploaded_at DESC", (session_id,))
    rows = cur.fetchall(); con.close()
    return [{"name": r["filename"], "path": r["filepath"], "size": r["size"], "uploaded_at": r["uploaded_at"]} for r in rows]

def delete_files_db(session_id: str, filenames: Optional[List[str]] = None):
    con = get_db_conn(); cur = con.cursor()
    if not filenames:
        # delete all for session
        cur.execute("SELECT filepath FROM files WHERE session_id=?", (session_id,))
        rows = cur.fetchall()
        for r in rows:
            try: os.remove(r["filepath"])
            except: pass
        cur.execute("DELETE FROM files WHERE session_id=?", (session_id,))
    else:
        for fname in filenames:
            cur.execute("SELECT filepath FROM files WHERE session_id=? AND filename=?", (session_id, fname))
            r = cur.fetchone()
            if r:
                try: os.remove(r["filepath"])
                except: pass
                cur.execute("DELETE FROM files WHERE session_id=? AND filename=?", (session_id, fname))
    con.commit(); con.close()

def record_message_db(session_id: str, role: str, content: str):
    con = get_db_conn(); cur = con.cursor()
    cur.execute("INSERT INTO messages (session_id, role, content) VALUES (?,?,?)", (session_id, role, content))
    con.commit(); con.close()

def get_history_db(session_id: str):
    con = get_db_conn(); cur = con.cursor()
    cur.execute("SELECT role, content, created_at FROM messages WHERE session_id=? ORDER BY created_at ASC", (session_id,))
    rows = cur.fetchall(); con.close()
    return [{"role": r["role"], "content": r["content"], "created_at": r["created_at"]} for r in rows]

def clear_history_db(session_id: str):
    con = get_db_conn(); cur = con.cursor()
    cur.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
    con.commit(); con.close()

# ---------------- endpoints ----------------

@app.get("/")
async def root():
    return {"status":"ok", "message":"PALMS WMS AI Assistant API"}

@app.get("/models")
async def models():
    # try to fetch models from ollama, fallback to defaults
    try:
        resp = ollama.list()
        models = []
        if hasattr(resp, 'models'):
            for m in resp.models:
                models.append(m.model)
        elif isinstance(resp, (list,tuple)):
            for m in resp:
                if isinstance(m, dict) and 'model' in m: models.append(m['model'])
        if not models:
            models = [DEFAULT_MODEL, "gemma2:2b", "llama3.2:1b", "llama3.1", "mistral"]
        return {"models": models}
    except Exception as e:
        return {"models": [DEFAULT_MODEL, "gemma2:2b", "llama3.2:1b", "llama3.1", "mistral"], "error": str(e)}

@app.post("/upload")
async def upload(files: List[UploadFile] = File(...), session_id: str = Form(...)):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    saved = []
    for f in files:
        try:
            meta = save_upload(session_id, f)
            record_file_db(session_id, meta)
            saved.append({"name": meta["name"], "size": meta["size"]})
        except HTTPException as he:
            # early return error for disallowed types or sizes
            raise he
        except Exception as e:
            # continue for other files but log
            print("upload save error:", e)
    return {"success": True, "files": saved}

@app.get("/files")
async def files(session_id: str = Query(...)):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    try:
        items = list_files_db(session_id)
        return {"files": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/download")
async def files_download(session_id: str = Query(...), filename: str = Query(...)):
    if not session_id or not filename:
        raise HTTPException(status_code=400, detail="session_id & filename required")
    safe = safe_filename(filename)
    con = get_db_conn(); cur = con.cursor()
    cur.execute("SELECT filepath FROM files WHERE session_id=? AND filename=?", (session_id, safe))
    row = cur.fetchone(); con.close()
    if not row:
        raise HTTPException(status_code=404, detail="file not found")
    path = row["filepath"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="file missing")
    return FileResponse(path, filename=safe)

@app.delete("/delete-file")
async def delete_file(payload: dict):
    # payload supports {session_id, filenames: [..]} or {session_id, delete_all: true}
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    delete_all = bool(payload.get("delete_all", False))
    filenames = payload.get("filenames")
    try:
        if delete_all:
            delete_files_db(session_id, None)
        elif filenames:
            delete_files_db(session_id, filenames)
        else:
            raise HTTPException(status_code=400, detail="provide filenames or delete_all")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history")
async def get_history(session_id: str = Query(...)):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    return {"history": get_history_db(session_id)}

@app.delete("/history")
async def delete_history(payload: dict):
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    clear_history_db(session_id)
    return {"success": True}

# ---------------- Chat streaming ----------------
@app.post("/chat")
async def chat(request: Request):
    """
    Accepts JSON { session_id, message, model? }
    If client requests Accept: text/event-stream then we stream chunks of:
        data: {"chunk":"..."}\n\n
    End with:
        data: [DONE]\n\n
    """
    try:
        payload = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error":"invalid json"})

    session_id = payload.get("session_id")
    message = payload.get("message")
    model = payload.get("model") or DEFAULT_MODEL

    if not session_id or not message:
        return JSONResponse(status_code=400, content={"error":"session_id and message required"})

    # record user message
    record_message_db(session_id, 'user', message)

    accept = request.headers.get("accept","")
    if "text/event-stream" in accept:
        async def event_stream():
            try:
                # try streaming from ollama
                try:
                    stream = ollama.chat(model=model, messages=[{"role":"user","content":message}], stream=True)
                except TypeError:
                    # fallback single response
                    resp = ollama.chat(model=model, messages=[{"role":"user","content":message}])
                    reply = ''
                    if isinstance(resp, dict) and 'message' in resp:
                        reply = resp['message'].get('content','')
                    record_message_db(session_id, 'assistant', reply)
                    yield f"data: {json.dumps({'chunk': reply})}\n\n"
                    await asyncio.sleep(CHUNK_DELAY)
                    yield "data: [DONE]\n\n"
                    return

                assistant_accum = ""
                for chunk in stream:
                    if await request.is_disconnected():
                        break
                    piece = None
                    if isinstance(chunk, dict):
                        # common shapes
                        if 'message' in chunk and isinstance(chunk['message'], dict):
                            piece = chunk['message'].get('content')
                        elif 'content' in chunk:
                            piece = chunk.get('content')
                        elif 'chunk' in chunk:
                            piece = chunk.get('chunk')
                    elif isinstance(chunk, str):
                        piece = chunk
                    if piece:
                        assistant_accum += piece
                        yield f"data: {json.dumps({'chunk': piece})}\n\n"
                        await asyncio.sleep(CHUNK_DELAY)
                if assistant_accum:
                    record_message_db(session_id, 'assistant', assistant_accum)
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*"
        }
        return StreamingResponse(event_stream(), headers=headers, media_type="text/event-stream")
    else:
        # non-streaming fallback
        resp = ollama.chat(model=model, messages=[{"role":"user","content":message}])
        reply = ''
        if isinstance(resp, dict) and 'message' in resp:
            reply = resp['message'].get('content','')
        record_message_db(session_id, 'assistant', reply)
        return {"reply": reply}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
