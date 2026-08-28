/**
 * apps/explorer.js - KhangOS Explorer: a real file manager talking to the
 * sandboxed Flask filesystem API (see backend/filesystem.py + security.py).
 *
 * All paths handled here are relative to the sandbox root ("" = root).
 * The backend re-validates every path anyway, so nothing here needs to
 * (or should try to) reason about absolute/real filesystem paths.
 */

(function () {
    const FILE_ICONS = {
        default: "📄",
        dir: "📁",
        txt: "📝", md: "📝",
        png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", webp: "🖼️", svg: "🖼️",
        zip: "🗜️", rar: "🗜️", "7z": "🗜️",
        mp3: "🎵", wav: "🎵",
        mp4: "🎬", mov: "🎬", mkv: "🎬",
        pdf: "📕",
        json: "🧾", xml: "🧾", csv: "🧾",
        js: "📜", py: "📜", html: "📜", css: "📜",
    };

    function iconFor(item) {
        if (item.type === "directory") return FILE_ICONS.dir;
        const ext = item.name.includes(".") ? item.name.split(".").pop().toLowerCase() : "";
        return FILE_ICONS[ext] || FILE_ICONS.default;
    }

    function formatSize(bytes) {
        if (bytes === null || bytes === undefined) return "—";
        if (bytes === 0) return "0 B";
        const units = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const value = bytes / Math.pow(1024, i);
        return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
    }

    function formatDate(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function joinRelative(base, name) {
        return base ? `${base}/${name}` : name;
    }

    function parentOf(path) {
        if (!path) return "";
        const parts = path.split("/");
        parts.pop();
        return parts.join("/");
    }

    /* ---------------------------- Modal dialogs ---------------------------- */

    function closeModal(overlay) {
        overlay.remove();
        document.removeEventListener("keydown", overlay._escHandler, true);
    }

    function promptDialog(title, message, defaultValue) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "kos-modal-overlay";
            const modal = document.createElement("div");
            modal.className = "kos-modal";
            modal.innerHTML = `<h3></h3><p></p>`;
            modal.querySelector("h3").textContent = title;
            modal.querySelector("p").textContent = message || "";

            const input = document.createElement("input");
            input.type = "text";
            input.value = defaultValue || "";
            modal.appendChild(input);

            const actions = document.createElement("div");
            actions.className = "kos-modal-actions";
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "kos-btn";
            cancelBtn.textContent = "Cancel";
            const okBtn = document.createElement("button");
            okBtn.className = "kos-btn kos-btn-primary";
            okBtn.textContent = "OK";
            actions.append(cancelBtn, okBtn);
            modal.appendChild(actions);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            function finish(value) {
                closeModal(overlay);
                resolve(value);
            }

            cancelBtn.addEventListener("click", () => finish(null));
            okBtn.addEventListener("click", () => finish(input.value));
            input.addEventListener("keydown", (evt) => {
                evt.stopPropagation();
                if (evt.key === "Enter") finish(input.value);
            });
            overlay._escHandler = (evt) => {
                if (evt.key === "Escape") finish(null);
            };
            document.addEventListener("keydown", overlay._escHandler, true);

            input.focus();
            input.select();
        });
    }

    function confirmDialog(title, message, danger) {
        return new Promise((resolve) => {
            const overlay = document.createElement("div");
            overlay.className = "kos-modal-overlay";
            const modal = document.createElement("div");
            modal.className = "kos-modal";
            modal.innerHTML = `<h3></h3><p></p>`;
            modal.querySelector("h3").textContent = title;
            modal.querySelector("p").textContent = message || "";

            const actions = document.createElement("div");
            actions.className = "kos-modal-actions";
            const cancelBtn = document.createElement("button");
            cancelBtn.className = "kos-btn";
            cancelBtn.textContent = "Cancel";
            const okBtn = document.createElement("button");
            okBtn.className = "kos-btn " + (danger ? "kos-btn-danger" : "kos-btn-primary");
            okBtn.textContent = danger ? "Delete" : "OK";
            actions.append(cancelBtn, okBtn);
            modal.appendChild(actions);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            function finish(value) {
                closeModal(overlay);
                resolve(value);
            }

            cancelBtn.addEventListener("click", () => finish(false));
            okBtn.addEventListener("click", () => finish(true));
            overlay._escHandler = (evt) => {
                if (evt.key === "Escape") finish(false);
                if (evt.key === "Enter") finish(true);
            };
            document.addEventListener("keydown", overlay._escHandler, true);
            okBtn.focus();
        });
    }

    function propertiesDialog(name, props) {
        const overlay = document.createElement("div");
        overlay.className = "kos-modal-overlay";
        const modal = document.createElement("div");
        modal.className = "kos-modal";

        const rows = [
            ["Name", name],
            ["Type", props.type === "directory" ? "Folder" : "File"],
            ["Size", props.type === "directory"
                ? `${formatSize(props.size)} (${props.file_count ?? 0} files)`
                : formatSize(props.size)],
            ["Created", formatDate(props.created)],
            ["Modified", formatDate(props.modified)],
        ];

        modal.innerHTML = `<h3>Properties</h3>`;
        const table = document.createElement("table");
        table.className = "kos-modal-table";
        rows.forEach(([k, v]) => {
            const tr = document.createElement("tr");
            const tdK = document.createElement("td");
            tdK.textContent = k;
            const tdV = document.createElement("td");
            tdV.textContent = v;
            tr.append(tdK, tdV);
            table.appendChild(tr);
        });
        modal.appendChild(table);

        const actions = document.createElement("div");
        actions.className = "kos-modal-actions";
        actions.style.marginTop = "14px";
        const okBtn = document.createElement("button");
        okBtn.className = "kos-btn kos-btn-primary";
        okBtn.textContent = "Close";
        actions.appendChild(okBtn);
        modal.appendChild(actions);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function close() { closeModal(overlay); }
        okBtn.addEventListener("click", close);
        overlay._escHandler = (evt) => { if (evt.key === "Escape") close(); };
        document.addEventListener("keydown", overlay._escHandler, true);
        okBtn.focus();
    }

    /* ------------------------------ The app ------------------------------ */

    function launch() {
        const content = document.createElement("div");
        content.className = "explorer-app";

        // Toolbar
        const toolbar = document.createElement("div");
        toolbar.className = "explorer-toolbar";
        const backBtn = document.createElement("button");
        backBtn.className = "kos-btn";
        backBtn.textContent = "←";
        backBtn.title = "Back";
        const fwdBtn = document.createElement("button");
        fwdBtn.className = "kos-btn";
        fwdBtn.textContent = "→";
        fwdBtn.title = "Forward";
        const upBtn = document.createElement("button");
        upBtn.className = "kos-btn";
        upBtn.textContent = "↑";
        upBtn.title = "Up";
        const refreshBtn = document.createElement("button");
        refreshBtn.className = "kos-btn";
        refreshBtn.textContent = "⟳";
        refreshBtn.title = "Refresh";
        const pathEl = document.createElement("div");
        pathEl.className = "explorer-path";
        const newFolderBtn = document.createElement("button");
        newFolderBtn.className = "kos-btn";
        newFolderBtn.textContent = "＋ Folder";
        const uploadBtn = document.createElement("button");
        uploadBtn.className = "kos-btn";
        uploadBtn.textContent = "⭱ Upload";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        fileInput.style.display = "none";

        toolbar.append(backBtn, fwdBtn, upBtn, refreshBtn, pathEl, newFolderBtn, uploadBtn, fileInput);

        // Body (table)
        const body = document.createElement("div");
        body.className = "explorer-body";

        // Status bar
        const statusbar = document.createElement("div");
        statusbar.className = "explorer-statusbar";
        const statusLeft = document.createElement("span");
        const statusRight = document.createElement("span");
        statusbar.append(statusLeft, statusRight);

        content.append(toolbar, body, statusbar);

        /* ---------------------------- State ---------------------------- */

        let currentPath = "";
        let currentItems = [];
        let selected = new Set(); // names within currentPath
        let clipboard = null; // { operation: 'copy'|'cut', paths: [...] }
        const historyStack = [""];
        let historyIndex = 0;
        let isActive = false;

        function currentSelectedPaths() {
            return Array.from(selected).map((name) => joinRelative(currentPath, name));
        }

        function renderBreadcrumbs() {
            pathEl.innerHTML = "";
            const rootCrumb = document.createElement("button");
            rootCrumb.className = "crumb";
            rootCrumb.textContent = "📁 root";
            rootCrumb.addEventListener("click", () => navigateTo(""));
            pathEl.appendChild(rootCrumb);

            if (!currentPath) return;
            const parts = currentPath.split("/");
            let acc = "";
            parts.forEach((part) => {
                acc = joinRelative(acc, part);
                const sep = document.createElement("span");
                sep.className = "crumb-sep";
                sep.textContent = " / ";
                pathEl.appendChild(sep);

                const crumb = document.createElement("button");
                crumb.className = "crumb";
                crumb.textContent = part;
                const target = acc;
                crumb.addEventListener("click", () => navigateTo(target));
                pathEl.appendChild(crumb);
            });
        }

        function updateNavButtons() {
            backBtn.disabled = historyIndex <= 0;
            fwdBtn.disabled = historyIndex >= historyStack.length - 1;
            upBtn.disabled = !currentPath;
        }

        function updateStatusbar() {
            const count = currentItems.length;
            statusLeft.textContent = `${count} item${count === 1 ? "" : "s"}`;
            statusRight.textContent = selected.size > 0 ? `${selected.size} selected` : "";
        }

        async function loadFolder(path, options) {
            const opts = options || {};
            body.innerHTML = '<div class="explorer-loading">Loading…</div>';
            try {
                const res = await KhangAPI.listFiles(path);
                currentPath = res.path;
                currentItems = res.items;
                selected = new Set();
                renderTable();
                renderBreadcrumbs();
                updateStatusbar();
                if (!opts.silentTitle) {
                    KhangWM.setTitle("explorer", currentPath ? `Explorer — ${currentPath}` : "Explorer");
                }
            } catch (err) {
                body.innerHTML = `<div class="explorer-empty">${err.message}</div>`;
                showNotification("Explorer", err.message, "error");
            }
        }

        function navigateTo(path, opts) {
            const pushHistory = !opts || opts.pushHistory !== false;
            if (pushHistory) {
                historyStack.splice(historyIndex + 1);
                historyStack.push(path);
                historyIndex = historyStack.length - 1;
            }
            updateNavButtons();
            loadFolder(path);
        }

        function goBack() {
            if (historyIndex <= 0) return;
            historyIndex -= 1;
            updateNavButtons();
            loadFolder(historyStack[historyIndex]);
        }

        function goForward() {
            if (historyIndex >= historyStack.length - 1) return;
            historyIndex += 1;
            updateNavButtons();
            loadFolder(historyStack[historyIndex]);
        }

        function goUp() {
            if (!currentPath) return;
            navigateTo(parentOf(currentPath));
        }

        function refresh() {
            loadFolder(currentPath, { silentTitle: true });
        }

        /* --------------------------- Row rendering --------------------------- */

        function renderTable() {
            body.innerHTML = "";
            if (currentItems.length === 0) {
                body.innerHTML = '<div class="explorer-empty">Thư mục này trống.</div>';
                return;
            }

            const table = document.createElement("table");
            table.className = "explorer-list";
            table.innerHTML = `
                <thead><tr>
                    <th>Name</th><th>Type</th><th>Size</th><th>Modified</th>
                </tr></thead>
            `;
            const tbody = document.createElement("tbody");

            currentItems.forEach((item) => {
                const tr = document.createElement("tr");
                tr.className = "explorer-row";
                tr.dataset.name = item.name;
                tr.dataset.type = item.type;
                tr.draggable = true;

                const nameTd = document.createElement("td");
                nameTd.className = "name-cell";
                nameTd.innerHTML = `<span>${iconFor(item)}</span><span></span>`;
                nameTd.querySelector("span:last-child").textContent = item.name;

                const typeTd = document.createElement("td");
                typeTd.textContent = item.type === "directory" ? "Folder" : "File";

                const sizeTd = document.createElement("td");
                sizeTd.textContent = item.type === "directory" ? "—" : formatSize(item.size);

                const modTd = document.createElement("td");
                modTd.textContent = formatDate(item.modified);

                tr.append(nameTd, typeTd, sizeTd, modTd);
                wireRow(tr, item);
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            body.appendChild(table);
        }

        function applySelectionClasses() {
            body.querySelectorAll(".explorer-row").forEach((row) => {
                row.classList.toggle("selected", selected.has(row.dataset.name));
            });
            updateStatusbar();
        }

        let lastClickedName = null;

        function wireRow(tr, item) {
            tr.addEventListener("click", (evt) => {
                if (evt.ctrlKey || evt.metaKey) {
                    if (selected.has(item.name)) selected.delete(item.name);
                    else selected.add(item.name);
                } else if (evt.shiftKey && lastClickedName) {
                    const names = currentItems.map((i) => i.name);
                    const a = names.indexOf(lastClickedName);
                    const b = names.indexOf(item.name);
                    const [start, end] = a < b ? [a, b] : [b, a];
                    selected = new Set(names.slice(start, end + 1));
                } else {
                    selected = new Set([item.name]);
                }
                lastClickedName = item.name;
                applySelectionClasses();
            });

            tr.addEventListener("dblclick", () => openItem(item));

            tr.addEventListener("contextmenu", (evt) => {
                evt.preventDefault();
                if (!selected.has(item.name)) {
                    selected = new Set([item.name]);
                    applySelectionClasses();
                }
                showItemContextMenu(evt, item);
            });

            // Drag to move.
            tr.addEventListener("dragstart", (evt) => {
                if (!selected.has(item.name)) {
                    selected = new Set([item.name]);
                    applySelectionClasses();
                }
                evt.dataTransfer.setData("application/x-khangos-move", JSON.stringify(currentSelectedPaths()));
                evt.dataTransfer.effectAllowed = "move";
            });

            if (item.type === "directory") {
                tr.addEventListener("dragover", (evt) => {
                    if (evt.dataTransfer.types.includes("application/x-khangos-move")) {
                        evt.preventDefault();
                        tr.classList.add("explorer-dropzone-active");
                    }
                });
                tr.addEventListener("dragleave", () => tr.classList.remove("explorer-dropzone-active"));
                tr.addEventListener("drop", async (evt) => {
                    tr.classList.remove("explorer-dropzone-active");
                    const raw = evt.dataTransfer.getData("application/x-khangos-move");
                    if (!raw) return;
                    evt.preventDefault();
                    const paths = JSON.parse(raw);
                    const destination = joinRelative(currentPath, item.name);
                    try {
                        await KhangAPI.move(paths, destination);
                        showNotification("Explorer", `Moved into "${item.name}".`, "success");
                        refresh();
                    } catch (err) {
                        showNotification("Move failed", err.message, "error");
                    }
                });
            }
        }

        function openItem(item) {
            if (item.type === "directory") {
                navigateTo(joinRelative(currentPath, item.name));
            } else {
                window.location.href = KhangAPI.downloadUrl(joinRelative(currentPath, item.name));
                showNotification("Explorer", `Downloading "${item.name}"…`);
            }
        }

        /* ------------------------------ Actions ------------------------------ */

        async function doNewFolder() {
            const name = await promptDialog("New Folder", "Folder name:", "New Folder");
            if (!name) return;
            try {
                await KhangAPI.mkdir(currentPath, name);
                showNotification("Explorer", `Folder "${name}" created.`, "success");
                refresh();
            } catch (err) {
                showNotification("Could not create folder", err.message, "error");
            }
        }

        async function doUpload(files) {
            if (!files || files.length === 0) return;
            try {
                const res = await KhangAPI.uploadFiles(currentPath, files);
                showNotification("Upload complete", `${res.saved.length} file(s) uploaded.`, "success");
                refresh();
            } catch (err) {
                showNotification("Upload failed", err.message, "error");
            }
        }

        async function doRename(item) {
            const newName = await promptDialog("Rename", `Rename "${item.name}" to:`, item.name);
            if (!newName || newName === item.name) return;
            try {
                await KhangAPI.rename(joinRelative(currentPath, item.name), newName);
                showNotification("Explorer", `Renamed to "${newName}".`, "success");
                refresh();
            } catch (err) {
                showNotification("Rename failed", err.message, "error");
            }
        }

        async function doDelete(names) {
            if (names.length === 0) return;
            const label = names.length === 1 ? `"${names[0]}"` : `${names.length} items`;
            const ok = await confirmDialog("Delete", `Delete ${label}? This cannot be undone.`, true);
            if (!ok) return;
            let failed = 0;
            for (const name of names) {
                try {
                    await KhangAPI.deleteEntry(joinRelative(currentPath, name));
                } catch (err) {
                    failed += 1;
                }
            }
            if (failed === 0) {
                showNotification("Explorer", `Deleted ${label}.`, "success");
            } else {
                showNotification("Explorer", `${failed} item(s) could not be deleted.`, "error");
            }
            refresh();
        }

        function doCopy(names) {
            clipboard = { operation: "copy", paths: names.map((n) => joinRelative(currentPath, n)) };
            showNotification("Explorer", `${names.length} item(s) copied to clipboard.`);
        }

        function doCut(names) {
            clipboard = { operation: "cut", paths: names.map((n) => joinRelative(currentPath, n)) };
            showNotification("Explorer", `${names.length} item(s) cut to clipboard.`);
        }

        async function doPaste() {
            if (!clipboard || clipboard.paths.length === 0) return;
            try {
                if (clipboard.operation === "copy") {
                    await KhangAPI.copy(clipboard.paths, currentPath);
                    showNotification("Explorer", "Pasted (copied).", "success");
                } else {
                    await KhangAPI.move(clipboard.paths, currentPath);
                    showNotification("Explorer", "Pasted (moved).", "success");
                    clipboard = null;
                }
                refresh();
            } catch (err) {
                showNotification("Paste failed", err.message, "error");
            }
        }

        async function doProperties(item) {
            try {
                const res = await KhangAPI.properties(joinRelative(currentPath, item.name));
                propertiesDialog(item.name, res.properties);
            } catch (err) {
                showNotification("Properties", err.message, "error");
            }
        }

        /* --------------------------- Context menus --------------------------- */

        function showItemContextMenu(evt, item) {
            const names = Array.from(selected);
            const multi = names.length > 1;
            const items = [];
            if (!multi) {
                items.push({ label: "Open", icon: "↗", action: () => openItem(item) });
                if (item.type === "file") {
                    items.push({ label: "Download", icon: "⭳", action: () => openItem(item) });
                }
            }
            items.push(
                { label: "Copy", icon: "⧉", action: () => doCopy(names) },
                { label: "Cut", icon: "✂", action: () => doCut(names) },
            );
            if (!multi) {
                items.push({ label: "Rename", icon: "✎", action: () => doRename(item) });
            }
            items.push(
                { separator: true },
                { label: "Delete", icon: "🗑", danger: true, action: () => doDelete(names) },
            );
            if (!multi) {
                items.push(
                    { separator: true },
                    { label: "Properties", icon: "ℹ", action: () => doProperties(item) },
                );
            }
            showContextMenu(evt.clientX, evt.clientY, items);
        }

        function showEmptyContextMenu(evt) {
            showContextMenu(evt.clientX, evt.clientY, [
                { label: "New Folder", icon: "＋", action: doNewFolder },
                { label: "Paste", icon: "📋", disabled: !clipboard, action: doPaste },
                { separator: true },
                { label: "Refresh", icon: "⟳", action: refresh },
            ]);
        }

        body.addEventListener("contextmenu", (evt) => {
            if (evt.target.closest(".explorer-row")) return; // handled by row listener
            evt.preventDefault();
            selected = new Set();
            applySelectionClasses();
            showEmptyContextMenu(evt);
        });

        body.addEventListener("click", (evt) => {
            if (!evt.target.closest(".explorer-row")) {
                selected = new Set();
                applySelectionClasses();
            }
        });

        /* ------------------------------ Drag/drop upload ------------------------------ */

        body.addEventListener("dragover", (evt) => {
            if (evt.dataTransfer.types.includes("Files")) {
                evt.preventDefault();
                body.classList.add("explorer-dropzone-active");
            }
        });
        body.addEventListener("dragleave", (evt) => {
            if (evt.target === body) body.classList.remove("explorer-dropzone-active");
        });
        body.addEventListener("drop", (evt) => {
            body.classList.remove("explorer-dropzone-active");
            if (evt.dataTransfer.files && evt.dataTransfer.files.length > 0 && !evt.dataTransfer.types.includes("application/x-khangos-move")) {
                evt.preventDefault();
                doUpload(evt.dataTransfer.files);
            }
        });

        /* ------------------------------- Toolbar ------------------------------- */

        backBtn.addEventListener("click", goBack);
        fwdBtn.addEventListener("click", goForward);
        upBtn.addEventListener("click", goUp);
        refreshBtn.addEventListener("click", refresh);
        newFolderBtn.addEventListener("click", doNewFolder);
        uploadBtn.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
            doUpload(fileInput.files);
            fileInput.value = "";
        });

        /* ------------------------------ Shortcuts ------------------------------ */

        function keydownHandler(evt) {
            if (!isActive) return;
            if (document.querySelector(".kos-modal-overlay")) return; // let the modal handle its own keys
            const key = evt.key;
            const ctrl = evt.ctrlKey || evt.metaKey;

            if (ctrl && key.toLowerCase() === "c") {
                evt.preventDefault();
                doCopy(Array.from(selected));
            } else if (ctrl && key.toLowerCase() === "x") {
                evt.preventDefault();
                doCut(Array.from(selected));
            } else if (ctrl && key.toLowerCase() === "v") {
                evt.preventDefault();
                doPaste();
            } else if (key === "Delete") {
                evt.preventDefault();
                doDelete(Array.from(selected));
            } else if (key === "F2") {
                evt.preventDefault();
                if (selected.size === 1) {
                    const name = Array.from(selected)[0];
                    const item = currentItems.find((i) => i.name === name);
                    if (item) doRename(item);
                }
            } else if (key === "Enter") {
                if (selected.size === 1) {
                    const name = Array.from(selected)[0];
                    const item = currentItems.find((i) => i.name === name);
                    if (item) openItem(item);
                }
            } else if (key === "Backspace") {
                evt.preventDefault();
                goBack();
            } else if (key === "Escape") {
                selected = new Set();
                applySelectionClasses();
            }
        }

        document.addEventListener("keydown", keydownHandler);

        document.addEventListener("khangos:window-focus", (evt) => {
            isActive = evt.detail.id === "explorer";
        });
        document.addEventListener("khangos:window-close", (evt) => {
            if (evt.detail.id === "explorer") isActive = false;
        });

        /* -------------------------------- Boot -------------------------------- */

        updateNavButtons();
        loadFolder("");

        KhangWM.createWindow({
            id: "explorer",
            title: "Explorer",
            icon: "📁",
            width: 720,
            height: 480,
            content,
            onClose: () => {
                document.removeEventListener("keydown", keydownHandler);
                isActive = false;
            },
        });

        isActive = true;
    }

    registerApp({ id: "explorer", name: "Explorer", icon: "📁", launch });
})();
