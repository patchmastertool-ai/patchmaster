#!/usr/bin/env python3
"""Generate Ed25519 signing keys and X25519 encryption keys for PM2 licenses"""
import base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey
from cryptography.hazmat.primitives import serialization

# Generate Ed25519 signing key pair
sign_private = Ed25519PrivateKey.generate()
sign_public = sign_private.public_key()

sign_private_bytes = sign_private.private_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PrivateFormat.Raw,
    encryption_algorithm=serialization.NoEncryption()
)
sign_public_bytes = sign_public.public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw
)

# Generate X25519 encryption key pair
encrypt_private = X25519PrivateKey.generate()
encrypt_public = encrypt_private.public_key()

encrypt_private_bytes = encrypt_private.private_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PrivateFormat.Raw,
    encryption_algorithm=serialization.NoEncryption()
)
encrypt_public_bytes = encrypt_public.public_bytes(
    encoding=serialization.Encoding.Raw,
    format=serialization.PublicFormat.Raw
)

# Encode as base64url
sign_private_b64 = base64.urlsafe_b64encode(sign_private_bytes).decode().rstrip('=')
sign_public_b64 = base64.urlsafe_b64encode(sign_public_bytes).decode().rstrip('=')
encrypt_private_b64 = base64.urlsafe_b64encode(encrypt_private_bytes).decode().rstrip('=')
encrypt_public_b64 = base64.urlsafe_b64encode(encrypt_public_bytes).decode().rstrip('=')

print("=== PM2 License Keys Generated ===")
print()
print("# Vendor (License Generator) Keys:")
print(f"LICENSE_SIGN_PRIVATE_KEY={sign_private_b64}")
print(f"LICENSE_ENCRYPT_PUBLIC_KEY={encrypt_public_b64}")
print()
print("# Backend (License Validator) Keys:")
print(f"LICENSE_VERIFY_PUBLIC_KEY={sign_public_b64}")
print(f"LICENSE_DECRYPT_PRIVATE_KEY={encrypt_private_b64}")
print()
print("# Add these to vendor/.env for license generation")
print("# Add these to backend/.env or .license-authority.env for validation")
