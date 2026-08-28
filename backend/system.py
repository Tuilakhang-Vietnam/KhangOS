"""
system.py - Live system metrics for the KhangOS System Monitor app.
"""

import os
import platform
import socket
import time

import psutil

_BOOT_TIME = psutil.boot_time()


def _format_uptime(seconds: float) -> str:
    seconds = int(seconds)
    days, seconds = divmod(seconds, 86400)
    hours, seconds = divmod(seconds, 3600)
    minutes, _ = divmod(seconds, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    parts.append(f"{hours:02d}h")
    parts.append(f"{minutes:02d}m")
    return " ".join(parts)


def _default_disk_path() -> str:
    """Return the root of the drive KhangOS is running from.

    Works on both Windows ("C:\\") and POSIX ("/") without hard-coding
    either one.
    """
    return os.path.abspath(os.sep)


def get_status() -> dict:
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage(_default_disk_path())
    uptime_seconds = time.time() - _BOOT_TIME

    return {
        "hostname": socket.gethostname(),
        "os": f"{platform.system()} {platform.release()}",
        "cpu": psutil.cpu_percent(interval=0.2),
        "cpu_count": psutil.cpu_count(logical=True) or 1,
        "ram_percent": vm.percent,
        "ram_used": round(vm.used / (1024 ** 3), 2),
        "ram_total": round(vm.total / (1024 ** 3), 2),
        "disk_percent": disk.percent,
        "disk_used": round(disk.used / (1024 ** 3), 2),
        "disk_total": round(disk.total / (1024 ** 3), 2),
        "uptime": _format_uptime(uptime_seconds),
    }
