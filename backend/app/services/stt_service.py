from __future__ import annotations

import gc
import io
import itertools
import threading
from typing import Optional

import av
import numpy as np
from fastapi import HTTPException
from faster_whisper import WhisperModel

DEFAULT_WHISPER_MODEL = "base"


def _decode_audio_to_float32(audio_bytes: bytes, sampling_rate: int = 16000) -> np.ndarray:
    """Decode webm/ogg/wav/mp4 audio bytes to 16kHz mono float32 using PyAV."""
    resampler = av.audio.resampler.AudioResampler(
        format="s16",
        layout="mono",
        rate=sampling_rate,
    )
    raw_buffer = io.BytesIO()
    dtype = np.int16

    with av.open(io.BytesIO(audio_bytes), mode="r") as container:
        audio_streams = [s for s in container.streams if s.type == "audio"]
        if not audio_streams:
            raise ValueError("Uploaded recording contains no audio stream.")

        for frame in itertools.chain(container.decode(audio=0), [None]):
            for resampled in resampler.resample(frame):
                array = resampled.to_ndarray()
                dtype = array.dtype
                raw_buffer.write(array.tobytes())

    del resampler
    gc.collect()

    raw_bytes = raw_buffer.getvalue()
    if not raw_bytes:
        return np.zeros(0, dtype=np.float32)
    audio = np.frombuffer(raw_bytes, dtype=dtype)
    return audio.astype(np.float32) / 32768.0


class LocalSpeechToTextService:
    """Free, offline speech-to-text service powered by faster-whisper (CTranslate2)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model: Optional[WhisperModel] = None

    def _get_model(self) -> WhisperModel:
        if self._model is None:
            with self._lock:
                if self._model is None:
                    try:
                        self._model = WhisperModel(
                            DEFAULT_WHISPER_MODEL,
                            device="cpu",
                            compute_type="int8",
                            local_files_only=True,
                        )
                    except Exception:
                        self._model = WhisperModel(
                            DEFAULT_WHISPER_MODEL,
                            device="cpu",
                            compute_type="int8",
                        )
        return self._model

    @staticmethod
    def _normalize_language(language_hint: str) -> Optional[str]:
        hint = (language_hint or "").strip().lower()
        if hint.startswith("hi"):
            return "hi"
        if hint.startswith("en"):
            return "en"
        return None

    def transcribe_bytes(
        self, audio_bytes: bytes, filename: str, language_hint: str = "en-IN"
    ) -> dict[str, object]:
        if not audio_bytes or len(audio_bytes) < 100:
            raise HTTPException(
                status_code=400,
                detail="Recorded audio was empty. Please speak into your microphone and try again.",
            )

        try:
            audio_array = _decode_audio_to_float32(audio_bytes)
            if audio_array.size < 800:
                raise HTTPException(
                    status_code=400,
                    detail="Recorded audio was too short or silent. Please speak clearly and try again.",
                )

            model = self._get_model()
            lang_code = self._normalize_language(language_hint)
            segments, info = model.transcribe(
                audio_array,
                language=lang_code,
                beam_size=5,
                vad_filter=False,
            )
            text_parts = [seg.text.strip() for seg in segments if seg.text and seg.text.strip()]
            transcript = " ".join(text_parts).strip()

            if not transcript:
                raise HTTPException(
                    status_code=400,
                    detail="No speech was detected in the recording. Please speak clearly or type below.",
                )

            return {
                "transcript": transcript,
                "language": getattr(info, "language", lang_code or "en"),
                "duration_seconds": round(float(audio_array.size) / 16000.0, 2),
                "engine": f"faster-whisper ({DEFAULT_WHISPER_MODEL})",
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Audio transcription failed: {exc}",
            )


stt_service = LocalSpeechToTextService()
