from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path
from typing import Optional

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials
from google.auth import exceptions as google_auth_exceptions
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel

from app.config import settings

_bearer_scheme = HTTPBearer(auto_error=False)
_init_lock = threading.Lock()
_firebase_app: Optional[firebase_admin.App] = None
_google_request: Optional[google_requests.Request] = None


class AuthenticatedUser(BaseModel):
    uid: str
    email: str = ""
    name: str = ""
    picture: str = ""
    email_verified: bool = False


def is_firebase_configured() -> bool:
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            parsed = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            if isinstance(parsed, dict) and parsed.get("project_id"):
                return True
        except json.JSONDecodeError:
            pass
    if settings.FIREBASE_SERVICE_ACCOUNT_PATH and Path(settings.FIREBASE_SERVICE_ACCOUNT_PATH).is_file():
        return True
    if settings.FIREBASE_PROJECT_ID:
        return True
    return False


def _get_firebase_app() -> firebase_admin.App:
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    with _init_lock:
        if _firebase_app is not None:
            return _firebase_app

        try:
            _firebase_app = firebase_admin.get_app()
            return _firebase_app
        except ValueError:
            pass

        if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
            try:
                info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
                cred = credentials.Certificate(info)
                _firebase_app = firebase_admin.initialize_app(cred)
                return _firebase_app
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail=f"Invalid FIREBASE_SERVICE_ACCOUNT_JSON configuration: {exc}",
                )

        if (
            settings.FIREBASE_SERVICE_ACCOUNT_PATH
            and Path(settings.FIREBASE_SERVICE_ACCOUNT_PATH).is_file()
        ):
            try:
                cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
                _firebase_app = firebase_admin.initialize_app(cred)
                return _firebase_app
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail=f"Invalid Firebase service account file: {exc}",
                )

        if settings.FIREBASE_PROJECT_ID:
            _firebase_app = firebase_admin.initialize_app(
                options={"projectId": settings.FIREBASE_PROJECT_ID}
            )
            return _firebase_app

        raise HTTPException(
            status_code=503,
            detail=(
                "Firebase Authentication is not configured on the backend server. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH (or FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_PROJECT_ID) in backend/.env."
            ),
        )


def _has_service_account_creds() -> bool:
    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        try:
            parsed = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
            if isinstance(parsed, dict) and parsed.get("project_id"):
                return True
        except json.JSONDecodeError:
            pass
    if settings.FIREBASE_SERVICE_ACCOUNT_PATH and Path(settings.FIREBASE_SERVICE_ACCOUNT_PATH).is_file():
        return True
    return False


def _get_google_request() -> google_requests.Request:
    global _google_request
    if _google_request is None:
        _google_request = google_requests.Request()
    return _google_request


def _verify_token_sync(token: str) -> AuthenticatedUser:
    if _has_service_account_creds():
        app = _get_firebase_app()
        decoded = firebase_auth.verify_id_token(token, app=app)
    elif settings.FIREBASE_PROJECT_ID:
        decoded = google_id_token.verify_firebase_token(
            token,
            _get_google_request(),
            audience=settings.FIREBASE_PROJECT_ID,
        )
    else:
        raise HTTPException(
            status_code=503,
            detail=(
                "Firebase Authentication is not configured on the backend server. "
                "Set FIREBASE_SERVICE_ACCOUNT_PATH (or FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_PROJECT_ID) in backend/.env."
            ),
        )

    return AuthenticatedUser(
        uid=str(decoded.get("uid") or decoded.get("sub") or ""),
        email=str(decoded.get("email") or ""),
        name=str(decoded.get("name") or decoded.get("email") or "CampusX Student"),
        picture=str(decoded.get("picture") or ""),
        email_verified=bool(decoded.get("email_verified", False)),
    )


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> AuthenticatedUser:
    """Verify Firebase ID token from Authorization: Bearer <token> header."""
    if creds is None or creds.scheme.lower() != "bearer" or not creds.credentials.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_ACCOUNT_UNAVAILABLE
            if hasattr(status, "HTTP_503_SERVICE_ACCOUNT_UNAVAILABLE")
            else status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Firebase Authentication is not configured on the backend server. "
                "Add Firebase Admin credentials to backend/.env."
            ),
        )

    token = creds.credentials.strip()
    try:
        user = await asyncio.to_thread(_verify_token_sync, token)
    except HTTPException:
        raise
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your login session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has been revoked. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (firebase_auth.InvalidIdTokenError, google_auth_exceptions.GoogleAuthError, ValueError) as exc:
        detail = "Invalid authentication token. Please sign in again."
        if "expired" in str(exc).lower():
            detail = "Your login session has expired. Please sign in again."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated token is missing a valid user ID.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
