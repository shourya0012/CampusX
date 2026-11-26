from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

import chromadb
from fastapi import HTTPException
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from app.config import settings
from app.services.gemini_service import generate_with_gemini

COLLECTION_NAME = "campusx_documents"
CHUNK_SIZE = 750
CHUNK_OVERLAP = 150
MIN_SIMILARITY_THRESHOLD = 0.18


class RagPipeline:
    """Seven-stage Retrieval-Augmented Generation pipeline using PyPDF, SentenceTransformers, ChromaDB, and OpenAI."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._embedder: Optional[SentenceTransformer] = None
        self._chroma_client: Optional[chromadb.PersistentClient] = None
        self._collection = None

        Path(settings.CHROMA_PERSIST_DIR).mkdir(parents=True, exist_ok=True)
        Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        self._registry_path = Path(settings.CHROMA_PERSIST_DIR) / "documents_registry.json"

    def _get_embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            with self._lock:
                if self._embedder is None:
                    try:
                        self._embedder = SentenceTransformer(
                            settings.EMBEDDING_MODEL, local_files_only=True
                        )
                    except Exception:
                        self._embedder = SentenceTransformer(settings.EMBEDDING_MODEL)
        return self._embedder

    def _get_collection(self):
        if self._collection is None:
            with self._lock:
                if self._collection is None:
                    self._chroma_client = chromadb.PersistentClient(
                        path=settings.CHROMA_PERSIST_DIR
                    )
                    self._collection = self._chroma_client.get_or_create_collection(
                        name=COLLECTION_NAME,
                        metadata={"hnsw:space": "cosine"},
                    )
        return self._collection

    def _load_registry(self) -> list[dict[str, Any]]:
        if not self._registry_path.exists():
            return []
        try:
            return json.loads(self._registry_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

    def _save_registry(self, items: list[dict[str, Any]]) -> None:
        self._registry_path.write_text(json.dumps(items, indent=2), encoding="utf-8")

    # Stage 1: LOAD
    def load_pdf(self, pdf_bytes: bytes, filename: str) -> tuple[list[dict[str, Any]], int]:
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Uploaded PDF file is empty.")

        try:
            reader = PdfReader(BytesIO(pdf_bytes))
        except Exception:
            raise HTTPException(
                status_code=400,
                detail=f"'{filename}' is not a valid or readable PDF file.",
            )

        if len(reader.pages) == 0:
            raise HTTPException(status_code=400, detail=f"'{filename}' contains zero pages.")

        pages: list[dict[str, Any]] = []
        for idx, page in enumerate(reader.pages, start=1):
            raw_text = page.extract_text() or ""
            cleaned = " ".join(raw_text.split())
            if cleaned:
                pages.append({"page_number": idx, "text": cleaned})

        if not pages:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"No extractable text was found in '{filename}'. "
                    "Scanned image-only PDFs require OCR before indexing."
                ),
            )

        return pages, len(reader.pages)

    # Stage 2: CHUNK
    def chunk_pages(
        self,
        pages: list[dict[str, Any]],
        document_id: str,
        filename: str,
        total_pages: int,
        user_id: str,
        chunk_size: int = CHUNK_SIZE,
        overlap: int = CHUNK_OVERLAP,
    ) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        chunk_counter = 0

        for page in pages:
            text = page["text"]
            page_num = page["page_number"]
            start = 0
            text_len = len(text)

            while start < text_len:
                end = min(start + chunk_size, text_len)
                # Try to end cleanly on whitespace when not at end of page
                if end < text_len:
                    last_space = text.rfind(" ", start + int(chunk_size * 0.6), end)
                    if last_space > start:
                        end = last_space

                piece = text[start:end].strip()
                if piece:
                    chunks.append(
                        {
                            "id": f"{document_id}_c{chunk_counter}",
                            "text": piece,
                            "metadata": {
                                "user_id": user_id,
                                "document_id": document_id,
                                "filename": filename,
                                "page_number": page_num,
                                "chunk_index": chunk_counter,
                                "total_pages": total_pages,
                            },
                        }
                    )
                    chunk_counter += 1

                if end >= text_len:
                    break
                start = max(start + 1, end - overlap)

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to produce any text chunks from '{filename}'.",
            )
        return chunks

    # Stages 3 & 4: EMBED + STORE
    def ingest_pdf(self, pdf_bytes: bytes, filename: str, user_id: str) -> dict[str, Any]:
        safe_name = Path(filename).name
        if not safe_name.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400, detail="Only .pdf files are supported for RAG indexing."
            )

        pages, total_pages = self.load_pdf(pdf_bytes, safe_name)
        document_id = str(uuid.uuid4())[:12]
        chunks = self.chunk_pages(pages, document_id, safe_name, total_pages, user_id=user_id)

        try:
            embedder = self._get_embedder()
            texts = [c["text"] for c in chunks]
            embeddings = embedder.encode(texts, normalize_embeddings=True).tolist()
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Embedding generation failed ({settings.EMBEDDING_MODEL}): {exc}",
            )

        try:
            collection = self._get_collection()
            collection.add(
                ids=[c["id"] for c in chunks],
                documents=texts,
                embeddings=embeddings,
                metadatas=[c["metadata"] for c in chunks],
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to store document vectors in ChromaDB: {exc}",
            )

        doc_record = {
            "document_id": document_id,
            "user_id": user_id,
            "filename": safe_name,
            "total_pages": total_pages,
            "pages_with_text": len(pages),
            "chunk_count": len(chunks),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "embedding_model": settings.EMBEDDING_MODEL,
        }

        registry = self._load_registry()
        registry.insert(0, doc_record)
        self._save_registry(registry)

        return {
            **doc_record,
            "stages_completed": ["load", "chunk", "embed", "store"],
        }

    def list_documents(self, user_id: str) -> list[dict[str, Any]]:
        return [d for d in self._load_registry() if d.get("user_id") == user_id]

    def delete_document(self, document_id: str, user_id: str) -> dict[str, Any]:
        registry = self._load_registry()
        target = next((d for d in registry if d["document_id"] == document_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Document not found.")
        if target.get("user_id") != user_id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to delete another student's document.",
            )

        collection = self._get_collection()
        collection.delete(where={"$and": [{"document_id": document_id}, {"user_id": user_id}]})

        updated = [d for d in registry if d["document_id"] != document_id]
        self._save_registry(updated)
        return {"deleted": True, "document_id": document_id, "filename": target["filename"]}

    # Stage 5: RETRIEVE
    def retrieve(
        self,
        question: str,
        user_id: str,
        document_id: Optional[str] = None,
        top_k: int = 4,
    ) -> list[dict[str, Any]]:
        if document_id:
            registry = self._load_registry()
            target = next((d for d in registry if d["document_id"] == document_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Selected document was not found.")
            if target.get("user_id") != user_id:
                raise HTTPException(
                    status_code=403,
                    detail="You do not have permission to query another student's document.",
                )

        user_docs = self.list_documents(user_id=user_id)
        if not user_docs:
            raise HTTPException(
                status_code=400,
                detail="No PDF documents are indexed for your account yet. Upload a PDF first.",
            )

        collection = self._get_collection()
        count = collection.count()
        if count == 0:
            raise HTTPException(
                status_code=400,
                detail="Vector store is empty. Upload a PDF document to index content.",
            )

        embedder = self._get_embedder()
        query_vector = embedder.encode([question], normalize_embeddings=True).tolist()

        user_chunks_total = sum(int(d.get("chunk_count", 0)) for d in user_docs)
        where_filter: dict[str, Any] = (
            {"$and": [{"user_id": user_id}, {"document_id": document_id}]}
            if document_id
            else {"user_id": user_id}
        )

        results = collection.query(
            query_embeddings=query_vector,
            n_results=min(top_k, max(1, user_chunks_total)),
            where=where_filter,
            include=["documents", "metadatas", "distances"],
        )
        docs = (results.get("documents") or [[]])[0]
        metas = (results.get("metadatas") or [[]])[0]
        distances = (results.get("distances") or [[]])[0]

        sources: list[dict[str, Any]] = []
        for text, meta, dist in zip(docs, metas, distances):
            similarity = max(0.0, min(1.0, round(1.0 - float(dist), 4)))
            sources.append(
                {
                    "document_id": meta.get("document_id", ""),
                    "filename": meta.get("filename", "Unknown"),
                    "page_number": int(meta.get("page_number", 1)),
                    "chunk_index": int(meta.get("chunk_index", 0)),
                    "score": similarity,
                    "excerpt": text,
                }
            )

        return sources

    # Stages 6 & 7: GENERATE + DISPLAY PAYLOAD
    async def query(
        self,
        question: str,
        user_id: str,
        document_id: Optional[str] = None,
        top_k: int = 4,
    ) -> dict[str, Any]:
        sources = self.retrieve(
            question=question, user_id=user_id, document_id=document_id, top_k=top_k
        )

        if not sources:
            return {
                "answer": "No matching passages were found in the selected document.",
                "sources": [],
                "insufficient_context": True,
                "generated_by_ai": False,
                "model": settings.GEMINI_MODEL,
                "stages_executed": ["retrieve"],
            }

        best_score = max(s["score"] for s in sources)
        low_similarity = best_score < MIN_SIMILARITY_THRESHOLD

        if not settings.GEMINI_API_KEY:
            return {
                "answer": (
                    "ChromaDB retrieval succeeded and found relevant chunks below. "
                    "However, GEMINI_API_KEY is not configured on the backend server, so Stage 6 "
                    "(Gemini answer synthesis) could not run. Add GEMINI_API_KEY to backend/.env "
                    "to generate full natural-language answers."
                ),
                "sources": sources,
                "insufficient_context": low_similarity,
                "generated_by_ai": False,
                "model": settings.GEMINI_MODEL,
                "stages_executed": ["retrieve", "display"],
            }

        context_blocks = []
        for idx, src in enumerate(sources, start=1):
            context_blocks.append(
                f"[Source {idx} | File: {src['filename']} | Page {src['page_number']} | Similarity: {src['score']:.2f}]\n"
                f"{src['excerpt']}"
            )
        context_text = "\n\n---\n\n".join(context_blocks)

        system_prompt = (
            "You are CampusX Document AI Assistant. Answer the student's question using ONLY the "
            "retrieved document excerpts below. Cite page numbers inline like (Page 2). "
            "If the retrieved excerpts do not contain enough information to answer the question "
            "accurately, state clearly that the uploaded document does not contain enough "
            "information instead of guessing."
        )
        user_prompt = (
            f"Retrieved Context:\n{context_text}\n\n"
            f"Student Question: {question}\n\n"
            "Provide a clear, concise, well-structured answer grounded in the context above."
        )

        answer, used_model = await generate_with_gemini(
            contents=user_prompt,
            system_instruction=system_prompt,
            temperature=0.2,
            max_output_tokens=700,
        )

        insufficient_markers = (
            "does not contain enough information",
            "not mentioned in the provided",
            "not enough information in the uploaded",
        )
        insufficient = low_similarity or any(
            m in answer.lower() for m in insufficient_markers
        )

        return {
            "answer": answer,
            "sources": sources,
            "insufficient_context": insufficient,
            "generated_by_ai": True,
            "model": used_model,
            "stages_executed": ["retrieve", "generate", "display"],
        }


rag_pipeline = RagPipeline()
