from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from app.auth.firebase_auth import AuthenticatedUser, get_current_user
from app.models.schemas import RagQueryRequest
from app.rag.pipeline import rag_pipeline

router = APIRouter(prefix="/api/rag", tags=["rag"])

MAX_PDF_BYTES = 15 * 1024 * 1024  # 15 MB


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was provided.")

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(
            status_code=400,
            detail="PDF file exceeds the 15 MB upload limit.",
        )

    return await rag_pipeline.ingest_pdf(content, file.filename, user_id=current_user.uid)


@router.get("/documents")
async def get_documents(current_user: AuthenticatedUser = Depends(get_current_user)):
    return {"documents": rag_pipeline.list_documents(user_id=current_user.uid)}


@router.delete("/documents/{document_id}")
async def remove_document(
    document_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return rag_pipeline.delete_document(document_id, user_id=current_user.uid)


@router.post("/query")
async def query_documents(
    payload: RagQueryRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Please enter a question.")

    return await rag_pipeline.query(
        question=question,
        user_id=current_user.uid,
        document_id=payload.document_id,
        top_k=payload.top_k,
    )
