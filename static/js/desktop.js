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

    function deselectAll() {
        container.querySelectorAll(".desktop-icon.selected").forEach((el) => el.classList.remove("selected"));
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
            el.style.left = `${Math.max(0, Math.min(originLeft + dx, maxLeft))}px`;
            el.style.top = `${Math.max(0, Math.min(originTop + dy, maxTop))}px`;
        }
        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
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
            { label: "Settings", icon: "⚙️", action: () => KhangCore.openApp("settings") },
            { separator: true },
            { label: "About KhangOS", icon: "ℹ️", action: () => KhangCore.openApp("about") },
        ]);
    }

    function render() {
        container.innerHTML = "";
        ICONS.forEach((def, index) => {
            const el = document.createElement("div");
            el.className = "desktop-icon";
            el.style.left = "14px";
            el.style.top = `${14 + index * 100}px`;
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
        desktop.addEventListener("mousedown", (evt) => {
            if (evt.target === desktop || evt.target === container) deselectAll();
        });
        desktop.addEventListener("contextmenu", desktopContextMenu);
    }

    return { init };
})();
