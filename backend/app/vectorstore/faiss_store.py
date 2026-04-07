from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


class FaissStore:
    def __init__(self, root_dir: Path, namespace: str) -> None:
        self.root_dir = root_dir
        self.namespace = namespace
        self.store_dir = self.root_dir / namespace
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.store_dir / "index.faiss"
        self.meta_path = self.store_dir / "metadata.json"
        self.index = None
        self.embeddings_path = self.store_dir / "embeddings.npy"
        self.embeddings: np.ndarray | None = None
        self.metadata: list[dict[str, Any]] = []

    def build(self, embeddings: np.ndarray, metadata: list[dict[str, Any]]) -> None:
        if embeddings.size == 0:
            raise ValueError("Cannot build FAISS index with empty embeddings.")

        if faiss is not None:
            dim = embeddings.shape[1]
            self.index = faiss.IndexFlatIP(dim)
            self.index.add(embeddings)
            self.embeddings = None
        else:
            self.index = None
            self.embeddings = embeddings
        self.metadata = metadata
        self.save()

    def save(self) -> None:
        if faiss is not None and self.index is not None:
            faiss.write_index(self.index, str(self.index_path))
        elif self.embeddings is not None:
            np.save(self.embeddings_path, self.embeddings)
        else:
            raise ValueError("No vector index to save.")
        self.meta_path.write_text(json.dumps(self.metadata, indent=2), encoding="utf-8")

    def load(self) -> None:
        if faiss is not None:
            if not self.index_path.exists():
                raise FileNotFoundError("FAISS index does not exist.")
            self.index = faiss.read_index(str(self.index_path))
            self.embeddings = None
        else:
            if not self.embeddings_path.exists():
                raise FileNotFoundError("Vector index does not exist.")
            self.embeddings = np.load(self.embeddings_path)
            self.index = None
        self.metadata = json.loads(self.meta_path.read_text(encoding="utf-8"))

    def search(self, query_embedding: np.ndarray, top_k: int = 8) -> list[dict[str, Any]]:
        if faiss is not None:
            if self.index is None:
                self.load()
            assert self.index is not None
            distances, indices = self.index.search(query_embedding, top_k)
        else:
            if self.embeddings is None:
                self.load()
            assert self.embeddings is not None
            scores = np.dot(self.embeddings, query_embedding[0])
            top_indices = np.argsort(scores)[::-1][:top_k]
            distances = np.array([scores[top_indices]], dtype=np.float32)
            indices = np.array([top_indices], dtype=np.int64)

        results: list[dict[str, Any]] = []
        for score, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            item = dict(self.metadata[idx])
            item["score"] = float(score)
            results.append(item)
        return results
