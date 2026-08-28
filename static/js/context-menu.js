/**
 * context-menu.js - Generic, reusable right-click context menu.
 *
 * Usage:
 *   showContextMenu(event.clientX, event.clientY, [
 *       { label: "New Folder", action: () => ... },
 *       { separator: true },
 *       { label: "Delete", action: () => ..., danger: true, disabled: false },
 *   ]);
 *
 * Closes on: click outside, Escape key, or selecting an item.
 */

const KhangContextMenu = (() => {
    const el = document.getElementById("context-menu");
    let openToken = 0;

    function close() {
        el.classList.add("hidden");
        el.innerHTML = "";
        document.removeEventListener("mousedown", onOutsideClick, true);
        document.removeEventListener("keydown", onKeyDown, true);
    }

    function onOutsideClick(evt) {
        if (!el.contains(evt.target)) close();
    }

    function onKeyDown(evt) {
        if (evt.key === "Escape") close();
    }

    function show(x, y, items) {
        const token = ++openToken;
        el.innerHTML = "";

        items.forEach((item) => {
            if (item.separator) {
                const sep = document.createElement("div");
                sep.className = "context-menu-separator";
                el.appendChild(sep);
                return;
            }
            const btn = document.createElement("button");
            btn.className = "context-menu-item" + (item.danger ? " danger" : "");
            btn.textContent = (item.icon ? item.icon + "  " : "") + item.label;
            btn.disabled = !!item.disabled;
            btn.addEventListener("click", () => {
                close();
                if (item.action) item.action();
            });
            el.appendChild(btn);
        });

        el.classList.remove("hidden");

        // Clamp to viewport after layout so we know the rendered size.
        requestAnimationFrame(() => {
            if (token !== openToken) return;
            const rect = el.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - 8;
            const maxY = window.innerHeight - rect.height - 8;
            el.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
            el.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
        });
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        document.addEventListener("mousedown", onOutsideClick, true);
        document.addEventListener("keydown", onKeyDown, true);
    }

    return { show, close };
})();

function showContextMenu(x, y, items) {
    KhangContextMenu.show(x, y, items);
}
