from fastapi import APIRouter, Depends
from app.auth.firebase_auth import AuthenticatedUser, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=AuthenticatedUser)
async def get_authenticated_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """Verify the caller's Firebase ID token and return their authenticated identity."""
    return current_user
