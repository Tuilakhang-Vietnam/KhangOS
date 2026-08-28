/**
 * apps/about.js - The "About KhangOS" app.
 */

(function () {
    function launch() {
        const content = document.createElement("div");
        content.className = "about-app";
        content.innerHTML = `
            <div class="about-logo">🖥️</div>
            <h2>KhangOS</h2>
            <div class="about-tagline">Web-based operating environment</div>
            <div class="about-version">Version ${window.KHANGOS_VERSION}</div>
            <div class="about-stack">
                <span>Python</span>
                <span>Flask</span>
                <span>JavaScript</span>
            </div>
        `;

        KhangWM.createWindow({
            id: "about",
            title: "About KhangOS",
            icon: "ℹ️",
            width: 360,
            height: 320,
            resizable: false,
            content,
        });
    }

    registerApp({ id: "about", name: "About KhangOS", icon: "ℹ️", launch });
})();
