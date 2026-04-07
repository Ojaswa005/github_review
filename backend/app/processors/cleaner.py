import re


class TextCleaner:
    @staticmethod
    def clean_markdown(text: str) -> str:
        if not text:
            return ""
        cleaned = re.sub(r"```[\s\S]*?```", " ", text)
        cleaned = re.sub(r"`[^`]*`", " ", cleaned)
        cleaned = re.sub(r"!\[[^\]]*\]\([^)]+\)", " ", cleaned)
        cleaned = re.sub(r"\[[^\]]*\]\([^)]+\)", " ", cleaned)
        cleaned = re.sub(r"#+\s*", " ", cleaned)
        cleaned = re.sub(r"[*_>-]", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

