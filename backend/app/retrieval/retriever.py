from app.embeddings.embedder import Embedder
from app.vectorstore.faiss_store import FaissStore


class Retriever:
    def __init__(self, embedder: Embedder, store: FaissStore):
        self.embedder = embedder
        self.store = store

    def retrieve(self, query: str, top_k: int = 8) -> list[dict]:
        query_embedding = self.embedder.encode([query])
        return self.store.search(query_embedding=query_embedding, top_k=top_k)

