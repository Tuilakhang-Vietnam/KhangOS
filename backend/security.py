"""
security.py - Path validation for KhangOS.

Every filesystem operation that touches a client-supplied path MUST go
through resolve_path() first. It guarantees the resolved, canonical path
is ROOT_DIRECTORY itself or a genuine descendant of it, and rejects:

    - ".."  segments (explicit path traversal)
    - absolute paths (leading "/" or "\\")
    - Windows drive-letter paths ("C:\\...", "D:/...")
    - null-byte injection
    - any resolved path that still, after all of the above, somehow
      escapes ROOT_DIRECTORY (defense in depth via Path.resolve() +
      relative_to()).
"""

from pathlib import Path


class SecurityError(Exception):
    """Raised when a client-supplied path fails security validation."""


def resolve_path(root_directory: Path, user_path: str) -> Path:
    """
    Safely resolve a user-supplied relative path against root_directory.

    Args:
        root_directory: The sandbox root. All results are guaranteed to
            be this directory or a descendant of it.
        user_path: A path string supplied by the client, expected to be
            relative to root_directory. Empty string / None means root.

    Returns:
        The resolved absolute Path, guaranteed safe.

    Raises:
        SecurityError: if the path is absolute, contains a drive letter,
            contains "..", contains a null byte, or resolves outside of
            root_directory.
    """
    root_resolved = root_directory.resolve()

    if user_path is None:
        user_path = ""

    if "\x00" in user_path:
        raise SecurityError("Invalid path.")

    # Normalize so both "/" and "\" style separators behave the same way.
    normalized = user_path.replace("\\", "/").strip()

    if normalized.startswith("/"):
        raise SecurityError("Absolute paths are not allowed.")

    # Windows drive-letter paths: "C:", "C:/", "C:\\foo"
    if len(normalized) >= 2 and normalized[1] == ":":
        raise SecurityError("Drive-letter paths are not allowed.")

    parts = [p for p in normalized.split("/") if p not in ("", ".")]

    candidate = root_resolved
    for part in parts:
        if part == "..":
            raise SecurityError("Path traversal ('..') is not allowed.")
        candidate = candidate / part

    resolved = candidate.resolve()

    try:
        resolved.relative_to(root_resolved)
    except ValueError:
        raise SecurityError("Resolved path escapes the root directory.")

    return resolved


def safe_relative(root_directory: Path, target: Path) -> str:
    """Return target's path relative to root_directory, forward-slash style."""
    root_resolved = root_directory.resolve()
    rel = target.resolve().relative_to(root_resolved)
    text = str(rel).replace("\\", "/")
    return "" if text == "." else text
