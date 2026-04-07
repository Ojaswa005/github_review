from __future__ import annotations

from collections import defaultdict

from app.loaders.github_loader import GitHubLoader
from app.services.evaluation_service import EvaluationService
from app.services.rag_service import RAGService


ROLE_JOB_TEMPLATES = {
    "backend": (
        "Looking for a backend engineer skilled in Python, APIs, microservices, SQL/NoSQL, "
        "testing, scalability, and production-grade architecture."
    ),
    "frontend": (
        "Looking for a frontend engineer skilled in JavaScript/TypeScript, React, performance, "
        "accessibility, responsive design, and modern UI architecture."
    ),
    "ml": (
        "Looking for an ML engineer skilled in Python, model training, data pipelines, "
        "evaluation metrics, deployment, and MLOps best practices."
    ),
}


class GitHubService:
    def __init__(self) -> None:
        self.loader = GitHubLoader()
        self.rag_service = RAGService()
        self.evaluation_service = EvaluationService()

    def analyze_user(self, user: str, role: str, job_description: str | None = None) -> dict:
        repos = self.loader.fetch_user_repos(user)
        if not repos:
            raise ValueError(f"No non-fork repositories found for '{user}'.")

        final_job_description = job_description or ROLE_JOB_TEMPLATES.get(
            role.lower(), f"Looking for a {role} engineer with strong practical project experience."
        )

        store = self.rag_service.build_index(username=user, repos=repos)
        retrieved = self.rag_service.retrieve(query=final_job_description, store=store, top_k=10)
        evaluation = self.evaluation_service.evaluate(
            username=user,
            role=role,
            job_description=final_job_description,
            retrieved_chunks=retrieved,
        )

        return {
            "username": user,
            "role": role,
            "job_description": final_job_description,
            "match_score": evaluation["score"],
            "strengths": evaluation["strengths"],
            "weaknesses": evaluation["weaknesses"],
            "suggestions": evaluation["suggestions"],
            "repo_insights": self._build_repo_insights(retrieved),
            "analyzed_repo_count": len(repos),
        }

    @staticmethod
    def list_roles() -> list[str]:
        return sorted(ROLE_JOB_TEMPLATES.keys())

    @staticmethod
    def _build_repo_insights(retrieved_chunks: list[dict]) -> list[dict]:
        grouped: dict[str, dict] = defaultdict(
            lambda: {"repo_name": "", "language": "Unknown", "stars": 0, "avg_relevance": 0.0, "evidence": []}
        )

        for item in retrieved_chunks:
            repo_name = item.get("repo_name", "unknown")
            repo = grouped[repo_name]
            repo["repo_name"] = repo_name
            repo["language"] = item.get("language", "Unknown")
            repo["stars"] = item.get("stars", 0)
            repo["evidence"].append(item.get("text", "")[:240])
            current = repo["avg_relevance"]
            count = len(repo["evidence"])
            repo["avg_relevance"] = ((current * (count - 1)) + float(item.get("score", 0.0))) / count

        insights = list(grouped.values())
        insights.sort(key=lambda x: x["avg_relevance"], reverse=True)
        for insight in insights:
            insight["avg_relevance"] = round(insight["avg_relevance"], 4)
            insight["evidence"] = insight["evidence"][:2]
        return insights[:5]
