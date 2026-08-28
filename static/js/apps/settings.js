/**
 * apps/settings.js - Settings app, plus KhangSettingsStore, the small
 * localStorage-backed store that other modules (core.js at boot time)
 * use to apply the saved theme/wallpaper/animation preference.
 */

const KhangSettingsStore = (() => {
    const STORAGE_KEY = "khangos-settings";

    const WALLPAPERS = [
        { id: "midnight", label: "Midnight", value: "linear-gradient(160deg, #1c2030 0%, #12131a 55%, #1a1425 100%)" },
        { id: "aurora", label: "Aurora", value: "linear-gradient(160deg, #16323f 0%, #1b1a2e 55%, #241b3a 100%)" },
        { id: "sunset", label: "Sunset", value: "linear-gradient(160deg, #3a1c30 0%, #23122c 55%, #1a1020 100%)" },
        { id: "forest", label: "Forest", value: "linear-gradient(160deg, #16241f 0%, #101a1f 55%, #0d1a12 100%)" },

        {
            id: "bing-iotd",
            label: "Image of the Day",
            type: "bing-iotd",
            value: "linear-gradient(160deg, #202020 0%, #101010 100%)",
            image: null,
            title: "",
            copyright: "",
        },
    ];

    const DEFAULTS = {
        theme: "dark",
        wallpaper: { type: "preset", id: "midnight" },
        animations: true,
    };

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...DEFAULTS };
            const parsed = JSON.parse(raw);
            return { ...DEFAULTS, ...parsed };
        } catch (e) {
            return { ...DEFAULTS };
        }
    }

    function save(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error("Could not save settings:", e);
        }
    }

    function wallpaperCss(settings) {
        if (settings.wallpaper && settings.wallpaper.type === "color") {
            return settings.wallpaper.value;
        }

        if (
            settings.wallpaper &&
            settings.wallpaper.type === "bing-iotd" &&
            settings.wallpaper.url
        ) {
            return `url("${settings.wallpaper.url}")`;
        }

        const preset =
            WALLPAPERS.find(
                (w) => w.id === (settings.wallpaper && settings.wallpaper.id)
            ) || WALLPAPERS[0];

        if (preset.type === "bing-iotd" && preset.image) {
            return `url("${preset.image}")`;
        }

        return preset.value;
    }

    function apply(settings) {
        document.documentElement.setAttribute("data-theme", settings.theme === "light" ? "light" : "dark");
        document.documentElement.style.setProperty("--kos-wallpaper", wallpaperCss(settings));
        document.body.classList.toggle("kos-no-animations", settings.animations === false);
    }

    function applyStoredSettings() {
        apply(load());
    }

    function update(partial) {
        const merged = { ...load(), ...partial };
        save(merged);
        apply(merged);
        return merged;
    }

    return { load, save, apply, applyStoredSettings, update, WALLPAPERS };
})();

(function () {
    function buildRow(labelText, controlEl) {
        const row = document.createElement("div");
        row.className = "settings-row";
        const label = document.createElement("span");
        label.textContent = labelText;
        row.append(label, controlEl);
        return row;
    }

    function launch() {
        const settings = KhangSettingsStore.load();

        const content = document.createElement("div");
        content.className = "settings-app";

        // --- Appearance ---
        const appearanceSection = document.createElement("div");
        appearanceSection.className = "settings-section";
        appearanceSection.innerHTML = "<h4>Appearance</h4>";

        const themeGroup = document.createElement("div");
        themeGroup.className = "theme-toggle-group";
        ["dark", "light"].forEach((mode) => {
            const btn = document.createElement("button");
            btn.className = "theme-toggle-btn" + (settings.theme === mode ? " active" : "");
            btn.textContent = mode === "dark" ? "Dark" : "Light";
            btn.addEventListener("click", () => {
                const updated = KhangSettingsStore.update({ theme: mode });
                themeGroup.querySelectorAll(".theme-toggle-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
            });
            themeGroup.appendChild(btn);
        });
        appearanceSection.appendChild(buildRow("Theme", themeGroup));

        // --- Wallpaper ---
        const wallpaperSection = document.createElement("div");
        wallpaperSection.className = "settings-section";
        wallpaperSection.innerHTML = "<h4>Wallpaper</h4>";

        const iotdButton = document.createElement("button");
        iotdButton.className = "wallpaper-iotd";
        iotdButton.textContent = "🌄 Image of the Day";

        iotdButton.addEventListener("click", async () => {
            iotdButton.disabled = true;
            iotdButton.textContent = "🌄 Loading...";

            try {
                const response = await fetch("/api/wallpaper");

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (!data.success || !data.url) {
                    throw new Error(data.error || "No wallpaper returned.");
                }

                const wallpaper = {
                    type: "bing-iotd",
                    url: data.url,
                    title: data.title || "",
                    copyright: data.copyright || "",
                };

                KhangSettingsStore.update({
                    wallpaper,
                });

                // Áp dụng ngay lập tức
                document.documentElement.style.setProperty(
                    "--kos-wallpaper",
                    `url("${data.url}")`
                );

                iotdButton.classList.add("active");

                showNotification(
                    "Personalization",
                    "Bing Image of the Day đã được đặt làm hình nền."
                );
            } catch (error) {
                console.error("Bing IOTD error:", error);

                showNotification(
                    "Personalization",
                    "Không thể tải Bing Image of the Day."
                );
            } finally {
                iotdButton.disabled = false;
                iotdButton.textContent = "🌄 Image of the Day";
            }
        });

        wallpaperSection.appendChild(iotdButton);

        const swatchGroup = document.createElement("div");
        swatchGroup.className = "wallpaper-swatches";
        KhangSettingsStore.WALLPAPERS.forEach((wp) => {
            const swatch = document.createElement("button");

            const isActive =
                settings.wallpaper &&
                settings.wallpaper.type !== "color" &&
                settings.wallpaper.id === wp.id;

            swatch.className =
                "wallpaper-swatch" + (isActive ? " active" : "");

            swatch.title = wp.label;
            swatch.setAttribute("aria-label", wp.label);

            if (wp.type === "bing-iotd") {
                // Placeholder trước khi Bing trả ảnh
                swatch.style.background = wp.value;
                swatch.classList.add("wallpaper-iotd");

                const loading = document.createElement("span");
                loading.className = "wallpaper-iotd-label";
                loading.textContent = "🌄 Image of the Day";

                swatch.appendChild(loading);
            } else {
                swatch.style.background = wp.value;
            }

            swatch.addEventListener("click", () => {
                if (wp.type === "bing-iotd") {
                    if (!wp.image) {
                        showNotification(
                            "Wallpaper",
                            "Image of the Day chưa tải xong."
                        );
                        return;
                    }

                    KhangSettingsStore.update({
                        wallpaper: {
                            type: "bing-iotd",
                            id: "bing-iotd",
                            url: wp.image,
                            title: wp.title || "",
                            copyright: wp.copyright || "",
                        },
                    });
                } else {
                    KhangSettingsStore.update({
                        wallpaper: {
                            type: "preset",
                            id: wp.id,
                        },
                    });
                }

                swatchGroup
                    .querySelectorAll(".wallpaper-swatch")
                    .forEach((s) => s.classList.remove("active"));

                colorInput.parentElement.classList.remove("active");

                swatch.classList.add("active");
            });

            swatchGroup.appendChild(swatch);

            // Lưu lại để loadBingIotdPreview() tìm được card
            if (wp.type === "bing-iotd") {
                swatch.dataset.wallpaperId = "bing-iotd";
            }
        });

        async function loadBingIotdPreview() {
            try {
                const response = await fetch("/api/wallpaper");

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (!data.success || !data.url) {
                    throw new Error(data.error || "No Bing wallpaper returned.");
                }

                const iotd = KhangSettingsStore.WALLPAPERS.find(
                    (wp) => wp.id === "bing-iotd"
                );

                if (!iotd) {
                    return;
                }

                iotd.image = data.url;
                iotd.title = data.title || "Image of the Day";
                iotd.copyright = data.copyright || "";

                const swatch = swatchGroup.querySelector(
                    '[data-wallpaper-id="bing-iotd"]'
                );

                if (!swatch) {
                    return;
                }

                // Preview thật của Bing
                swatch.style.backgroundImage = `url("${data.url}")`;
                swatch.style.backgroundSize = "cover";
                swatch.style.backgroundPosition = "center";

                const label = swatch.querySelector(".wallpaper-iotd-label");

                if (label) {
                    label.textContent = "🌄 Image of the Day";
                }

                // Nếu IOTD đang được chọn thì cập nhật URL mới
                // nhưng chỉ áp dụng nếu người dùng đang dùng IOTD.
                const current = KhangSettingsStore.load();

                if (
                    current.wallpaper &&
                    current.wallpaper.type === "bing-iotd"
                ) {
                    KhangSettingsStore.update({
                        wallpaper: {
                            type: "bing-iotd",
                            id: "bing-iotd",
                            url: data.url,
                            title: data.title || "",
                            copyright: data.copyright || "",
                        },
                    });

                    swatch.classList.add("active");
                }
            } catch (error) {
                console.error(
                    "Failed to load Bing Image of the Day:",
                    error
                );
            }
        }

        loadBingIotdPreview();

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.title = "Custom color";
        colorInput.className = "wallpaper-swatch";
        colorInput.style.padding = "0";
        if (settings.wallpaper && settings.wallpaper.type === "color") {
            colorInput.value = settings.wallpaper.value;
            colorInput.classList.add("active");
        } else {
            colorInput.value = "#1c2030";
        }
        colorInput.addEventListener("input", () => {
            KhangSettingsStore.update({ wallpaper: { type: "color", value: colorInput.value } });
            swatchGroup.querySelectorAll(".wallpaper-swatch").forEach((s) => s.classList.remove("active"));
        });
        swatchGroup.appendChild(colorInput);

        wallpaperSection.appendChild(buildRow("Preset / custom", swatchGroup));

        // --- Behavior ---
        const behaviorSection = document.createElement("div");
        behaviorSection.className = "settings-section";
        behaviorSection.innerHTML = "<h4>Behavior</h4>";

        const animSwitch = document.createElement("button");
        animSwitch.className = "kos-switch" + (settings.animations !== false ? " on" : "");
        animSwitch.addEventListener("click", () => {
            const nowOn = !animSwitch.classList.contains("on");
            animSwitch.classList.toggle("on", nowOn);
            KhangSettingsStore.update({ animations: nowOn });
        });
        behaviorSection.appendChild(buildRow("Animations", animSwitch));

        content.append(appearanceSection, wallpaperSection, behaviorSection);

        KhangWM.createWindow({
            id: "settings",
            title: "Settings",
            icon: "⚙️",
            width: 420,
            height: 460,
            content,
        });
    }

    registerApp({ id: "settings", name: "Settings", icon: "⚙️", launch });
})();
