"""
filesystem.py - Sandboxed filesystem operations for the KhangOS Explorer.

Every function here accepts client-supplied relative paths and routes
them through security.resolve_path() before touching the disk, so the
call sites in app.py never deal with raw paths directly.
"""

import os
import shutil
from datetime import datetime
from pathlib import Path

from .security import resolve_path


class FilesystemError(Exception):
    """Raised for expected, user-facing filesystem problems (not found,
    already exists, invalid name, etc.) - always safe to show to the client."""


def _entry_info(path: Path) -> dict:
    stat = path.stat()
    is_dir = path.is_dir()
    return {
        "name": path.name,
        "type": "directory" if is_dir else "file",
        "size": None if is_dir else stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
        "created": datetime.fromtimestamp(stat.st_ctime).isoformat(timespec="seconds"),
    }


def list_dir(root: Path, rel_path: str) -> list:
    target = resolve_path(root, rel_path)
    if not target.exists():
        raise FilesystemError("Folder not found.")
    if not target.is_dir():
        raise FilesystemError("That path is not a folder.")

    items = []
    with os.scandir(target) as it:
        for entry in it:
            try:
                items.append(_entry_info(Path(entry.path)))
            except OSError:
                # Skip entries we can't stat (broken symlinks, permissions).
                continue

    items.sort(key=lambda i: (i["type"] != "directory", i["name"].lower()))
    return items


def make_directory(root: Path, rel_path: str, name: str) -> str:
    parent = resolve_path(root, rel_path)
    if not parent.is_dir():
        raise FilesystemError("Destination is not a folder.")
    clean_name = _sanitize_name(name)
    target = _unique_path(parent / clean_name)
    target.mkdir(parents=False, exist_ok=False)
    return target.name


def delete_entry(root: Path, rel_path: str) -> None:
    target = resolve_path(root, rel_path)
    if target == root.resolve():
        raise FilesystemError("The root folder cannot be deleted.")
    if not target.exists():
        raise FilesystemError("Item not found.")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()


def rename_entry(root: Path, rel_path: str, new_name: str) -> str:
    target = resolve_path(root, rel_path)
    if not target.exists():
        raise FilesystemError("Item not found.")
    clean_name = _sanitize_name(new_name)
    destination = target.parent / clean_name
    if destination.exists():
        raise FilesystemError("An item named \"%s\" already exists." % clean_name)
    target.rename(destination)
    return destination.name


def copy_entries(root: Path, rel_paths: list, dest_rel_path: str) -> list:
    dest = resolve_path(root, dest_rel_path)
    if not dest.is_dir():
        raise FilesystemError("Destination is not a folder.")
    results = []
    for rel in rel_paths:
        src = resolve_path(root, rel)
        if not src.exists():
            raise FilesystemError("Source not found: %s" % src.name)
        if dest == src or str(dest).startswith(str(src) + os.sep):
            raise FilesystemError("Cannot copy \"%s\" into itself." % src.name)
        target = _unique_path(dest / src.name)
        if src.is_dir():
            shutil.copytree(src, target)
        else:
            shutil.copy2(src, target)
        results.append(target.name)
    return results


def move_entries(root: Path, rel_paths: list, dest_rel_path: str) -> list:
    dest = resolve_path(root, dest_rel_path)
    if not dest.is_dir():
        raise FilesystemError("Destination is not a folder.")
    results = []
    for rel in rel_paths:
        src = resolve_path(root, rel)
        if not src.exists():
            raise FilesystemError("Source not found: %s" % src.name)
        if dest == src or str(dest).startswith(str(src) + os.sep):
            raise FilesystemError("Cannot move \"%s\" into itself." % src.name)
        if dest == src.parent:
            results.append(src.name)  # already there, no-op
            continue
        target = _unique_path(dest / src.name)
        shutil.move(str(src), str(target))
        results.append(target.name)
    return results


def save_upload(root: Path, rel_path: str, filename: str, file_storage) -> str:
    parent = resolve_path(root, rel_path)
    if not parent.is_dir():
        raise FilesystemError("Destination is not a folder.")
    clean_name = _sanitize_name(os.path.basename(filename))
    target = _unique_path(parent / clean_name)
    file_storage.save(str(target))
    return target.name


def get_download_path(root: Path, rel_path: str) -> Path:
    target = resolve_path(root, rel_path)
    if not target.exists() or not target.is_file():
        raise FilesystemError("File not found.")
    return target


def get_properties(root: Path, rel_path: str) -> dict:
    target = resolve_path(root, rel_path)
    if not target.exists():
        raise FilesystemError("Item not found.")
    info = _entry_info(target)
    if target.is_dir():
        total_size = 0
        file_count = 0
        for dirpath, _, filenames in os.walk(target):
            for fname in filenames:
                try:
                    total_size += (Path(dirpath) / fname).stat().st_size
                    file_count += 1
                except OSError:
                    continue
        info["size"] = total_size
        info["file_count"] = file_count
    return info


def _sanitize_name(name: str) -> str:
    name = (name or "").strip()
    if not name:
        raise FilesystemError("Name cannot be empty.")
    if len(name) > 255:
        raise FilesystemError("Name is too long.")
    for bad_char in ("/", "\\", "\x00"):
        if bad_char in name:
            raise FilesystemError("Name contains invalid characters.")
    if name in (".", ".."):
        raise FilesystemError("Invalid name.")
    # Windows reserved characters, rejected defensively even though the
    # server sandbox may run on a non-Windows host during development.
    for bad_char in ':*?"<>|':
        if bad_char in name:
            raise FilesystemError("Name contains invalid characters.")
    return name


def _unique_path(path: Path) -> Path:
    """If path exists, append ' (n)' before the extension until it is unique."""
    if not path.exists():
        return path
    parent = path.parent
    stem = path.stem
    suffix = path.suffix
    n = 1
    while True:
        candidate = parent / f"{stem} ({n}){suffix}"
        if not candidate.exists():
            return candidate
        n += 1
