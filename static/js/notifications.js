/**
 * notifications.js - Toast notification system.
 *
 * Usage:
 *   showNotification("Download complete", "test.zip has been downloaded.");
 *   showNotification("Upload failed", "Network error.", "error");
 */

function showNotification(title, message, type = "info", duration = 4500) {
    const layer = document.getElementById("notification-layer");
    if (!layer) return;

    const el = document.createElement("div");
    el.className = `kos-notification type-${type}`;

    const titleRow = document.createElement("div");
    titleRow.className = "kos-notification-title";

    const titleText = document.createElement("span");
    titleText.textContent = title;
    titleRow.appendChild(titleText);

    const closeBtn = document.createElement("button");
    closeBtn.className = "kos-notification-close";
    closeBtn.setAttribute("aria-label", "Close notification");
    closeBtn.textContent = "✕";
    titleRow.appendChild(closeBtn);

    const msgEl = document.createElement("div");
    msgEl.className = "kos-notification-message";
    msgEl.textContent = message || "";

    el.appendChild(titleRow);
    if (message) el.appendChild(msgEl);
    layer.appendChild(el);

    let removed = false;
    const remove = () => {
        if (removed) return;
        removed = true;
        el.style.transition = "opacity 150ms ease, transform 150ms ease";
        el.style.opacity = "0";
        el.style.transform = "translateX(24px)";
        setTimeout(() => el.remove(), 160);
    };

    closeBtn.addEventListener("click", remove);
    const timer = setTimeout(remove, duration);
    el.addEventListener("mouseenter", () => clearTimeout(timer));

    return { close: remove };
}
