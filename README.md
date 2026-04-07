# GitHub Job Fit Analyzer (RAG + Chrome Extension)

Production-ready project that scores a GitHub profile against a target role using:
- GitHub API data loading
- Local sentence-transformer embeddings
- FAISS retrieval
- GROQ LLM evaluation
- FastAPI backend
- Chrome extension frontend

## Project Structure

```text
backend/
  app/
    main.py
    config.py
    api/routes.py
    services/
    loaders/
    processors/
    embeddings/
    vectorstore/
    retrieval/
    prompts/
  main.py
  requirements.txt
  .env.example
extension/
  manifest.json
  content.js
  ui/inject.js
  styles.css
```

## Backend Setup

1. Create virtual env and install deps:
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

2. Configure env:
```bash
copy .env.example .env
```
Set `GROQ_API_KEY` in `.env`.
If a model gets deprecated, update:
- `GROQ_MODEL` (primary)
- `GROQ_FALLBACK_MODELS` (comma-separated backups)

3. Run API:
```bash
python main.py
```

API available at `http://127.0.0.1:8000`

Health check:
```bash
curl http://127.0.0.1:8000/health
```

Analyze endpoint:
```bash
curl "http://127.0.0.1:8000/analyze?user=torvalds&role=backend"
```

## Chrome Extension Setup

1. Open Chrome: `chrome://extensions/`
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Open any GitHub profile page and click **Analyze** in the floating panel.

## Notes

- Uses only local embeddings (`sentence-transformers/all-MiniLM-L6-v2`), no OpenAI embeddings.
- Uses Groq chat completion for final scoring/evaluation.
- FAISS index is stored under `backend/data/<github_username>/`.
