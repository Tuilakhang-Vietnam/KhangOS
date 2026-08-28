/**
 * api.js - Thin wrapper around fetch() for every KhangOS backend endpoint.
 *
 * Every function returns the parsed JSON body. On a non-2xx response it
 * throws an Error whose message is the backend's "error" field (falling
 * back to the HTTP status text), so callers can just try/catch and show
 * a notification.
 */

const KhangAPI = (() => {
    async function _request(url, options = {}) {
        let response;
        try {
            response = await fetch(url, options);
        } catch (networkErr) {
            throw new Error("Network error: could not reach the server.");
        }

        let body = null;
        try {
            body = await response.json();
        } catch (parseErr) {
            body = null;
        }

        if (!response.ok || (body && body.success === false)) {
            const message = (body && body.error) ? body.error : response.statusText || "Request failed.";
            throw new Error(message);
        }

        return body;
    }

    function _qs(params) {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) usp.set(k, v);
        });
        const s = usp.toString();
        return s ? `?${s}` : "";
    }

    return {
        async listFiles(path) {
            return _request(`/api/files/list${_qs({ path })}`);
        },

        downloadUrl(path) {
            return `/api/files/download${_qs({ path })}`;
        },

        async uploadFiles(path, fileList, onProgress) {
            const formData = new FormData();
            formData.append("path", path);
            Array.from(fileList).forEach((f) => formData.append("files", f));

            // Use XHR instead of fetch so we can report upload progress.
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", "/api/files/upload");
                xhr.upload.onprogress = (evt) => {
                    if (onProgress && evt.lengthComputable) {
                        onProgress(Math.round((evt.loaded / evt.total) * 100));
                    }
                };
                xhr.onload = () => {
                    let body = null;
                    try { body = JSON.parse(xhr.responseText); } catch (e) { /* ignore */ }
                    if (xhr.status >= 200 && xhr.status < 300 && body && body.success) {
                        resolve(body);
                    } else {
                        reject(new Error((body && body.error) || "Upload failed."));
                    }
                };
                xhr.onerror = () => reject(new Error("Network error during upload."));
                xhr.send(formData);
            });
        },

        async mkdir(path, name) {
            return _request("/api/files/mkdir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, name }),
            });
        },

        async rename(path, newName) {
            return _request("/api/files/rename", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path, new_name: newName }),
            });
        },

        async copy(paths, destination) {
            return _request("/api/files/copy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paths, destination }),
            });
        },

        async move(paths, destination) {
            return _request("/api/files/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paths, destination }),
            });
        },

        async deleteEntry(path) {
            return _request("/api/files/delete", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });
        },

        async properties(path) {
            return _request(`/api/files/properties${_qs({ path })}`);
        },

        async systemStatus() {
            return _request("/api/system/status");
        },
    };
})();
