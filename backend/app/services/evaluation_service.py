from __future__ import annotations

import json
import re
from typing import Any

from groq import Groq
from groq import BadRequestError

from app.config import get_groq_model_candidates, settings
from app.prompts.evaluation_prompt import build_evaluation_prompt


class EvaluationService:
    def __init__(self) -> None:
        self.client: Groq | None = None

    def evaluate(
        self, username: str, role: str, job_description: str, retrieved_chunks: list[dict]
    ) -> dict[str, Any]:
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is not set in environment.")
        if self.client is None:
            self.client = Groq(api_key=settings.groq_api_key)

        prompt = build_evaluation_prompt(
            username=username,
            role=role,
            job_description=job_description,
            retrieved_chunks=retrieved_chunks,
        )

        model_candidates = get_groq_model_candidates()
        if not model_candidates:
            raise ValueError("No GROQ models configured. Set GROQ_MODEL in .env.")

        completion = None
        last_error: Exception | None = None
        for model in model_candidates:
            try:
                completion = self.client.chat.completions.create(
                    model=model,
                    temperature=0.2,
                    messages=[
                        {"role": "system", "content": "You are a precise hiring evaluator."},
                        {"role": "user", "content": prompt},
                    ],
                )
                break
            except BadRequestError as exc:
                text = str(exc).lower()
                # Continue on model-level issues so we can try fallback models.
                if (
                    "decommissioned" in text
                    or "model_decommissioned" in text
                    or "model_not_found" in text
                    or "invalid model" in text
                    or "not supported" in text
                ):
                    last_error = exc
                    continue
                raise
            except Exception as exc:
                last_error = exc
                continue

        if completion is None:
            raise ValueError(
                "All configured Groq models failed. "
                f"Tried: {', '.join(model_candidates)}. Last error: {last_error}"
            )

        content = completion.choices[0].message.content or "{}"
        parsed = self._parse_json(content)
        parsed["score"] = int(max(0, min(100, int(parsed.get("score", 0)))))
        parsed["strengths"] = list(parsed.get("strengths", []))
        parsed["weaknesses"] = list(parsed.get("weaknesses", []))
        parsed["suggestions"] = list(parsed.get("suggestions", []))
        return parsed

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", text)
            if not match:
                return {
                    "score": 0,
                    "strengths": [],
                    "weaknesses": ["Model output could not be parsed."],
                    "suggestions": ["Try running analysis again."],
                }
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {
                    "score": 0,
                    "strengths": [],
                    "weaknesses": ["Model output contained invalid JSON."],
                    "suggestions": ["Try running analysis again."],
                }
