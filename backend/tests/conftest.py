import os
import uuid

import pytest
from django.core.cache.backends.base import BaseCache
from django.core.cache.backends.locmem import LocMemCache

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")


@pytest.fixture
def cache() -> BaseCache:
    """A private in-memory cache per test, so cached values never leak between tests."""
    return LocMemCache(f"test-{uuid.uuid4().hex}", {})


@pytest.fixture(autouse=True)
def _clear_default_cache() -> None:
    """Throttle counters live in the default cache; start every test from zero."""
    from django.core.cache import cache as default_cache  # noqa: PLC0415

    default_cache.clear()
