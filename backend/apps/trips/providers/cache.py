"""Small helper around Django's cache so adapters share one keying convention."""

import hashlib
from collections.abc import Callable

from django.core.cache.backends.base import BaseCache


def cache_key(namespace: str, *parts: object) -> str:
    raw = "|".join(str(p) for p in parts)
    return f"{namespace}:{hashlib.sha256(raw.encode()).hexdigest()}"


def get_or_set[T](cache: BaseCache, key: str, ttl: int, factory: Callable[[], T]) -> T:
    """Return the cached value, or compute and store it. Failures are never cached."""
    hit: T | None = cache.get(key)
    if hit is not None:
        return hit
    value = factory()
    cache.set(key, value, ttl)
    return value
