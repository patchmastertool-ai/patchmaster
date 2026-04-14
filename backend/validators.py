"""Input validation utilities - XSS prevention, SQL injection prevention, file validation."""

import re
import html
import os
from typing import Any, Optional, Tuple, List
from dataclasses import dataclass
from enum import Enum

# Validation configuration
MAX_STRING_LENGTH = 10000
MAX_ARRAY_LENGTH = 100
MAX_DEPTH = 5
ALLOWED_FILE_EXTENSIONS = {
    ".exe",
    ".msi",
    ".deb",
    ".rpm",
    ".zip",
    ".tar",
    ".gz",
    ".json",
    ".yaml",
    ".yml",
}
MAX_FILE_SIZE_MB = 500

# HTML tags allowed in rich text (basic safe subset)
ALLOWED_HTML_TAGS = {
    "b",
    "i",
    "u",
    "strong",
    "em",
    "p",
    "br",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
}

# Suspicious patterns for detection (not necessarily blocking)
SUSPICIOUS_PATTERNS = [
    r"<script[^>]*>.*?</script>",  # Script tags
    r"javascript:",  # JavaScript protocol
    r"on\w+\s*=",  # Event handlers
    r"<iframe[^>]*>.*?</iframe>",  # Iframes
    r"<\?php",  # PHP tags
    r"<%",  # ASP tags
    r"\$\{",  # Template injection
    r"\$\(",  # Command injection
]


class ValidationError(Exception):
    """Custom validation error."""

    pass


@dataclass
class ValidationResult:
    """Result of validation."""

    is_valid: bool
    message: str
    sanitized_value: Any = None


class InputType(Enum):
    """Input types for validation."""

    STRING = "string"
    EMAIL = "email"
    URL = "url"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    ARRAY = "array"
    OBJECT = "object"
    FILE = "file"


# ── String Sanitization ──


def sanitize_input(value: Any, max_length: int = MAX_STRING_LENGTH) -> str:
    """Sanitize string input to prevent XSS attacks."""
    if value is None:
        return ""

    # Convert to string
    str_value = str(value)

    # Truncate to max length
    str_value = str_value[:max_length]

    # Escape HTML entities
    str_value = html.escape(str_value)

    return str_value


def sanitize_html(value: str, allow_tags: Optional[set] = None) -> str:
    """Sanitize HTML content to allow safe tags only."""
    if not value:
        return ""

    # If no allowed tags specified, use default safe set
    if allow_tags is None:
        allow_tags = ALLOWED_HTML_TAGS

    # Remove all HTML tags first, then add back allowed ones
    # This is a simple approach - for production, use a proper HTML sanitizer
    # For now, just escape everything
    return html.escape(value)


def strip_html_tags(value: str) -> str:
    """Strip all HTML tags from input."""
    if not value:
        return ""

    # Remove script tags and their content
    value = re.sub(
        r"<script[^>]*>.*?</script>", "", value, flags=re.IGNORECASE | re.DOTALL
    )

    # Remove iframe tags and their content
    value = re.sub(
        r"<iframe[^>]*>.*?</iframe>", "", value, flags=re.IGNORECASE | re.DOTALL
    )

    # Remove event handlers
    value = re.sub(r"\s+on\w+\s*=[^>>]", "", value, flags=re.IGNORECASE)

    # Remove javascript: URLs
    value = re.sub(r"javascript:", "", value, flags=re.IGNORECASE)

    # Escape remaining content
    value = html.escape(value)

    return value


# ── SQL Injection Prevention ──


def escape_sql_identifier(identifier: str) -> str:
    """Escape SQL identifier to prevent injection."""
    if not identifier:
        return ""

    # Remove or escape special characters
    identifier = re.sub(r"[^\w_]", "_", identifier)

    return identifier


def validate_query_parameter(value: Any) -> str:
    """Validate and sanitize a query parameter."""
    if value is None:
        return ""

    # Convert to string
    str_value = str(value)

    # Remove potentially dangerous patterns
    dangerous_patterns = [
        r"(\bunion\b.*\bselect\b)",
        r"(\bselect\b.*\bfrom\b)",
        r"(\bdrop\b.*\btable\b)",
        r"(\bdelete\b.*\bfrom\b)",
        r"(\binsert\b.*\binto\b)",
        r"(\bupdate\b.*\bset\b)",
        r"(\bexec\b|\bexecute\b)",
        r"(--)",
        r"(;#)",
        r"(\/\*|\*\/)",
    ]

    for pattern in dangerous_patterns:
        str_value = re.sub(pattern, "", str_value, flags=re.IGNORECASE)

    return str_value.strip()


# ── General Input Validation ──


def validate_type(value: Any, expected_type: InputType) -> ValidationResult:
    """Validate input type."""
    try:
        if expected_type == InputType.STRING:
            if not isinstance(value, str):
                return ValidationResult(
                    False, f"Expected string, got {type(value).__name__}"
                )
            return ValidationResult(True, "Valid string", value)

        elif expected_type == InputType.EMAIL:
            if not isinstance(value, str):
                return ValidationResult(
                    False, f"Expected string, got {type(value).__name__}"
                )
            if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", value):
                return ValidationResult(False, "Invalid email format")
            return ValidationResult(True, "Valid email", value.lower())

        elif expected_type == InputType.URL:
            if not isinstance(value, str):
                return ValidationResult(
                    False, f"Expected string, got {type(value).__name__}"
                )
            if not re.match(r"^https?://", value):
                return ValidationResult(False, "Invalid URL format")
            return ValidationResult(True, "Valid URL", value)

        elif expected_type == InputType.INTEGER:
            try:
                int_val = int(value)
                return ValidationResult(True, "Valid integer", int_val)
            except (ValueError, TypeError):
                return ValidationResult(False, "Invalid integer")

        elif expected_type == InputType.FLOAT:
            try:
                float_val = float(value)
                return ValidationResult(True, "Valid float", float_val)
            except (ValueError, TypeError):
                return ValidationResult(False, "Invalid float")

        elif expected_type == InputType.BOOLEAN:
            if isinstance(value, bool):
                return ValidationResult(True, "Valid boolean", value)
            if isinstance(value, str) and value.lower() in ("true", "false", "1", "0"):
                return ValidationResult(
                    True, "Valid boolean", value.lower() in ("true", "1")
                )
            return ValidationResult(False, "Invalid boolean")

        elif expected_type == InputType.ARRAY:
            if not isinstance(value, list):
                return ValidationResult(
                    False, f"Expected array, got {type(value).__name__}"
                )
            if len(value) > MAX_ARRAY_LENGTH:
                return ValidationResult(
                    False, f"Array exceeds max length {MAX_ARRAY_LENGTH}"
                )
            return ValidationResult(True, "Valid array", value)

        elif expected_type == InputType.OBJECT:
            if not isinstance(value, dict):
                return ValidationResult(
                    False, f"Expected object, got {type(value).__name__}"
                )
            return ValidationResult(True, "Valid object", value)

        else:
            return ValidationResult(False, f"Unknown type: {expected_type}")

    except Exception as e:
        return ValidationResult(False, f"Validation error: {str(e)}")


def validate_required(value: Any, field_name: str = "field") -> ValidationResult:
    """Validate that a required field is present and not empty."""
    if value is None:
        return ValidationResult(False, f"{field_name} is required")

    if isinstance(value, str) and not value.strip():
        return ValidationResult(False, f"{field_name} cannot be empty")

    if isinstance(value, (list, dict, tuple)) and not value:
        return ValidationResult(False, f"{field_name} cannot be empty")

    return ValidationResult(True, "Required field present")


def validate_length(
    value: str,
    min_length: Optional[int] = None,
    max_length: Optional[int] = None,
    field_name: str = "field",
) -> ValidationResult:
    """Validate string length."""
    if not isinstance(value, str):
        return ValidationResult(False, f"Expected string for {field_name}")

    length = len(value)

    if min_length is not None and length < min_length:
        return ValidationResult(
            False, f"{field_name} must be at least {min_length} characters"
        )

    if max_length is not None and length > max_length:
        return ValidationResult(
            False, f"{field_name} must not exceed {max_length} characters"
        )

    return ValidationResult(True, f"{field_name} length valid")


def validate_range(
    value: float,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    field_name: str = "field",
) -> ValidationResult:
    """Validate numeric range."""
    try:
        num_value = float(value)
    except (ValueError, TypeError):
        return ValidationResult(False, f"Invalid number for {field_name}")

    if min_value is not None and num_value < min_value:
        return ValidationResult(False, f"{field_name} must be at least {min_value}")

    if max_value is not None and num_value > max_value:
        return ValidationResult(False, f"{field_name} must not exceed {max_value}")

    return ValidationResult(True, f"{field_name} in range")


# ── File Upload Validation ──


def validate_filename(filename: str) -> ValidationResult:
    """Validate filename for security."""
    if not filename:
        return ValidationResult(False, "Filename is required")

    # Check for path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return ValidationResult(False, "Invalid filename: path traversal detected")

    # Check for null bytes
    if "\x00" in filename:
        return ValidationResult(False, "Invalid filename: null bytes detected")

    return ValidationResult(True, "Filename valid")


def validate_file_extension(
    filename: str, allowed: Optional[set] = None
) -> ValidationResult:
    """Validate file extension."""
    if allowed is None:
        allowed = ALLOWED_FILE_EXTENSIONS

    if not filename:
        return ValidationResult(False, "Filename is required")

    # Get extension
    ext = os.path.splitext(filename)[1].lower()

    if ext not in allowed:
        return ValidationResult(
            False, f"File extension {ext} not allowed. Allowed: {', '.join(allowed)}"
        )

    return ValidationResult(True, "File extension valid", ext)


def validate_file_size(
    size_bytes: int, max_size_mb: int = MAX_FILE_SIZE_MB
) -> ValidationResult:
    """Validate file size."""
    max_bytes = max_size_mb * 1024 * 1024

    if size_bytes <= 0:
        return ValidationResult(False, "File size must be greater than 0")

    if size_bytes > max_bytes:
        return ValidationResult(False, f"File size exceeds maximum of {max_size_mb}MB")

    return ValidationResult(True, "File size valid")


# ── Request Size Limits ──

MAX_REQUEST_SIZE = int(
    os.getenv("MAX_REQUEST_SIZE_BYTES", "10_000_000")
)  # 10MB default


def validate_request_size(content_length: Optional[int]) -> ValidationResult:
    """Validate request size against limit."""
    if content_length is None:
        return ValidationResult(True, "No content-length header")

    if content_length > MAX_REQUEST_SIZE:
        return ValidationResult(
            False,
            f"Request size {content_length} exceeds maximum of {MAX_REQUEST_SIZE}",
        )

    return ValidationResult(True, "Request size valid")


# ── Pattern Detection ──


def detect_suspicious_content(value: str) -> List[str]:
    """Detect suspicious patterns in content. Returns list of detected patterns."""
    if not value:
        return []

    detected = []
    for pattern in SUSPICIOUS_PATTERNS:
        if re.search(pattern, value, re.IGNORECASE):
            detected.append(pattern)

    return detected
