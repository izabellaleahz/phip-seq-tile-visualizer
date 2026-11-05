"""
Redis caching service for performance optimization

Caches frequently accessed data like virus lists, protein metadata, and search results.
"""

import json
from typing import Optional, Any


class CacheService:
    """
    Simple caching service (in-memory for now, Redis later)

    For initial deployment, we'll use in-memory dict caching.
    Later, this can be upgraded to Redis for distributed caching.
    """

    def __init__(self):
        self._cache = {}

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key in self._cache:
            return self._cache[key]
        return None

    async def set(self, key: str, value: Any, ttl: int = 3600):
        """
        Set value in cache with TTL (time-to-live in seconds)

        Note: TTL not implemented in memory cache - would need Redis
        """
        self._cache[key] = value

    async def delete(self, key: str):
        """Delete key from cache"""
        if key in self._cache:
            del self._cache[key]

    async def clear(self):
        """Clear all cache"""
        self._cache.clear()


# Global cache instance
cache = CacheService()


# Cache TTL constants (in seconds)
CACHE_TTL = {
    "search": 3600,        # 1 hour
    "viruses": 300,        # 5 minutes
    "proteins": 300,       # 5 minutes
    "tiles": 3600,         # 1 hour
    "statistics": 3600,    # 1 hour
    "taxonomy": 86400,     # 24 hours
}


def get_cache_key(prefix: str, *args) -> str:
    """Generate cache key from prefix and arguments"""
    return f"{prefix}:{':'.join(str(arg) for arg in args)}"
