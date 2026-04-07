from fastapi import APIRouter, HTTPException, Query

from app.services.github_service import GitHubService

router = APIRouter()
github_service = GitHubService()


@router.get("/roles")
def roles() -> dict:
    return {"roles": github_service.list_roles()}


@router.get("/analyze")
def analyze_profile(
    user: str = Query(..., description="GitHub username"),
    role: str = Query(..., description="Target role like backend/frontend/ml"),
    job_description: str | None = Query(
        None, description="Optional custom job description"
    ),
) -> dict:
    try:
        return github_service.analyze_user(user=user, role=role, job_description=job_description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc
