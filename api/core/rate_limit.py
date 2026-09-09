import time
from fastapi import Depends, HTTPException, Request
from redis.exceptions import RedisError
from core.configs import settings
from core.redis import redis_conn
from utils.logger import logger

_LUA_SLIDING_WINDOW = """
local prev_key = KEYS[1]
local curr_key = KEYS[2]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local elapsed = tonumber(ARGV[3])

local prev_count = tonumber(redis.call('GET', prev_key)) or 0
local curr_count = redis.call('INCR', curr_key)
if curr_count == 1 then
    redis.call('EXPIRE', curr_key, window * 2)
end

local weighted = prev_count * ((window - elapsed) / window) + curr_count
if weighted > limit then
    return {0, prev_count, curr_count}
end
return {1, prev_count, curr_count}
"""

_script = redis_conn.register_script(_LUA_SLIDING_WINDOW)

TIERS = {
    "auth": {"limit": 10, "window": 60},
    "writes": {"limit": 120, "window": 60},
    "reads": {"limit": 300, "window": 60},
    "exports": {"limit": 20, "window": 60},
    # Unauthenticated public form submissions (e.g. the marketing site's
    # contact form) -- always IP-keyed, no tenant/cred to key on. Tighter
    # than "writes" specifically to blunt spam/abuse from a single source,
    # same reasoning as "auth"'s brute-force-guard number.
    "public_forms": {"limit": 5, "window": 60},
}


def _check(key: str, tier: str) -> tuple[bool, int]:
    limit, window = TIERS[tier]["limit"], TIERS[tier]["window"]
    now = time.time()
    curr_bucket = int(now // window)
    prev_bucket = curr_bucket - 1
    elapsed = now % window
    prefix = f"ratelimit:{tier}:{key}"

    try:
        allowed, prev_count, curr_count = _script(
            keys=[f"{prefix}:{prev_bucket}", f"{prefix}:{curr_bucket}"],
            args=[window, limit, elapsed],
        )
    except RedisError as e:
        logger.error(f"rate limiter redis error, failing open: {e}")
        return True, limit

    weighted = prev_count * ((window - elapsed) / window) + curr_count
    remaining = max(0, int(limit - weighted))
    return bool(allowed), remaining


def rate_limit(tier: str):
    def _dep(request: Request):
        if settings.ENVIRO != "prod":
            return

        tenant_id = getattr(request.state, "tenant_id", None)
        cred_id = getattr(request.state, "cred_id", None)
        if tenant_id:
            key = f"{tenant_id}:{cred_id or 'noauth'}"
        else:
            key = request.client.host if request.client else "unknown"

        allowed, remaining = _check(key, tier)
        limit, window = TIERS[tier]["limit"], TIERS[tier]["window"]
        request.state.rate_limit_headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(window),
        }

        if not allowed:
            raise HTTPException(429, "Rate limit exceeded", headers={
                **request.state.rate_limit_headers,
                "Retry-After": str(window),
            })

    return Depends(_dep)
