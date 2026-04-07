from __future__ import annotations

from typing import Any

import requests

from app.config import settings


class GitHubLoader:
    def __init__(self) -> None:
        self.base_url = settings.github_api_base
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/vnd.github+json",
                "User-Agent": "github-job-fit-analyzer",
            }
        )
        if settings.github_token:
            self.session.headers["Authorization"] = f"Bearer {settings.github_token}"

    def fetch_user_repos(self, username: str) -> list[dict[str, Any]]:
        repos: list[dict[str, Any]] = []
        page = 1

        while True:
            response = self.session.get(
                f"{self.base_url}/users/{username}/repos",
                params={"per_page": 100, "page": page, "type": "owner", "sort": "updated"},
                timeout=30,
            )
            if response.status_code == 404:
                raise ValueError(f"GitHub user '{username}' not found.")
            response.raise_for_status()

            page_data = response.json()
            if not page_data:
                break

            for repo in page_data:
                if repo.get("fork"):
                    continue
                if repo.get("size", 0) == 0:
                    continue
                readme = self.fetch_repo_readme(username, repo["name"])
                repos.append(
                    {
                        "name": repo.get("name", ""),
                        "description": repo.get("description") or "",
                        "language": repo.get("language") or "Unknown",
                        "stars": repo.get("stargazers_count", 0),
                        "readme": readme,
                        "html_url": repo.get("html_url", ""),
                        "updated_at": repo.get("updated_at", ""),
                    }
                )
            page += 1
        return repos

    def fetch_repo_readme(self, owner: str, repo: str) -> str:
        response = self.session.get(
            f"{self.base_url}/repos/{owner}/{repo}/readme",
            headers={"Accept": "application/vnd.github.raw+json"},
            timeout=30,
        )
        if response.status_code == 404:
            return ""
        response.raise_for_status()
        return response.text.strip()

