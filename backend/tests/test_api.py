"""End-to-end tests for CampusX FastAPI endpoints, Firebase Auth security, RAG, Voice, Weather, and Chat."""

import os
import subprocess
import tempfile
from fastapi.testclient import TestClient

from app.auth.firebase_auth import AuthenticatedUser, get_current_user
from app.main import app


def make_test_pdf(pages_text: list[str]) -> bytes:
    """Build a minimal valid multi-page PDF with real extractable text."""
    objects: list[bytes] = []
    page_ids = []
    content_ids = []
    next_id = 4

    for _ in pages_text:
        page_ids.append(next_id)
        content_ids.append(next_id + 1)
        next_id += 2

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("ascii"))
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page_id, content_id, text in zip(page_ids, content_ids, pages_text):
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>".encode("ascii")
        )
        safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode("latin-1")
        objects.append(
            f"<< /Length {len(stream)} >>\nstream\n".encode("ascii")
            + stream
            + b"\nendstream"
        )

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{idx} 0 obj\n".encode("ascii"))
        out.extend(obj)
        out.extend(b"\nendobj\n")

    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    out.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return bytes(out)


def run_tests() -> None:
    client = TestClient(app)

    # 1. Public health check
    r = client.get("/api/health")
    assert r.status_code == 200, r.text
    health = r.json()
    assert health["status"] == "ok"
    assert "firebase_auth_configured" in health["integrations"]
    print("[PASS] /api/health:", health)

    # 2. Protected route enforcement (must reject missing & invalid Bearer tokens)
    protected_calls = [
        ("GET", "/api/auth/me"),
        ("GET", "/api/weather?city=Bengaluru"),
        ("POST", "/api/chat"),
        ("GET", "/api/rag/documents"),
        ("POST", "/api/rag/query"),
        ("POST", "/api/voice-study/parse"),
    ]
    for method, path in protected_calls:
        resp = client.request(method, path)
        assert resp.status_code == 401, f"{method} {path} expected 401, got {resp.status_code}"

    bad_token_resp = client.get(
        "/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"}
    )
    if health["integrations"]["firebase_auth_configured"]:
        assert bad_token_resp.status_code == 401, bad_token_resp.text
        print("[PASS] Backend rejects missing (401) and invalid Firebase tokens (401)")
    else:
        assert bad_token_resp.status_code == 503, bad_token_resp.text
        print("[PASS] Backend rejects missing tokens (401) & reports unconfigured Firebase (503)")

    # 3. Authenticated functional & cross-user isolation tests
    user_alpha = AuthenticatedUser(
        uid="test-student-alpha",
        email="alpha@campusx.edu",
        name="Alpha Student",
        email_verified=True,
    )
    user_beta = AuthenticatedUser(
        uid="test-student-beta",
        email="beta@campusx.edu",
        name="Beta Student",
        email_verified=True,
    )
    active_user = {"current": user_alpha}
    app.dependency_overrides[get_current_user] = lambda: active_user["current"]

    try:
        r_me = client.get("/api/auth/me")
        assert r_me.status_code == 200, r_me.text
        assert r_me.json()["uid"] == "test-student-alpha"
        print("[PASS] /api/auth/me returns authenticated student identity")

        # Weather tests
        r_empty = client.get("/api/weather?city=   ")
        assert r_empty.status_code == 400, r_empty.text
        r_missing = client.get("/api/weather?city=InvalidCityXYZ99999")
        assert r_missing.status_code == 404, r_missing.text
        print("[PASS] /api/weather empty city (400) & invalid city (404)")

        for test_city in ("Jaipur", "Bengaluru", "Mumbai"):
            r_city = client.get(f"/api/weather?city={test_city}")
            assert r_city.status_code == 200, r_city.text
            w = r_city.json()
            assert w["provider"] == "Open-Meteo"
            print(
                f"[PASS] /api/weather {w['city']}: {w['temperature_c']}°C, "
                f"humidity={w['humidity']}%, wind={w['wind_speed_kmh']} km/h"
            )

        # Chat tests
        r_bad_temp = client.post(
            "/api/chat",
            json={"messages": [{"role": "user", "content": "Hello"}], "temperature": 1.5},
        )
        assert r_bad_temp.status_code == 422, r_bad_temp.text

        if health["integrations"]["gemini_configured"]:
            r_chat = client.post(
                "/api/chat",
                json={"messages": [{"role": "user", "content": "Explain RAG in one sentence."}], "temperature": 0.4},
            )
            assert r_chat.status_code == 200, r_chat.text
            assert r_chat.json()["temperature"] == 0.4
            print("[PASS] /api/chat live Gemini response (temp=0.4):", r_chat.json()["model"])

        # RAG upload + cross-user data isolation
        r_txt = client.post(
            "/api/rag/upload",
            files={"file": ("notes.txt", b"hello world", "text/plain")},
        )
        assert r_txt.status_code == 400, r_txt.text

        pdf_bytes = make_test_pdf(
            [
                "CampusX Personal Portfolio, Dark Light Mode, and Prompt Engineering MCQs.",
                "CampusX Document AI implements ChromaDB vector storage and Sentence Transformers embeddings for RAG.",
            ]
        )
        r_up = client.post(
            "/api/rag/upload",
            files={"file": ("alpha_notes.pdf", pdf_bytes, "application/pdf")},
        )
        assert r_up.status_code == 200, r_up.text
        doc_id = r_up.json()["document_id"]
        assert r_up.json()["user_id"] == "test-student-alpha"
        print("[PASS] /api/rag/upload indexed PDF scoped to Alpha Student:", doc_id)

        # Switch to Beta Student and verify strict isolation
        active_user["current"] = user_beta
        r_beta_docs = client.get("/api/rag/documents")
        assert r_beta_docs.status_code == 200, r_beta_docs.text
        assert all(d["document_id"] != doc_id for d in r_beta_docs.json()["documents"])

        r_beta_query = client.post(
            "/api/rag/query",
            json={"question": "What does Document AI use?", "document_id": doc_id, "top_k": 2},
        )
        assert r_beta_query.status_code == 403, r_beta_query.text

        r_beta_del = client.delete(f"/api/rag/documents/{doc_id}")
        assert r_beta_del.status_code == 403, r_beta_del.text
        print("[PASS] Cross-user RAG isolation verified (Beta cannot list, query, or delete Alpha PDF)")

        # Switch back to Alpha Student to query & clean up
        active_user["current"] = user_alpha
        r_alpha_query = client.post(
            "/api/rag/query",
            json={"question": "Which component uses ChromaDB vector storage?", "document_id": doc_id, "top_k": 2},
        )
        assert r_alpha_query.status_code == 200, r_alpha_query.text
        assert r_alpha_query.json()["sources"][0]["page_number"] == 2
        print("[PASS] Alpha Student RAG query retrieved Page 2 top source:", r_alpha_query.json()["sources"][0]["score"])

        r_del = client.delete(f"/api/rag/documents/{doc_id}")
        assert r_del.status_code == 200, r_del.text
        print("[PASS] Alpha Student cleaned up test PDF")

        # Voice Study Assistant STT + Parse + Generate
        r_empty_audio = client.post(
            "/api/voice-study/transcribe",
            files={"file": ("empty.webm", b"", "audio/webm")},
            data={"language": "en-IN"},
        )
        assert r_empty_audio.status_code == 400, r_empty_audio.text

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_wav:
            wav_path = tmp_wav.name
        try:
            ps_script = (
                "Add-Type -AssemblyName System.Speech; "
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$s.SetOutputToWaveFile('{wav_path}'); "
                "$s.Speak('I have a database exam on December six'); "
                "$s.Dispose()"
            )
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_script],
                check=True,
                capture_output=True,
            )
            with open(wav_path, "rb") as f:
                wav_bytes = f.read()
            r_stt = client.post(
                "/api/voice-study/transcribe",
                files={"file": ("speech_test.wav", wav_bytes, "audio/wav")},
                data={"language": "en-IN"},
            )
            assert r_stt.status_code == 200, r_stt.text
            assert "database" in r_stt.json()["transcript"].lower()
            print("[PASS] /api/voice-study/transcribe real speech STT:", repr(r_stt.json()["transcript"]))
        finally:
            if os.path.exists(wav_path):
                os.remove(wav_path)

        if health["integrations"]["gemini_configured"]:
            r_inc = client.post(
                "/api/voice-study/parse",
                json={
                    "transcript": "I want to prepare for Computer Networks. I can study 2 hours daily.",
                    "language": "en-IN",
                    "today_date": "2026-11-26",
                },
            )
            assert r_inc.status_code == 200, r_inc.text
            assert r_inc.json()["requirements"]["ready_to_generate"] is False
            print("[PASS] /api/voice-study/parse flags missing exam_date & chapters")
    finally:
        app.dependency_overrides.clear()


if __name__ == "__main__":
    run_tests()
