/**
 * apps/terminal.js - KhangOS Terminal: a SAFE, SIMULATED shell.
 *
 * This never sends raw command strings to the server and never runs a
 * subprocess. It only supports a fixed allow-list of commands (help,
 * clear, pwd, ls, cd, whoami, hostname, date, echo, version). The
 * filesystem-aware commands (ls/cd/pwd) go through the same sandboxed
 * /api/files/list endpoint the Explorer uses, so they can never leave
 * KhangWeb/filesystem.
 */

(function () {
    const COMMANDS = ["help", "clear", "pwd", "ls", "cd", "whoami", "hostname", "date", "echo", "version"];

    function joinPath(cwd, segment) {
        if (!segment || segment === ".") return cwd;
        if (segment === "..") {
            if (!cwd) return "";
            const parts = cwd.split("/");
            parts.pop();
            return parts.join("/");
        }
        return cwd ? `${cwd}/${segment}` : segment;
    }

    function launch() {
        const content = document.createElement("div");
        content.className = "terminal-app";

        const output = document.createElement("div");
        output.id = "terminal-output-" + Date.now();

        const inputRow = document.createElement("div");
        inputRow.className = "terminal-input-row";
        const prompt = document.createElement("span");
        prompt.className = "terminal-prompt";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "terminal-input";
        input.autocomplete = "off";
        input.spellcheck = false;

        inputRow.append(prompt, input);
        content.append(output, inputRow);

        let cwd = ""; // relative to filesystem root; "" = root
        const history = [];
        let historyIndex = -1;
        let hostnameCache = null;

        function updatePrompt() {
            prompt.textContent = `khangos:/${cwd}>`;
        }

        function print(text, cls) {
            const line = document.createElement("div");
            line.className = "terminal-line" + (cls ? ` ${cls}` : "");
            line.textContent = text;
            output.appendChild(line);
        }

        function scrollToBottom() {
            content.scrollTop = content.scrollHeight;
        }

        async function runCommand(raw) {
            const trimmed = raw.trim();
            print(trimmed, "cmd");
            if (!trimmed) return;

            history.push(trimmed);
            historyIndex = history.length;

            const [cmd, ...rest] = trimmed.split(/\s+/);
            const arg = rest.join(" ");

            try {
                switch (cmd) {
                    case "help":
                        print(`Available commands: ${COMMANDS.join(", ")}`);
                        break;

                    case "clear":
                        output.innerHTML = "";
                        break;

                    case "pwd":
                        print(`/${cwd}`);
                        break;

                    case "ls": {
                        const target = arg ? joinPath(cwd, arg) : cwd;
                        const res = await KhangAPI.listFiles(target);
                        if (res.items.length === 0) {
                            print("(empty)");
                        } else {
                            print(res.items.map((i) => (i.type === "directory" ? `${i.name}/` : i.name)).join("   "));
                        }
                        break;
                    }

                    case "cd": {
                        const target = !arg || arg === "~" ? "" : joinPath(cwd, arg);
                        const res = await KhangAPI.listFiles(target);
                        cwd = res.path.replace(/\\/g, "/").replace(/^\/+/, "");
                        updatePrompt();
                        break;
                    }

                    case "whoami":
                        print("khangos-user");
                        break;

                    case "hostname": {
                        if (!hostnameCache) {
                            const status = await KhangAPI.systemStatus();
                            hostnameCache = status.hostname;
                        }
                        print(hostnameCache);
                        break;
                    }

                    case "date":
                        print(new Date().toString());
                        break;

                    case "echo":
                        print(arg);
                        break;

                    case "version":
                        print("KhangOS v0.1.0");
                        break;

                    default:
                        print(`command not found: ${cmd}`, "error");
                }
            } catch (err) {
                print(err.message || "Command failed.", "error");
            }

            scrollToBottom();
        }

        input.addEventListener("keydown", (evt) => {
            evt.stopPropagation();
            if (evt.key === "Enter") {
                const value = input.value;
                input.value = "";
                runCommand(value);
            } else if (evt.key === "ArrowUp") {
                evt.preventDefault();
                if (historyIndex > 0) {
                    historyIndex -= 1;
                    input.value = history[historyIndex] || "";
                }
            } else if (evt.key === "ArrowDown") {
                evt.preventDefault();
                if (historyIndex < history.length - 1) {
                    historyIndex += 1;
                    input.value = history[historyIndex] || "";
                } else {
                    historyIndex = history.length;
                    input.value = "";
                }
            }
        });

        content.addEventListener("mousedown", (evt) => {
            if (evt.target !== input) {
                // Let the click land, then refocus the input.
                setTimeout(() => input.focus(), 0);
            }
        });

        print("KhangOS Terminal v0.1.0 - type 'help' for a list of commands.");
        updatePrompt();

        KhangWM.createWindow({
            id: "terminal",
            title: "Terminal",
            icon: "💻",
            width: 560,
            height: 380,
            content,
        });

        setTimeout(() => input.focus(), 50);
    }

    registerApp({ id: "terminal", name: "Terminal", icon: "💻", launch });
})();
