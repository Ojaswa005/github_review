from __future__ import annotations

from app.config import settings
from app.embeddings.embedder import Embedder
from app.processors.chunker import TextChunker
from app.processors.cleaner import TextCleaner
from app.retrieval.retriever import Retriever
from app.vectorstore.faiss_store import FaissStore


class RAGService:
    def __init__(self) -> None:
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.cleaner = TextCleaner()
        self.chunker = TextChunker()
        self.embedder = Embedder()

    def build_index(self, username: str, repos: list[dict]) -> FaissStore:
        store = FaissStore(root_dir=settings.data_dir, namespace=username)
        docs: list[dict] = []

        for repo in repos:
            readme = repo.get("readme", "")
            cleaned = self.cleaner.clean_markdown(readme)
            chunks = self.chunker.chunk_text(cleaned)

            for chunk_id, chunk in enumerate(chunks):
                docs.append(
                    {
                        "repo_name": repo.get("name", ""),
                        "description": repo.get("description", ""),
                        "language": repo.get("language", ""),
                        "stars": repo.get("stars", 0),
                        "repo_url": repo.get("html_url", ""),
                        "chunk_id": chunk_id,
                        "text": chunk,
                    }
                )

        if not docs:
            raise ValueError("No README content found to analyze.")

        embeddings = self.embedder.encode([d["text"] for d in docs])
        store.build(embeddings=embeddings, metadata=docs)
        return store

    def retrieve(self, query: str, store: FaissStore, top_k: int = 8) -> list[dict]:
        retriever = Retriever(embedder=self.embedder, store=store)
        return retriever.retrieve(query=query, top_k=top_k)

