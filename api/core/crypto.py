"""Symmetric encryption for secrets stored at rest (e.g. a tenant's real IRD
CBMS Taxpayer Portal password — see features/ims/cbms_service.py). Uses
Fernet (AES-128-CBC + HMAC, from the `cryptography` package already pulled
in by python-jose[cryptography]) rather than plaintext columns.

Ciphertext is versioned with an "fnet1:" prefix so a future key-rotation or
algorithm change can detect old-format values and re-encrypt them instead of
guessing."""
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from core.configs import settings

_PREFIX = "fnet1:"


def _fernet() -> Fernet:
    key = settings.CBMS_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "CBMS_ENCRYPTION_KEY is not set — required to store/read encrypted "
            "credentials. Generate one with: python -c \"from cryptography.fernet "
            "import Fernet; print(Fernet.generate_key().decode())\""
        )
    # Fernet requires a 32-byte urlsafe-base64 key. Accept either a raw
    # Fernet-generated key or an arbitrary secret string (derived via SHA-256
    # so ops can reuse any existing secret-length env var convention).
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError):
        derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
        return Fernet(derived)


def encrypt_secret(plaintext: str) -> str:
    if plaintext is None:
        return plaintext
    token = _fernet().encrypt(plaintext.encode()).decode()
    return _PREFIX + token


def decrypt_secret(value: str) -> str:
    """Decrypts a value written by encrypt_secret. Raises RuntimeError on a
    tampered/undecryptable ciphertext rather than silently returning garbage
    (a wrong password submitted to IRD would look like an auth failure days
    later — better to fail loudly here)."""
    if value is None:
        return value
    if not value.startswith(_PREFIX):
        # Pre-encryption legacy row (written before this change shipped).
        # Treated as plaintext once, then re-encrypted on next save.
        return value
    raw = value[len(_PREFIX):]
    try:
        return _fernet().decrypt(raw.encode()).decode()
    except InvalidToken:
        raise RuntimeError("Stored secret could not be decrypted — check CBMS_ENCRYPTION_KEY.")
