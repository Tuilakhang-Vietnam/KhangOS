/**
 * core.js - App registry, Start Menu, and the KhangOS boot sequence.
 *
 * Apps register themselves via registerApp({ id, name, icon, launch }).
 * `launch` is called the first time the app is opened and is responsible
 * for building its content and calling KhangWM.createWindow(...).
 * Re-opening an already-running app just focuses/restores its window
 * instead of calling launch() again.
 */

const KhangCore = (() => {
    const registry = new Map(); // id -> { id, name, icon, launch }

    function registerApp(app) {
        if (!app || !app.id || typeof app.launch !== "function") {
            console.error("registerApp: invalid app definition", app);
            return;
        }
        registry.set(app.id, app);
    }

    function openApp(id, ...args) {
        const app = registry.get(id);
        if (!app) {
            console.error(`openApp: unknown app "${id}"`);
            return;
        }
        if (KhangWM.has(id)) {
            KhangWM.restoreWindow(id);
            KhangWM.focusWindow(id);
            return;
        }
        try {
            app.launch(...args);
        } catch (err) {
            console.error(`Failed to launch app "${id}":`, err);
            showNotification("Application error", `${app.name} could not be started.`, "error");
        }
    }

    function closeApp(id) {
        KhangWM.closeWindow(id);
    }

    function focusApp(id) {
        KhangWM.focusWindow(id);
    }

    function getApps() {
        return Array.from(registry.values());
    }

    function getApp(id) {
        return registry.get(id);
    }

    return { registerApp, openApp, closeApp, focusApp, getApps, getApp };
})();

// Expose the small set of global helpers the spec calls for.
function registerApp(app) { KhangCore.registerApp(app); }
function openApp(id, ...args) { KhangCore.openApp(id, ...args); }
function closeApp(id) { KhangCore.closeApp(id); }
function focusApp(id) { KhangCore.focusApp(id); }

/* ----------------------------- Start Menu ----------------------------- */

const KhangStartMenu = (() => {
    const listEl = document.getElementById("start-menu-list");
    const searchEl = document.getElementById("start-menu-search");

    function refresh(query) {
        const q = (query || "").trim().toLowerCase();
        const apps = KhangCore.getApps().filter((a) => a.name.toLowerCase().includes(q));

        listEl.innerHTML = "";
        if (apps.length === 0) {
            const empty = document.createElement("div");
            empty.className = "start-menu-empty";
            empty.textContent = "Không tìm thấy ứng dụng.";
            listEl.appendChild(empty);
            return;
        }

        apps.forEach((app) => {
            const btn = document.createElement("button");
            btn.className = "start-menu-item";

            const icon = document.createElement("span");
            icon.className = "app-icon";
            icon.textContent = app.icon || "🗔";

            const label = document.createElement("span");
            label.textContent = app.name;

            btn.append(icon, label);
            btn.addEventListener("click", () => {
                KhangCore.openApp(app.id);
                KhangTaskbar.closeStartMenu();
            });
            listEl.appendChild(btn);
        });
    }

    function init() {
        searchEl.addEventListener("input", () => refresh(searchEl.value));
        searchEl.addEventListener("keydown", (evt) => evt.stopPropagation());
    }

    return { init, refresh };
})();

/* ----------------------------- Boot ----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    KhangTaskbar.init();
    KhangStartMenu.init();
    KhangDesktop.init();
    KhangSettingsStore.applyStoredSettings();

    showNotification("Chào mừng đến với KhangOS", "Nhấp đúp vào một biểu tượng trên desktop để bắt đầu.", "info", 5000);
});
