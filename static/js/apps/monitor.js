/**
 * apps/monitor.js - System Monitor app. Polls /api/system/status every
 * 2 seconds and renders live CPU / RAM / Disk bars plus host info.
 */

(function () {
    function barClass(percent) {
        if (percent >= 90) return "danger";
        if (percent >= 70) return "warn";
        return "";
    }

    function buildMetric(label) {
        const box = document.createElement("div");
        box.className = "monitor-metric";

        const header = document.createElement("div");
        header.className = "monitor-metric-header";
        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        const valueEl = document.createElement("span");
        valueEl.className = "metric-value";
        valueEl.textContent = "—";
        header.append(labelEl, valueEl);

        const track = document.createElement("div");
        track.className = "monitor-bar-track";
        const fill = document.createElement("div");
        fill.className = "monitor-bar-fill";
        fill.style.width = "0%";
        track.appendChild(fill);

        const sub = document.createElement("div");
        sub.className = "monitor-sub";
        sub.textContent = "";

        box.append(header, track, sub);
        return { box, valueEl, fill, sub };
    }

    function launch() {
        const content = document.createElement("div");
        content.className = "monitor-app";

        const summary = document.createElement("div");
        summary.className = "monitor-summary";
        summary.innerHTML = `
            <div>Hostname: <b data-field="hostname">—</b></div>
            <div>OS: <b data-field="os">—</b></div>
            <div>Uptime: <b data-field="uptime">—</b></div>
            <div>CPU cores: <b data-field="cpu_count">—</b></div>
        `;

        const cpuMetric = buildMetric("CPU");
        const ramMetric = buildMetric("RAM");
        const diskMetric = buildMetric("Disk");

        content.append(summary, cpuMetric.box, ramMetric.box, diskMetric.box);

        let timer = null;

        async function refresh() {
            try {
                const data = await KhangAPI.systemStatus();

                summary.querySelector('[data-field="hostname"]').textContent = data.hostname;
                summary.querySelector('[data-field="os"]').textContent = data.os;
                summary.querySelector('[data-field="uptime"]').textContent = data.uptime;
                summary.querySelector('[data-field="cpu_count"]').textContent = data.cpu_count;

                cpuMetric.valueEl.textContent = `${data.cpu.toFixed(1)}%`;
                cpuMetric.fill.style.width = `${Math.min(100, data.cpu)}%`;
                cpuMetric.fill.className = `monitor-bar-fill ${barClass(data.cpu)}`;

                ramMetric.valueEl.textContent = `${data.ram_percent.toFixed(1)}%`;
                ramMetric.fill.style.width = `${Math.min(100, data.ram_percent)}%`;
                ramMetric.fill.className = `monitor-bar-fill ${barClass(data.ram_percent)}`;
                ramMetric.sub.textContent = `${data.ram_used} GB / ${data.ram_total} GB`;

                diskMetric.valueEl.textContent = `${data.disk_percent.toFixed(1)}%`;
                diskMetric.fill.style.width = `${Math.min(100, data.disk_percent)}%`;
                diskMetric.fill.className = `monitor-bar-fill ${barClass(data.disk_percent)}`;
                diskMetric.sub.textContent = `${data.disk_used} GB / ${data.disk_total} GB`;
            } catch (err) {
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
                showNotification("System Monitor", err.message, "error");
            }
        }

        refresh();
        timer = setInterval(refresh, 2000);

        KhangWM.createWindow({
            id: "monitor",
            title: "System Monitor",
            icon: "📊",
            width: 380,
            height: 480,
            content,
            onClose: () => {
                if (timer) clearInterval(timer);
            },
        });
    }

    registerApp({ id: "monitor", name: "System Monitor", icon: "📊", launch });
})();
