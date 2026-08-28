"""
app.py - KhangOS Flask server.

Serves the KhangOS single-page desktop environment (templates/index.html)
and exposes the REST API consumed by the Explorer, System Monitor, and
Terminal apps. All filesystem access is sandboxed to ROOT_DIRECTORY via
backend.security.resolve_path() - see backend/security.py for details.

Run with:
    py -m pip install -r requirements.txt
    py app.py

Then open http://localhost:8080 (or http://<LAN-IP>:8080 from another
machine on the same network).
"""

from pathlib import Path

from flask import Flask, jsonify, request, render_template, send_file

from backend.filesystem import (
    FilesystemError,
    list_dir,
    make_directory,
    delete_entry,
    rename_entry,
    copy_entries,
    move_entries,
    save_upload,
    get_download_path,
    get_properties,
)
from backend.security import SecurityError
from backend.system import get_status

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIRECTORY = BASE_DIR / "filesystem"
ROOT_DIRECTORY.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
# 256 MB upload cap - generous for a LAN file manager, prevents runaway uploads.
app.config["MAX_CONTENT_LENGTH"] = 256 * 1024 * 1024


def _error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


@app.errorhandler(FilesystemError)
def handle_filesystem_error(err):
    return _error(str(err), 400)


@app.errorhandler(SecurityError)
def handle_security_error(err):
    return _error("Access denied: invalid path.", 403)


@app.errorhandler(404)
def handle_not_found(err):
    return _error("Not found.", 404)


@app.errorhandler(413)
def handle_too_large(err):
    return _error("File is too large.", 413)


@app.errorhandler(500)
def handle_server_error(err):
    # Never leak tracebacks to the client.
    return _error("Internal server error.", 500)


@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Filesystem API - all paths are relative to ROOT_DIRECTORY.
# ---------------------------------------------------------------------------

@app.route("/api/files/list")
def api_list():
    path = request.args.get("path", "")
    items = list_dir(ROOT_DIRECTORY, path)
    return jsonify({"success": True, "items": items, "path": path})


@app.route("/api/files/download")
def api_download():
    path = request.args.get("path", "")
    target = get_download_path(ROOT_DIRECTORY, path)
    return send_file(target, as_attachment=True, download_name=target.name)


@app.route("/api/files/upload", methods=["POST"])
def api_upload():
    path = request.form.get("path", "")
    files = request.files.getlist("files")
    if not files:
        return _error("No files provided.")
    saved = []
    for f in files:
        if not f.filename:
            continue
        saved.append(save_upload(ROOT_DIRECTORY, path, f.filename, f))
    return jsonify({"success": True, "saved": saved})


@app.route("/api/files/mkdir", methods=["POST"])
def api_mkdir():
    data = request.get_json(force=True, silent=True) or {}
    path = data.get("path", "")
    name = data.get("name", "New Folder")
    created = make_directory(ROOT_DIRECTORY, path, name)
    return jsonify({"success": True, "name": created})


@app.route("/api/files/rename", methods=["POST"])
def api_rename():
    data = request.get_json(force=True, silent=True) or {}
    path = data.get("path", "")
    new_name = data.get("new_name", "")
    renamed = rename_entry(ROOT_DIRECTORY, path, new_name)
    return jsonify({"success": True, "name": renamed})


@app.route("/api/files/copy", methods=["POST"])
def api_copy():
    data = request.get_json(force=True, silent=True) or {}
    paths = data.get("paths", [])
    destination = data.get("destination", "")
    if not paths:
        return _error("No items selected to copy.")
    names = copy_entries(ROOT_DIRECTORY, paths, destination)
    return jsonify({"success": True, "names": names})


@app.route("/api/files/move", methods=["POST"])
def api_move():
    data = request.get_json(force=True, silent=True) or {}
    paths = data.get("paths", [])
    destination = data.get("destination", "")
    if not paths:
        return _error("No items selected to move.")
    names = move_entries(ROOT_DIRECTORY, paths, destination)
    return jsonify({"success": True, "names": names})


@app.route("/api/files/delete", methods=["DELETE"])
def api_delete():
    data = request.get_json(force=True, silent=True) or {}
    path = data.get("path", "")
    delete_entry(ROOT_DIRECTORY, path)
    return jsonify({"success": True})


@app.route("/api/files/properties")
def api_properties():
    path = request.args.get("path", "")
    info = get_properties(ROOT_DIRECTORY, path)
    return jsonify({"success": True, "properties": info})


# ---------------------------------------------------------------------------
# System API
# ---------------------------------------------------------------------------

@app.route("/api/system/status")
def api_system_status():
    return jsonify({"success": True, **get_status()})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
