/**
 * window-manager.js - Creates and manages KhangOS windows.
 *
 * Handles: drag, resize (8 handles), minimize, maximize/restore, close,
 * focus + z-index stacking, double-click titlebar to maximize, and
 * clamping windows so they can't be dragged fully off-screen.
 *
 * Other modules (taskbar.js) listen for these CustomEvents on `document`:
 *   khangos:window-open      { id, title, icon }
 *   khangos:window-close     { id }
 *   khangos:window-focus     { id }
 *   khangos:window-minimize  { id }
 *   khangos:window-restore   { id }
 *   khangos:window-title     { id, title }
 */

const KhangWM = (() => {
    const layer = document.getElementById("window-layer");
    const windows = new Map(); // id -> controller
    let zCounter = 100;
    let nextOffset = 0;

    function emit(name, detail) {
        document.dispatchEvent(new CustomEvent(name, { detail }));
    }

    function clampToViewport(win) {
        const desktop = document.getElementById("desktop");
        const maxW = desktop.clientWidth;
        const maxH = desktop.clientHeight;
        const minVisible = 60; // keep at least this many px of the window on screen

        let { x, y } = win.state;
        x = Math.max(-win.state.width + minVisible, Math.min(x, maxW - minVisible));
        y = Math.max(0, Math.min(y, maxH - minVisible));
        win.state.x = x;
        win.state.y = y;
        win.el.style.left = `${x}px`;
        win.el.style.top = `${y}px`;
    }

    function applyGeometry(win) {
        win.el.style.left = `${win.state.x}px`;
        win.el.style.top = `${win.state.y}px`;
        win.el.style.width = `${win.state.width}px`;
        win.el.style.height = `${win.state.height}px`;
    }

    function focusWindow(id) {
        const win = windows.get(id);
        if (!win) return;
        windows.forEach((w) => w.el.classList.remove("active"));
        win.el.classList.add("active");
        win.el.style.zIndex = ++zCounter;
        emit("khangos:window-focus", { id });
    }

    function minimizeWindow(id) {
        const win = windows.get(id);
        if (!win) return;
        win.el.classList.add("minimized");
        win.minimized = true;
        emit("khangos:window-minimize", { id });
    }

    function restoreWindow(id) {
        const win = windows.get(id);
        if (!win) return;
        win.el.classList.remove("minimized");
        win.minimized = false;
        emit("khangos:window-restore", { id });
        focusWindow(id);
    }

    function toggleMaximize(id) {
        const win = windows.get(id);
        if (!win) return;
        if (win.maximized) {
            win.el.classList.remove("maximized");
            Object.assign(win.state, win.preMaximizeState);
            applyGeometry(win);
            win.maximized = false;
        } else {
            win.preMaximizeState = { ...win.state };
            win.el.classList.add("maximized");
            const desktop = document.getElementById("desktop");
            win.state.x = 0;
            win.state.y = 0;
            win.state.width = desktop.clientWidth;
            win.state.height = desktop.clientHeight;
            applyGeometry(win);
            win.maximized = true;
        }
        focusWindow(id);
    }

    function closeWindow(id) {
        const win = windows.get(id);
        if (!win) return;
        if (typeof win.onClose === "function") {
            try { win.onClose(); } catch (e) { console.error(e); }
        }
        win.el.remove();
        windows.delete(id);
        emit("khangos:window-close", { id });
    }

    function setTitle(id, title) {
        const win = windows.get(id);
        if (!win) return;
        win.titleEl.textContent = title;
        emit("khangos:window-title", { id, title });
    }

    function startDrag(win, evt) {
        if (win.maximized) return;
        evt.preventDefault();
        focusWindow(win.id);
        win.el.classList.add("dragging");
        const startX = evt.clientX;
        const startY = evt.clientY;
        const originX = win.state.x;
        const originY = win.state.y;

        function onMove(e) {
            win.state.x = originX + (e.clientX - startX);
            win.state.y = originY + (e.clientY - startY);
            clampToViewport(win);
        }
        function onUp() {
            win.el.classList.remove("dragging");
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    function startResize(win, evt, dirs) {
        if (win.maximized) return;
        evt.preventDefault();
        evt.stopPropagation();
        focusWindow(win.id);
        win.el.classList.add("resizing");

        const startX = evt.clientX;
        const startY = evt.clientY;
        const origin = { ...win.state };
        const minW = 280;
        const minH = 180;
        const desktop = document.getElementById("desktop");

        function onMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (dirs.includes("e")) {
                win.state.width = Math.max(minW, Math.min(origin.width + dx, desktop.clientWidth - origin.x));
            }
            if (dirs.includes("s")) {
                win.state.height = Math.max(minH, Math.min(origin.height + dy, desktop.clientHeight - origin.y));
            }
            if (dirs.includes("w")) {
                const newWidth = Math.max(minW, origin.width - dx);
                win.state.x = origin.x + (origin.width - newWidth);
                win.state.width = newWidth;
            }
            if (dirs.includes("n")) {
                const newHeight = Math.max(minH, origin.height - dy);
                win.state.y = origin.y + (origin.height - newHeight);
                win.state.height = newHeight;
            }
            applyGeometry(win);
        }
        function onUp() {
            win.el.classList.remove("resizing");
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    /**
     * Create and mount a new window.
     * @param {Object} opts
     * @param {string} opts.id - unique window id (usually the app id)
     * @param {string} opts.title
     * @param {string} [opts.icon]
     * @param {number} [opts.width=640]
     * @param {number} [opts.height=440]
     * @param {HTMLElement} opts.content - element to mount as the window body
     * @param {Function} [opts.onClose] - cleanup callback (clear timers/listeners)
     * @param {boolean} [opts.resizable=true]
     */
    function createWindow(opts) {
        if (windows.has(opts.id)) {
            focusWindow(opts.id);
            restoreWindow(opts.id);
            return windows.get(opts.id);
        }

        const desktop = document.getElementById("desktop");
        const width = opts.width || 640;
        const height = opts.height || 440;

        // Cascade new windows slightly so they don't all stack exactly.
        const offset = (nextOffset % 6) * 28;
        nextOffset += 1;
        const x = Math.max(20, Math.round((desktop.clientWidth - width) / 2) + offset - 60);
        const y = Math.max(16, Math.round((desktop.clientHeight - height) / 3) + offset - 40);

        const el = document.createElement("div");
        el.className = "kos-window";
        el.dataset.windowId = opts.id;

        const titlebar = document.createElement("div");
        titlebar.className = "kos-titlebar";

        const iconEl = document.createElement("span");
        iconEl.className = "kos-titlebar-icon";
        iconEl.textContent = opts.icon || "🗔";

        const titleEl = document.createElement("span");
        titleEl.className = "kos-titlebar-title";
        titleEl.textContent = opts.title || "Window";

        const controls = document.createElement("div");
        controls.className = "kos-titlebar-controls";

        const minBtn = document.createElement("button");
        minBtn.className = "kos-titlebar-btn kos-minimize";
        minBtn.title = "Minimize";
        minBtn.textContent = "—";

        const maxBtn = document.createElement("button");
        maxBtn.className = "kos-titlebar-btn kos-maximize";
        maxBtn.title = "Maximize";
        maxBtn.textContent = "□";

        const closeBtn = document.createElement("button");
        closeBtn.className = "kos-titlebar-btn kos-close";
        closeBtn.title = "Close";
        closeBtn.textContent = "×";

        controls.append(minBtn, maxBtn, closeBtn);
        titlebar.append(iconEl, titleEl, controls);

        const body = document.createElement("div");
        body.className = "kos-window-body";
        body.appendChild(opts.content);

        el.append(titlebar, body);

        const resizable = opts.resizable !== false;
        if (resizable) {
            ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach((dir) => {
                const handle = document.createElement("div");
                handle.className = `kos-resize-handle ${dir}`;
                handle.addEventListener("mousedown", (evt) => startResize(win, evt, dir.split("")));
                el.appendChild(handle);
            });
        }

        layer.appendChild(el);

        const win = {
            id: opts.id,
            el,
            titleEl,
            state: { x, y, width, height },
            maximized: false,
            minimized: false,
            onClose: opts.onClose,
        };
        windows.set(opts.id, win);
        applyGeometry(win);

        titlebar.addEventListener("mousedown", (evt) => {
            if (evt.target.closest(".kos-titlebar-btn")) return;
            startDrag(win, evt);
        });
        titlebar.addEventListener("dblclick", (evt) => {
            if (evt.target.closest(".kos-titlebar-btn")) return;
            toggleMaximize(opts.id);
        });
        el.addEventListener("mousedown", () => focusWindow(opts.id));

        minBtn.addEventListener("click", () => minimizeWindow(opts.id));
        maxBtn.addEventListener("click", () => toggleMaximize(opts.id));
        closeBtn.addEventListener("click", () => closeWindow(opts.id));

        emit("khangos:window-open", { id: opts.id, title: opts.title, icon: opts.icon });
        focusWindow(opts.id);

        return {
            id: opts.id,
            element: el,
            body,
            focus: () => focusWindow(opts.id),
            minimize: () => minimizeWindow(opts.id),
            restore: () => restoreWindow(opts.id),
            maximize: () => toggleMaximize(opts.id),
            close: () => closeWindow(opts.id),
            setTitle: (t) => setTitle(opts.id, t),
        };
    }

    function has(id) {
        return windows.has(id);
    }

    function isMinimized(id) {
        const win = windows.get(id);
        return win ? win.minimized : false;
    }

    // Clamp all open windows if the browser viewport is resized.
    window.addEventListener("resize", () => {
        windows.forEach((win) => {
            if (win.maximized) {
                const desktop = document.getElementById("desktop");
                win.state.width = desktop.clientWidth;
                win.state.height = desktop.clientHeight;
                applyGeometry(win);
            } else {
                clampToViewport(win);
            }
        });
    });

    return {
        createWindow,
        focusWindow,
        minimizeWindow,
        restoreWindow,
        toggleMaximize,
        closeWindow,
        setTitle,
        has,
        isMinimized,
    };
})();
