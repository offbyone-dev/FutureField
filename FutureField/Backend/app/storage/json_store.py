import json

from app.config import DATA_DIR


def _dir(kind: str):
    p = DATA_DIR / kind
    p.mkdir(parents=True, exist_ok=True)
    return p


def save(kind: str, record_id: str, data: dict) -> None:
    (_dir(kind) / f"{record_id}.json").write_text(json.dumps(data, indent=2), encoding="utf-8")


def load(kind: str, record_id: str) -> dict | None:
    p = _dir(kind) / f"{record_id}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def list_all(kind: str) -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(_dir(kind).glob("*.json"))]


def delete(kind: str, record_id: str) -> None:
    p = _dir(kind) / f"{record_id}.json"
    if p.exists():
        p.unlink()
