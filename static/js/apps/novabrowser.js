/**
 * apps/novabrowser.js - NovaBrowser
 *
 * Lightweight browser shell for KhangOS.
 * Networking, DNS, cookies, storage and rendering are handled
 * by the host browser.
 */

(function () {
    const HOME_URL = "nova://home";

    function normalizeInput(value) {
        const input = value.trim();

        if (!input) {
            return HOME_URL;
        }

        // Explicit URL
        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
            return input;
        }

        // Looks like a domain
        if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(input)) {
            return `https://${input}`;
        }

        // Otherwise search with Bing
        return `https://www.bing.com/search?q=${encodeURIComponent(input)}`;
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value;
        return div.innerHTML;
    }

    function launch() {
        const content = document.createElement("div");
        content.className = "novabrowser-app";

        /* ================= Toolbar ================= */

        const toolbar = document.createElement("div");
        toolbar.className = "novabrowser-toolbar";

        const backBtn = document.createElement("button");
        backBtn.className = "kos-btn novabrowser-nav-btn";
        backBtn.textContent = "←";
        backBtn.title = "Back";

        const forwardBtn = document.createElement("button");
        forwardBtn.className = "kos-btn novabrowser-nav-btn";
        forwardBtn.textContent = "→";
        forwardBtn.title = "Forward";

        const reloadBtn = document.createElement("button");
        reloadBtn.className = "kos-btn novabrowser-nav-btn";
        reloadBtn.textContent = "⟳";
        reloadBtn.title = "Reload";

        const homeBtn = document.createElement("button");
        homeBtn.className = "kos-btn novabrowser-nav-btn";
        homeBtn.textContent = "⌂";
        homeBtn.title = "Home";

        const address = document.createElement("input");
        address.className = "novabrowser-address";
        address.type = "text";
        address.placeholder = "Search or enter address";

        const goBtn = document.createElement("button");
        goBtn.className = "kos-btn novabrowser-go";
        goBtn.textContent = "↵";
        goBtn.title = "Go";

        toolbar.append(
            backBtn,
            forwardBtn,
            reloadBtn,
            homeBtn,
            address,
            goBtn
        );

        /* ================= Body ================= */

        const body = document.createElement("div");
        body.className = "novabrowser-body";

        content.append(toolbar, body);

        let currentUrl = HOME_URL;
        let frame = null;
        let loading = null;
        let navigationTimer = null;

        function updateAddress() {
            address.value = currentUrl;
        }

        function setLoading(value) {
            if (!loading) return;
            loading.classList.toggle("visible", value);
        }

        function createLoading() {
            loading = document.createElement("div");
            loading.className = "novabrowser-loading";
            loading.textContent = "Loading…";
            body.appendChild(loading);
        }

        function createFrame() {
            frame = document.createElement("iframe");

            frame.className = "novabrowser-frame";
            frame.title = "NovaBrowser";
            frame.referrerPolicy = "strict-origin-when-cross-origin";

            frame.addEventListener("load", () => {
                setLoading(false);
                clearTimeout(navigationTimer);

                try {
                    currentUrl = frame.contentWindow.location.href;
                    updateAddress();

                    KhangWM.setTitle(
                        "novabrowser",
                        `NovaBrowser — ${currentUrl}`
                    );
                } catch {
                    // Cross-origin page.
                    // The browser security model prevents reading its URL.
                }
            });

            body.appendChild(frame);
        }

        function showHomePage() {
            clearTimeout(navigationTimer);

            body.innerHTML = "";

            frame = null;
            loading = null;

            currentUrl = HOME_URL;
            address.value = "";

            const home = document.createElement("div");
            home.className = "novabrowser-home";

            home.innerHTML = `
        <div class="novabrowser-home-content">

            <div class="novabrowser-home-brand">
                <div class="novabrowser-home-logo">🌐</div>

                <div class="novabrowser-home-title">
                    <h1>NovaBrowser</h1>
                    <p>The web, your way.</p>
                </div>
            </div>

            <div class="novabrowser-home-search">
                <span class="novabrowser-home-search-icon">⌕</span>

                <input
                    type="text"
                    id="novabrowser-home-input"
                    placeholder="Search or enter a URL"
                    autocomplete="off"
                    spellcheck="false"
                >

                <button
                    id="novabrowser-home-go"
                    title="Search"
                >
                    →
                </button>
            </div>

            <div class="novabrowser-shortcuts">

                <button class="novabrowser-shortcut"
                        data-url="https://www.google.com">
                    <span class="shortcut-icon">🔵</span>
                    <span>Google</span>
                </button>

                <button class="novabrowser-shortcut"
                        data-url="https://www.youtube.com">
                    <span class="shortcut-icon">▶️</span>
                    <span>YouTube</span>
                </button>

                <button class="novabrowser-shortcut"
                        data-url="https://github.com">
                    <span class="shortcut-icon">🐙</span>
                    <span>GitHub</span>
                </button>

                <button class="novabrowser-shortcut"
                        data-url="https://www.bing.com">
                    <span class="shortcut-icon">🔎</span>
                    <span>Bing</span>
                </button>

            </div>

            <div class="novabrowser-home-footer">
                <span>KhangOS</span>
                <span>•</span>
                <span>NovaBrowser</span>
            </div>

        </div>
    `;

            body.appendChild(home);

            const input = home.querySelector("#novabrowser-home-input");
            const button = home.querySelector("#novabrowser-home-go");

            function search() {
                const value = input.value.trim();

                if (!value) return;

                navigate(value);
            }

            button.addEventListener("click", search);

            input.addEventListener("keydown", (evt) => {
                if (evt.key === "Enter") {
                    evt.preventDefault();
                    search();
                }

                evt.stopPropagation();
            });

            home.querySelectorAll(".novabrowser-shortcut").forEach((shortcut) => {
                shortcut.addEventListener("click", () => {
                    navigate(shortcut.dataset.url);
                });
            });

            setTimeout(() => input.focus(), 50);
        }

        function showBrowserParentMessage(url) {
            clearTimeout(navigationTimer);

            body.innerHTML = "";

            frame = null;
            loading = null;

            const message = document.createElement("div");
            message.className = "novabrowser-parent-message";

            message.innerHTML = `
                <div class="novabrowser-parent-icon">🌐</div>

                <h2>Trang đang được mở</h2>

                <p>
                    Trang này không thể hiển thị bên trong NovaBrowser.
                    Nó đang được mở trong trình duyệt mẹ.
                </p>

                <span class="novabrowser-parent-url">
                    ${escapeHtml(url)}
                </span>
            `;

            body.appendChild(message);
        }

        function openInParentBrowser(url) {
            window.open(url, "_blank", "noopener,noreferrer");
            showBrowserParentMessage(url);
        }

        function navigate(value) {
            const url = normalizeInput(value);

            // Home page
            if (url === HOME_URL) {
                showHomePage();
                return;
            }

            currentUrl = url;
            updateAddress();

            body.innerHTML = "";

            frame = null;
            loading = null;

            createLoading();
            createFrame();

            setLoading(true);

            frame.src = url;

            clearTimeout(navigationTimer);

            /*
             * If the page refuses to be embedded, the browser may block
             * the iframe. After a short delay, fall back to the host browser.
             */
            navigationTimer = setTimeout(() => {
                if (!frame || !document.contains(frame)) {
                    return;
                }

                try {
                    const frameUrl = frame.contentWindow.location.href;

                    if (
                        frameUrl &&
                        frameUrl !== "about:blank"
                    ) {
                        clearTimeout(navigationTimer);
                        return;
                    }
                } catch {
                    // Cross-origin access is blocked.
                    // Treat this as a possible iframe restriction.
                }

                openInParentBrowser(url);
            }, 2500);
        }

        /* ================= Navigation ================= */

        backBtn.addEventListener("click", () => {
            if (!frame) return;

            try {
                frame.contentWindow.history.back();
            } catch {
                // Browser security restriction.
            }
        });

        forwardBtn.addEventListener("click", () => {
            if (!frame) return;

            try {
                frame.contentWindow.history.forward();
            } catch {
                // Browser security restriction.
            }
        });

        reloadBtn.addEventListener("click", () => {
            if (!frame) {
                navigate(currentUrl);
                return;
            }

            setLoading(true);

            try {
                frame.contentWindow.location.reload();
            } catch {
                frame.src = currentUrl;
            }
        });

        homeBtn.addEventListener("click", () => {
            navigate(HOME_URL);
        });

        goBtn.addEventListener("click", () => {
            navigate(address.value);
        });

        address.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                evt.preventDefault();
                navigate(address.value);
            }

            evt.stopPropagation();
        });

        /* ================= Window ================= */

        KhangWM.createWindow({
            id: "novabrowser",
            title: "NovaBrowser",
            icon: "🌐",
            width: 900,
            height: 600,
            content,
        });

        // Open NovaBrowser home page after the window exists.
        showHomePage();
    }

    registerApp({
        id: "novabrowser",
        name: "NovaBrowser",
        icon: "🌐",
        launch,
    });
})();