# CampusX — Bug Report & Verification Log

> **Build Tool Disclosure:** Built and tested in **Antigravity** (rather than Bolt.new mentioned in the assignment template). Every bug and verification below was reproduced and tested directly in this workspace.

---

## Bug #1: Embedding Model Cold-Start Delay & Offline Retry Hang in RAG Pipeline

### Summary
Uploading the first PDF to `/api/rag/upload` stalled for ~70–90 seconds with repeated HuggingFace Hub connection retries (`[Errno 11001] getaddrinfo failed`) even after `sentence-transformers/all-MiniLM-L6-v2` had already been downloaded and cached locally.

### Where It Occurred
- File: [`backend/app/rag/pipeline.py`](../backend/app/rag/pipeline.py)
- Method: `RagPipeline._get_embedder()`

### Root Cause
`SentenceTransformer(settings.EMBEDDING_MODEL)` by default queries HuggingFace Hub endpoints (`modules.json`, `adapter_config.json`, `tree/main/additional_chat_templates`, `2_Normalize/config.json`) on instantiation to check for remote updates before falling back to local cache. When running offline or in restricted network environments, `huggingface_hub` performs 5 exponential-backoff retries per endpoint (`1s + 2s + 4s + 8s + 8s` per request), causing an ~90-second stall before loading cached weights.

### Reproduction Steps (Before Fix)
1. Download `all-MiniLM-L6-v2` into the local HuggingFace cache.
2. Run `backend\.venv\Scripts\python.exe -m tests.test_api` in an offline sandbox without network access.
3. Observe `POST /api/rag/upload` hanging for ~90 seconds while printing 15 retry errors to `https://huggingface.co` before completing.

### Fix Implemented
Updated `RagPipeline._get_embedder()` in `backend/app/rag/pipeline.py` to load from the local cache first using `local_files_only=True`, and fall back to remote download only if the model is not yet cached locally:

```python
try:
    self._embedder = SentenceTransformer(
        settings.EMBEDDING_MODEL, local_files_only=True
    )
except Exception:
    self._embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
```

### Verification (After Fix)
Re-ran `backend\.venv\Scripts\python.exe -m tests.test_api` in the same offline sandbox environment:
- Zero HuggingFace Hub retry warnings.
- Total test suite execution dropped from ~90 seconds to ~12 seconds.
- All 8 backend and RAG assertions (`/api/health`, `/api/weather` error handling, `/api/chat` validation, PDF validation, 2-page PDF upload -> load -> chunk -> embed -> store -> query -> delete) passed with exit code `0`.

---

## Bug #2: Stale RAG Document List After Backend Reconnect

### Summary
If the React frontend loaded before the FastAPI backend started, clicking the **Refresh Connection** button in the top bar (or **Recheck** in Settings) updated `/api/health` to `API Connected`, but did not re-fetch `/api/rag/documents`.

### Where It Occurred
- File: [`frontend/src/App.jsx`](../frontend/src/App.jsx)
- Props: `onRefreshHealth` passed to `TopBar` and `SettingsPage`

### Root Cause
`TopBar` and `SettingsPage` invoked `refreshHealth` alone instead of also calling `refreshRagDocuments`.

### Fix Implemented
Added a unified `refreshAll` callback in `frontend/src/App.jsx` running `Promise.all([refreshHealth(), refreshRagDocuments()])`, and wired it to initial mount, `TopBar`, and `SettingsPage`.

### Verification
Rebuilt the production Vite bundle (`npm run build` — 1,590 modules transformed cleanly, exit code `0`) and verified live UI health + document refresh against the running FastAPI server.
