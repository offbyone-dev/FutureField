"""Loads static agronomic knowledge (crops, rotation rules, regions) from JSON files."""
import json
from functools import lru_cache

from app.config import KNOWLEDGE_DIR
from app.schemas.crop import CropRequirements


def _read(name: str):
    return json.loads((KNOWLEDGE_DIR / name).read_text(encoding="utf-8"))


@lru_cache
def load_crops() -> list[CropRequirements]:
    return [CropRequirements(**c) for c in _read("crops.json")]


def crops_by_id() -> dict[str, CropRequirements]:
    return {c.id: c for c in load_crops()}


@lru_cache
def load_rotation_rules() -> dict:
    return _read("rotation_rules.json")


@lru_cache
def load_regions() -> dict:
    return _read("regions.json")


@lru_cache
def load_lookups() -> dict:
    return _read("lookups.json")
