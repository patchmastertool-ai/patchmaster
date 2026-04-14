"""Rate limiting middleware for API protection."""

import time
import os
from typing import Callable, Dict, Optional, Tuple
from collections import defaultdict
from dataclasses import dataclass, field

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Rate limiting configuration
DEFAULT_RATE_LIMIT = int(os.getenv("DEFAULT_RATE_LIMIT", "100"))  # requests per window
DEFAULT_RATE_WINDOW = int(os.getenv("DEFAULT_RATE_WINDOW", "60"))  # seconds

# Per-endpoint rate limits (requests per minute)
ENDPOINT_RATE_LIMITS = {
    "/api/auth/login": (5, 60),  # 5 login attempts per minute
    "/api/auth/refresh": (10, 60),  # 10 token refreshes per minute
    "/api/register": (3, 60),  # 3 registrations per minute
    "/api/hosts": (50, 60),  # 50 host operations per minute
    "/api/jobs": (30, 60),  # 30 job operations per minute
}

# Per-user rate limits (requests per minute)
USER_RATE_LIMITS = {
    "admin": (200, 60),
    "operator": (100, 60),
    "viewer": (50, 60),
}


@dataclass
class RateLimitEntry:
    """Rate limit entry for tracking requests."""

    count: int = 0
    window_start: float = field(default_factory=time.time)
    reset_time: float = 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for API rate limiting."""

    def __init__(
        self,
        app,
        default_limit: int = DEFAULT_RATE_LIMIT,
        default_window: int = DEFAULT_RATE_WINDOW,
        enabled: bool = True,
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self.enabled = enabled

        # Track request counts per identifier
        self._rate_limits: Dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        # Get client identifier
        client_id = self._get_client_id(request)

        # Get endpoint-specific limit
        endpoint = request.url.path
        limit, window = self._get_rate_limit(endpoint, request)

        # Check rate limit
        allowed, remaining, reset_in = self._check_rate_limit(client_id, limit, window)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "type": "rate_limit_exceeded",
                        "message": f"Rate limit exceeded. Try again in {reset_in} seconds.",
                        "retry_after": reset_in,
                    }
                },
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_in),
                    "Retry-After": str(reset_in),
                },
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_in)

        return response

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting."""
        # Try to get API key first
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return f"api_key:{api_key}"

        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"

        # Check for forwarded headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        return f"ip:{client_ip}"

    def _get_rate_limit(self, endpoint: str, request: Request) -> Tuple[int, int]:
        """Get rate limit for endpoint."""
        # Check endpoint-specific limits
        for pattern, (limit, window) in ENDPOINT_RATE_LIMITS.items():
            if endpoint.startswith(pattern):
                return limit, window

        # Check user-based limits
        # This would need user authentication to work fully
        # For now, use default
        return self.default_limit, self.default_window

    def _check_rate_limit(
        self,
        identifier: str,
        limit: int,
        window: int,
    ) -> Tuple[bool, int, int]:
        """Check if request is allowed. Returns (allowed, remaining, reset_in)."""
        current_time = time.time()

        # Get or create rate limit entry
        entry = self._rate_limits[identifier]

        # Check if window has expired
        if current_time - entry.window_start > window:
            # Reset for new window
            entry.count = 0
            entry.window_start = current_time
            entry.reset_time = current_time + window

        # Increment count
        entry.count += 1

        # Calculate remaining
        remaining = max(0, limit - entry.count)

        # Calculate reset time
        reset_in = int(entry.reset_time - current_time)

        # Check if allowed
        allowed = entry.count <= limit

        return allowed, remaining, max(1, reset_in)

    def _cleanup_expired(self):
        """Clean up expired rate limit entries."""
        current_time = time.time()
        expired_keys = [
            k
            for k, v in self._rate_limits.items()
            if current_time - v.window_start > self.default_window * 2
        ]
        for k in expired_keys:
            del self._rate_limits[k]


# ── Helper Functions ──


def get_rate_limit_config(endpoint: str) -> Tuple[int, int]:
    """Get rate limit configuration for an endpoint."""
    for pattern, (limit, window) in ENDPOINT_RATE_LIMITS.items():
        if endpoint.startswith(pattern):
            return limit, window
    return DEFAULT_RATE_LIMIT, DEFAULT_RATE_WINDOW


def is_rate_limited(
    endpoint: str,
    identifier: str,
    store: Dict[str, RateLimitEntry],
) -> bool:
    """Check if identifier is rate limited for endpoint (useful for testing)."""
    limit, window = get_rate_limit_config(endpoint).get(
        endpoint, (DEFAULT_RATE_LIMIT, DEFAULT_RATE_WINDOW)
    )

    entry = store.get(identifier)
    if not entry:
        return False

    current_time = time.time()
    if current_time - entry.window_start > window:
        return False

    return entry.count > limit


def reset_rate_limit(identifier: str, store: Dict[str, RateLimitEntry]):
    """Reset rate limit for identifier (useful for testing)."""
    if identifier in store:
        del store[identifier]


# ── Token Bucket Algorithm (Alternative) ──


class TokenBucket:
    """Token bucket rate limiter for more sophisticated rate limiting."""

    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.last_refill = time.time()

    def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens. Returns True if successful."""
        self._refill()

        if self.tokens >= tokens:
            self.tokens -= tokens
            return True

        return False

    def _refill(self):
        """Refill tokens based on elapsed time."""
        current_time = time.time()
        elapsed = current_time - self.last_refill

        # Add tokens based on refill rate
        new_tokens = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + new_tokens)

        self.last_refill = current_time

    def get_available(self) -> int:
        """Get available tokens."""
        self._refill()
        return int(self.tokens)

    def get_wait_time(self, tokens: int = 1) -> float:
        """Get wait time until tokens are available."""
        self._refill()

        if self.tokens >= tokens:
            return 0

        tokens_needed = tokens - self.tokens
        return tokens_needed / self.refill_rate
