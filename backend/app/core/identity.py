"""Encryption and masking for candidate identity numbers."""
from cryptography.fernet import Fernet, InvalidToken

from .config import IDENTITY_ENCRYPTION_KEY


def _fernet() -> Fernet:
    try:
        return Fernet(IDENTITY_ENCRYPTION_KEY.encode())
    except Exception as exc:
        raise RuntimeError("IDENTITY_ENCRYPTION_KEY 必须是有效的 Fernet 密钥") from exc


def encrypt_identity_number(value: str) -> str:
    return _fernet().encrypt(value.strip().encode()).decode()


def decrypt_identity_number(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("证件号码无法解密，请检查 IDENTITY_ENCRYPTION_KEY") from exc


def identity_mask(last4: str) -> str:
    return f"**************{last4}" if last4 else ""
