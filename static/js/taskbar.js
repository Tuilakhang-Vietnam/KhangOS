/**
 * taskbar.js - Clock, Start button, and running-app buttons.
 *
 * Listens to the khangos:window-* events emitted by window-manager.js so
 * it never has to know about individual apps.
 */

const KhangTaskbar = (() => {
    const appsEl = document.getElementById("taskbar-apps");
    const clockEl = document.getElementById("taskbar-clock");
    const startBtn = document.getElementById("start-button");
    const startMenu = document.getElementById("start-menu");

    const buttons = new Map(); // windowId -> button element
    let focusedId = null;

    function updateClock() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    function refreshActiveStates() {
        buttons.forEach((btn, id) => {
            btn.classList.toggle("active", id === focusedId && !KhangWM.isMinimized(id));
        });
    }

    function addButton(id, title, icon) {
        const btn = document.createElement("button");
        btn.className = "taskbar-app-btn";
        btn.dataset.windowId = id;

        const iconEl = document.createElement("span");
        iconEl.className = "app-icon";
        iconEl.textContent = icon || "🗔";

        const labelEl = document.createElement("span");
        labelEl.className = "app-label";
        labelEl.textContent = title || id;

        btn.append(iconEl, labelEl);
        btn.addEventListener("click", () => {
            if (KhangWM.isMinimized(id)) {
                KhangWM.restoreWindow(id);
            } else if (focusedId === id) {
                KhangWM.minimizeWindow(id);
            } else {
                KhangWM.focusWindow(id);
            }
        });

        appsEl.appendChild(btn);
        buttons.set(id, btn);
    }

    function removeButton(id) {
        const btn = buttons.get(id);
        if (btn) btn.remove();
        buttons.delete(id);
        if (focusedId === id) focusedId = null;
    }

    function closeStartMenu() {
        startMenu.classList.add("hidden");
        startBtn.classList.remove("active");
    }

    function toggleStartMenu() {
        const isHidden = startMenu.classList.contains("hidden");
        if (isHidden) {
            startMenu.classList.remove("hidden");
            startBtn.classList.add("active");
            const search = document.getElementById("start-menu-search");
            if (search) {
                search.value = "";
                search.focus();
            }
            if (window.KhangStartMenu) window.KhangStartMenu.refresh("");
        } else {
            closeStartMenu();
        }
    }

    function init() {
        updateClock();
        setInterval(updateClock, 1000);

        startBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
            toggleStartMenu();
        });

        document.addEventListener("mousedown", (evt) => {
            if (!startMenu.classList.contains("hidden")) {
                if (!startMenu.contains(evt.target) && evt.target !== startBtn && !startBtn.contains(evt.target)) {
                    closeStartMenu();
                }
            }
        });

        document.addEventListener("keydown", (evt) => {
            if (evt.key === "Escape") closeStartMenu();
        });

        document.addEventListener("khangos:window-open", (evt) => {
            addButton(evt.detail.id, evt.detail.title, evt.detail.icon);
            focusedId = evt.detail.id;
            refreshActiveStates();
        });
        document.addEventListener("khangos:window-close", (evt) => {
            removeButton(evt.detail.id);
            refreshActiveStates();
        });
        document.addEventListener("khangos:window-focus", (evt) => {
            focusedId = evt.detail.id;
            refreshActiveStates();
        });
        document.addEventListener("khangos:window-minimize", refreshActiveStates);
        document.addEventListener("khangos:window-restore", (evt) => {
            focusedId = evt.detail.id;
            refreshActiveStates();
        });
        document.addEventListener("khangos:window-title", (evt) => {
            const btn = buttons.get(evt.detail.id);
            if (btn) btn.querySelector(".app-label").textContent = evt.detail.title;
        });
    }

    return { init, closeStartMenu };
})();
