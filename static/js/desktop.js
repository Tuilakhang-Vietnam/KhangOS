/**
 * desktop.js - Desktop icons: rendering, selection, dragging, and the
 * desktop's own right-click context menu.
 */

const KhangDesktop = (() => {
    const ICONS = [
        { id: "explorer", label: "Explorer", icon: "📁" },
        { id: "monitor", label: "System Monitor", icon: "📊" },
        { id: "settings", label: "Settings", icon: "⚙️" },
        { id: "terminal", label: "Terminal", icon: "💻" },
        { id: "about", label: "About KhangOS", icon: "ℹ️" },
    ];

    const container = document.getElementById("desktop-icons");
    const desktop = document.getElementById("desktop");

    async function loadBingWallpaper() {
        try {
            const response = await fetch("/api/wallpaper");
            const data = await response.json();

            if (!data.success || !data.url) {
                throw new Error("Invalid wallpaper response");
            }

            const image = new Image();

            image.onload = () => {
                document.documentElement.style.setProperty(
                    "--kos-wallpaper",
                    `url("${data.url}")`
                );
                desktop.classList.add("wallpaper-loaded");
            };

            image.onerror = () => {
                console.error("Failed to load Bing wallpaper.");
            };

            image.src = data.url;
        } catch (error) {
            console.error("Failed to load Bing Image of the Day:", error);
        }
    }

    const GRID_SIZE = 100;
    let gridEnabled = localStorage.getItem("khangos-desktop-grid") === "true";

    function deselectAll() {
        container.querySelectorAll(".desktop-icon.selected").forEach((el) => el.classList.remove("selected"));
    }

    function snapToGrid(value) {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }

    function findFreeGridPosition(el, left, top) {
        const maxLeft = container.clientWidth - el.offsetWidth;
        const maxTop = container.clientHeight - el.offsetHeight;

        left = Math.max(0, Math.min(snapToGrid(left), maxLeft));
        top = Math.max(0, Math.min(snapToGrid(top), maxTop));

        const icons = [...container.querySelectorAll(".desktop-icon")]
            .filter((other) => other !== el);

        while (true) {
            const occupied = icons.some((other) => {
                return other.offsetLeft === left && other.offsetTop === top;
            });

            if (!occupied) {
                return { left, top };
            }

            top += GRID_SIZE;

            if (top > maxTop) {
                top = 0;
                left += GRID_SIZE;
            }

            if (left > maxLeft) {
                return { left: 0, top: 0 };
            }
        }
    }

    function toggleGrid() {
        gridEnabled = !gridEnabled;
        localStorage.setItem("khangos-desktop-grid", String(gridEnabled));

        if (gridEnabled) {
            container.querySelectorAll(".desktop-icon").forEach((el) => {
                const position = findFreeGridPosition(
                    el,
                    el.offsetLeft,
                    el.offsetTop
                );

                el.style.left = `${position.left}px`;
                el.style.top = `${position.top}px`;
            });
        }
    }

    function startIconDrag(el, evt) {
        evt.preventDefault();
        const startX = evt.clientX;
        const startY = evt.clientY;
        const originLeft = el.offsetLeft;
        const originTop = el.offsetTop;
        let moved = false;

        function onMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

            const maxLeft = container.clientWidth - el.offsetWidth;
            const maxTop = container.clientHeight - el.offsetHeight;

            const left = Math.max(0, Math.min(originLeft + dx, maxLeft));
            const top = Math.max(0, Math.min(originTop + dy, maxTop));

            el.style.left = `${left}px`;
            el.style.top = `${top}px`;
        }

        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            if (gridEnabled && moved) {
                const position = findFreeGridPosition(
                    el,
                    el.offsetLeft,
                    el.offsetTop
                );

                el.style.left = `${position.left}px`;
                el.style.top = `${position.top}px`;
            }

            if (!moved) {
                deselectAll();
                el.classList.add("selected");
            }
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    function iconContextMenu(evt, iconDef) {
        evt.preventDefault();
        evt.stopPropagation();
        deselectAll();
        evt.currentTarget.classList.add("selected");
        showContextMenu(evt.clientX, evt.clientY, [
            { label: "Open", icon: "↗", action: () => KhangCore.openApp(iconDef.id) },
        ]);
    }

    function desktopContextMenu(evt) {
        if (evt.target !== desktop && evt.target !== container) return;
        evt.preventDefault();
        deselectAll();
        showContextMenu(evt.clientX, evt.clientY, [
            { label: "Refresh", icon: "⟳", action: () => showNotification("Desktop", "Đã làm mới desktop.") },
            {
                label: gridEnabled ? "Grid ✓" : "Grid",
                icon: "▦",
                action: toggleGrid,
            },
            { label: "Settings", icon: "⚙️", action: () => KhangCore.openApp("settings") },
        ]);
    }

    function render() {
        container.innerHTML = "";
        ICONS.forEach((def, index) => {
            const el = document.createElement("div");
            el.className = "desktop-icon";

            const initialLeft = gridEnabled ? 0 : 14;
            const initialTop = gridEnabled ? index * GRID_SIZE : 14 + index * 100;

            el.style.left = `${initialLeft}px`;
            el.style.top = `${initialTop}px`;

            el.dataset.appId = def.id;

            const glyph = document.createElement("div");
            glyph.className = "icon-glyph";
            glyph.textContent = def.icon;

            const label = document.createElement("div");
            label.className = "icon-label";
            label.textContent = def.label;

            el.append(glyph, label);
            container.appendChild(el);

            el.addEventListener("mousedown", (evt) => {
                if (evt.button !== 0) return;
                startIconDrag(el, evt);
            });
            el.addEventListener("dblclick", () => KhangCore.openApp(def.id));
            el.addEventListener("contextmenu", (evt) => iconContextMenu(evt, def));
        });
    }

    function init() {
        render();
        loadBingWallpaper();
        desktop.addEventListener("mousedown", (evt) => {
            if (evt.target === desktop || evt.target === container) deselectAll();
        });
        desktop.addEventListener("contextmenu", desktopContextMenu);
    }

    return { init };
})();
