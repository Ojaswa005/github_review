from __future__ import annotations

from typing import Iterable

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import settings


class Embedder:
    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.embedding_model
        self.model = SentenceTransformer(self.model_name)

    def encode(self, texts: Iterable[str]) -> np.ndarray:
        text_list = list(texts)
        if not text_list:
            return np.zeros(
                (0, self.model.get_sentence_embedding_dimension()), dtype="float32"
            )
        embeddings = self.model.encode(text_list, normalize_embeddings=True)
        return np.array(embeddings, dtype="float32")
