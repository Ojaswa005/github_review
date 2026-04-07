def build_evaluation_prompt(
    username: str, role: str, job_description: str, retrieved_chunks: list[dict]
) -> str:
    context_lines = []
    for item in retrieved_chunks:
        context_lines.append(
            f"- repo={item.get('repo_name')} | language={item.get('language')} "
            f"| stars={item.get('stars')} | relevance={item.get('score', 0):.3f}\n"
            f"  content: {item.get('text', '')}"
        )
    context_blob = "\n".join(context_lines) if context_lines else "No relevant context found."

    return f"""
You are a hiring expert.

Candidate GitHub username: {username}
Target role: {role}
Job description:
{job_description}

Relevant GitHub evidence:
{context_blob}

Evaluate candidate based on:
- skill match
- project depth
- activity

Return valid JSON only with this schema:
{{
  "score": number,
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": ["..."]
}}

Rules:
- Score must be 0 to 100.
- strengths/weaknesses/suggestions should each have 3 to 6 concise bullets.
- Use only evidence in the provided GitHub context.
""".strip()

