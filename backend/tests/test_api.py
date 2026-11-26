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

        from app.routes import weather as weather_mod
        # Clear any disk/memory weather cache before deterministic multi-city/cooldown checks
        weather_mod._disk_loaded = True
        weather_mod._weather_cache.clear()
        weather_mod._geo_cache.clear()
        weather_mod._rate_limited_until = 0.0

        # Weather tests
        r_empty = client.get("/api/weather?city=   ")
        assert r_empty.status_code == 400, r_empty.text
        r_missing = client.get("/api/weather?city=InvalidCityXYZ99999")
        assert r_missing.status_code == 404, r_missing.text
        print("[PASS] /api/weather empty city (400) & invalid city (404)")

        for test_city in ("Jaipur", "Bengaluru", "Mumbai", "Delhi"):
            r_city = client.get(f"/api/weather?city={test_city}")
            assert r_city.status_code == 200, r_city.text
            w = r_city.json()
            assert w["provider"] == "Open-Meteo"
            assert w["cached"] is False
            print(
                f"[PASS] /api/weather {w['city']}: {w['temperature_c']}°C, "
                f"humidity={w['humidity']}%, wind={w['wind_speed_kmh']} km/h"
            )

        # Repeated search must reuse 10-minute backend cache across all cities/aliases
        r_cached = client.get("/api/weather?city=Jaipur")
        assert r_cached.status_code == 200, r_cached.text
        assert r_cached.json()["cached"] is True
        r_alias = client.get("/api/weather?city=Bangalore")
        assert r_alias.status_code == 200, r_alias.text
        assert r_alias.json()["cached"] is True
        print("[PASS] /api/weather repeat & alias searches served from 10-minute cache")

        # Duplicate concurrent requests deduplicate into a single upstream call
        import asyncio as _asyncio
        call_counter = {"count": 0}
        orig_fetch = weather_mod._fetch_weather_from_open_meteo

        async def _counted_fetch(clean_city: str, city_key: str):
            call_counter["count"] += 1
            await _asyncio.sleep(0.05)
            return {
                "city": clean_city,
                "region": "",
                "country": "IN",
                "latitude": 18.52,
                "longitude": 73.85,
                "temperature_c": 24.0,
                "feels_like_c": 24.5,
                "humidity": 55,
                "pressure_hpa": 1012,
                "wind_speed_kmh": 8.0,
                "wind_speed_ms": 2.2,
                "weather_code": 1,
                "condition": "Mainly Clear",
                "description": "Mainly Clear",
                "icon": "partly-cloudy-day",
                "is_day": True,
                "provider": "Open-Meteo",
                "attribution_url": "https://open-meteo.com/",
                "fetched_at": "2026-11-27T00:00:00+00:00",
                "cached": False,
                "stale": False,
            }

        async def _run_concurrent_dup():
            return await _asyncio.gather(
                weather_mod.get_weather(city="Pune", _current_user=user_alpha),
                weather_mod.get_weather(city="Pune", _current_user=user_beta),
            )

        weather_mod._fetch_weather_from_open_meteo = _counted_fetch
        try:
            dup_results = _asyncio.run(_run_concurrent_dup())
            assert call_counter["count"] == 1, f"Expected 1 call, got {call_counter['count']}"
            assert len(dup_results) == 2
            print("[PASS] /api/weather deduplicates concurrent duplicate requests into 1 upstream call")
        finally:
            weather_mod._fetch_weather_from_open_meteo = orig_fetch
            weather_mod._weather_cache.pop("pune", None)

        # Global HTTP 429 cooldown across cities + Retry-After + stale fallback + recovery
        assert weather_mod._parse_retry_after("45") == 45
        orig_until = weather_mod._rate_limited_until
        orig_jaipur_entry = weather_mod._weather_cache.get("jaipur")
        try:
            weather_mod._rate_limited_until = weather_mod.time.monotonic() + 30
            # Any uncached city immediately returns 429 with matching Retry-After and ZERO upstream calls
            r_429_a = client.get("/api/weather?city=UncachedRateLimitCityA")
            r_429_b = client.get("/api/weather?city=UncachedRateLimitCityB")
            assert r_429_a.status_code == 429 and r_429_b.status_code == 429
            assert 1 <= int(r_429_a.headers.get("Retry-After", "0")) <= 30
            assert 1 <= int(r_429_b.headers.get("Retry-After", "0")) <= 30

            # Expired cache falls back cleanly during upstream 429
            if orig_jaipur_entry:
                weather_mod._weather_cache["jaipur"] = (
                    weather_mod.time.monotonic() - weather_mod.WEATHER_CACHE_TTL_SECONDS - 10,
                    orig_jaipur_entry[1],
                )
                r_stale = client.get("/api/weather?city=Jaipur")
                assert r_stale.status_code == 200, r_stale.text
                assert r_stale.json()["stale"] is True

            # Recovery once cooldown expires
            weather_mod._rate_limited_until = weather_mod.time.monotonic() - 1
            weather_mod._weather_cache.pop("jaipur", None)
            r_recovered = client.get("/api/weather?city=Jaipur")
            assert r_recovered.status_code == 200, r_recovered.text
            assert r_recovered.json()["stale"] is False
            print("[PASS] /api/weather enforces global 429 cooldown, stale fallback, and recovers cleanly")
        finally:
            weather_mod._rate_limited_until = orig_until
            if orig_jaipur_entry:
                weather_mod._weather_cache["jaipur"] = orig_jaipur_entry

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
