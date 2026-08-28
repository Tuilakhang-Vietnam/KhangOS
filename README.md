# KhangOS

KhangOS is a web-based mini desktop environment. It runs entirely in the
browser as a single-page app, backed by a small Python/Flask server. There
is a desktop with icons, a taskbar, a Start Menu, a real window manager
(drag/resize/minimize/maximize), and five built-in apps: **Explorer**
(a real, sandboxed file manager), **System Monitor** (live CPU/RAM/Disk
via `psutil`), **Terminal** (a safe simulated shell), **Settings**, and
**About**.

## Requirements

- Python 3.9+
- pip

No Node.js, npm, React, Vue, or Angular are required. The frontend is
plain HTML5 / CSS3 / vanilla ES6+ JavaScript.

## Installation

From the `KhangWeb` folder:

```
py -m pip install -r requirements.txt
```

(On Linux/macOS, use `python3 -m pip install -r requirements.txt`.)

## Running

```
py app.py
```

The server listens on `0.0.0.0:8080` (no IP is hard-coded). Open:

```
http://127.0.0.1:8080
```

or, from any other device on the same network:

```
http://<SERVER-IP>:8080
```

Replace `<SERVER-IP>` with the machine's actual LAN IP address (e.g. shown
by `ipconfig` on Windows or `ip addr` on Linux).

## LAN access

Because Flask binds to `0.0.0.0`, any device on the same LAN that can reach
the server's IP on port 8080 can open KhangOS in its browser. This is
intended for a trusted local network only — see **Security** below.

## Project structure

```
KhangWeb/
├── app.py                     Flask app: routes + error handling
├── requirements.txt
├── README.md
│
├── backend/
│   ├── security.py            Path-sandboxing (the security boundary)
│   ├── filesystem.py          File/folder operations, all sandboxed
│   └── system.py              psutil-backed system metrics
│
├── templates/
│   └── index.html             The single page the whole app lives on
│
├── static/
│   ├── css/
│   │   ├── main.css           Reset, theme variables, shared widgets
│   │   ├── desktop.css        Wallpaper, desktop icons
│   │   ├── windows.css        Window chrome (titlebar, resize handles)
│   │   ├── taskbar.css        Taskbar + Start Menu
│   │   └── apps.css           Context menu, notifications, per-app UI
│   │
│   └── js/
│       ├── api.js             fetch() wrapper for every backend endpoint
│       ├── notifications.js   Toast notifications
│       ├── context-menu.js    Generic right-click menu
│       ├── window-manager.js  Drag/resize/minimize/maximize/focus/z-index
│       ├── taskbar.js         Clock, Start button, running-app buttons
│       ├── desktop.js         Desktop icons: render/select/drag/menu
│       ├── core.js            App registry, Start Menu, boot sequence
│       │
│       └── apps/
│           ├── explorer.js    File manager (talks to the file API)
│           ├── monitor.js     System Monitor (polls every 2s)
│           ├── settings.js    Theme / wallpaper / animation toggle
│           ├── terminal.js    Safe simulated shell
│           └── about.js       About panel
│
└── filesystem/                 <-- Explorer's sandboxed root directory
    └── (your files go here)
```

## Explorer root directory

**Everything Explorer (and the Terminal's `ls`/`cd`/`pwd`) can see lives
under `KhangWeb/filesystem/`.** This folder is created automatically the
first time you run `app.py` if it doesn't already exist.

## Security

This project is built for a **trusted LAN environment**, not the public
internet. In particular:

- Every filesystem API call is resolved through
  `backend/security.py::resolve_path()`, which rejects `..` traversal,
  absolute paths, Windows drive-letter paths, and any resolved path that
  ends up outside `filesystem/` — no client-supplied path can ever touch
  anything outside that folder.
- The Terminal is a **simulated** shell. It does not call `subprocess` and
  cannot run arbitrary Windows commands; it only understands a fixed list
  of safe commands (`help`, `clear`, `pwd`, `ls`, `cd`, `whoami`,
  `hostname`, `date`, `echo`, `version`), and its filesystem-aware commands
  go through the same sandboxed API as Explorer.
- There is no authentication. Do not expose port 8080 to the public
  internet. If you need remote administration or a real shell, that
  requires a separate authentication/authorization design — intentionally
  out of scope here.
- Errors are returned as `{"success": false, "error": "..."}` JSON;
  tracebacks are never sent to the client.

## API overview

All filesystem routes take/return paths **relative to** `filesystem/`.

| Method | Route                     | Purpose                          |
|--------|---------------------------|-----------------------------------|
| GET    | `/api/files/list`         | List a folder's contents          |
| GET    | `/api/files/download`     | Download a file                   |
| POST   | `/api/files/upload`       | Upload one or more files          |
| POST   | `/api/files/mkdir`        | Create a folder                   |
| POST   | `/api/files/rename`       | Rename a file or folder           |
| POST   | `/api/files/copy`         | Copy file(s)/folder(s)            |
| POST   | `/api/files/move`         | Move file(s)/folder(s)            |
| DELETE | `/api/files/delete`       | Delete a file or folder           |
| GET    | `/api/files/properties`   | Name/type/size/created/modified   |
| GET    | `/api/system/status`      | Live CPU/RAM/Disk/uptime/hostname |

Every response is JSON of the shape `{"success": true, ...}` or
`{"success": false, "error": "..."}`.

## Notes

- Settings (theme, wallpaper, animations) are saved in the browser's
  `localStorage`, per browser/device.
- The System Monitor polls `/api/system/status` every 2 seconds and stops
  polling automatically when its window is closed.
