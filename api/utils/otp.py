import secrets
from core.redis import redis_conn
from utils.logger import logger


def generate_otp(length: int = 6) -> str:
    """Generate a random OTP of specified length."""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def store_otp(user_id: str, otp: str, purpose: str = "verification", ttl: int = 60) -> bool:
    """
    Store OTP in Redis with TTL (1 minute by default).

    Args:
        user_id: User ID
        otp: OTP code
        purpose: 'verification' or 'password_reset'
        ttl: Time to live in seconds (default 60 = 1 minute)

    Returns:
        True if stored successfully
    """
    try:
        key = f"otp:{purpose}:{user_id}"
        redis_conn.setex(key, ttl, otp)
        logger.info(f"OTP stored for {purpose} - {user_id}")
        return True
    except Exception as e:
        logger.error(f"Error storing OTP: {e}")
        return False


def verify_otp(user_id: str, otp: str, purpose: str = "verification") -> bool:
    """
    Verify OTP and delete it from Redis if correct.

    Args:
        user_id: User ID
        otp: OTP code to verify
        purpose: 'verification' or 'password_reset'

    Returns:
        True if OTP is valid and matches
    """
    try:
        key = f"otp:{purpose}:{user_id}"
        stored_otp = redis_conn.get(key)

        if not stored_otp:
            logger.warning(f"OTP not found or expired for {purpose} - {user_id}")
            return False

        stored_otp = stored_otp.decode() if isinstance(stored_otp, bytes) else stored_otp

        if stored_otp == otp:
            redis_conn.delete(key)
            logger.info(f"OTP verified for {purpose} - {user_id}")
            return True

        logger.warning(f"OTP mismatch for {purpose} - {user_id}")
        return False
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}")
        return False


def get_otp_expiry(user_id: str, purpose: str = "verification") -> int:
    """
    Get remaining TTL for OTP in seconds.

    Returns:
        Remaining seconds, or -1 if key doesn't exist, -2 if no expiry
    """
    try:
        key = f"otp:{purpose}:{user_id}"
        ttl = redis_conn.ttl(key)
        return ttl
    except Exception as e:
        logger.error(f"Error getting OTP expiry: {e}")
        return -1


def delete_otp(user_id: str, purpose: str = "verification") -> bool:
    """Delete OTP from Redis."""
    try:
        key = f"otp:{purpose}:{user_id}"
        redis_conn.delete(key)
        return True
    except Exception as e:
        logger.error(f"Error deleting OTP: {e}")
        return False
