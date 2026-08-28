/**
 * apps/novabrowser.js - NovaBrowser
 *
 * Lightweight browser shell for KhangOS.
 * Networking, DNS, cookies, storage and rendering are handled
 * by the host browser.
 */

(function () {
    const HOME_URL = "https://www.bing.com/";

    function normalizeInput(value) {
        const input = value.trim();

        if (!input) return HOME_URL;

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

    function launch() {
        const content = document.createElement("div");
        content.className = "novabrowser-app";

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

        const loading = document.createElement("div");
        loading.className = "novabrowser-loading";
        loading.textContent = "Loading…";

        const frame = document.createElement("iframe");
        frame.className = "novabrowser-frame";
        frame.title = "NovaBrowser";
        frame.referrerPolicy = "strict-origin-when-cross-origin";

        const body = document.createElement("div");
        body.className = "novabrowser-body";
        body.append(loading, frame);

        content.append(toolbar, body);

        let currentUrl = HOME_URL;

        function updateAddress() {
            address.value = currentUrl;
        }

        function setLoading(value) {
            loading.classList.toggle("visible", value);
        }

        function navigate(value) {
            const url = normalizeInput(value);

            currentUrl = url;
            updateAddress();
            setLoading(true);

            frame.src = url;
            KhangWM.setTitle("novabrowser", `NovaBrowser — ${url}`);
        }

        backBtn.addEventListener("click", () => {
            try {
                frame.contentWindow.history.back();
            } catch {
                // Cross-origin navigation is controlled by the host browser.
            }
        });

        forwardBtn.addEventListener("click", () => {
            try {
                frame.contentWindow.history.forward();
            } catch {
                // Cross-origin navigation is controlled by the host browser.
            }
        });

        reloadBtn.addEventListener("click", () => {
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

        frame.addEventListener("load", () => {
            setLoading(false);

            try {
                currentUrl = frame.contentWindow.location.href;
                updateAddress();
                KhangWM.setTitle(
                    "novabrowser",
                    `NovaBrowser — ${currentUrl}`
                );
            } catch {
                // Cross-origin page: browser security prevents reading its URL.
            }
        });

        navigate(HOME_URL);

        KhangWM.createWindow({
            id: "novabrowser",
            title: "NovaBrowser",
            icon: "🌐",
            width: 900,
            height: 600,
            content,
        });
    }

    registerApp({
        id: "novabrowser",
        name: "NovaBrowser",
        icon: "🌐",
        launch,
    });
})();