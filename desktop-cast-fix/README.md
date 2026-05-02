# Stremio v5 Desktop — Chromecast / DLNA Fix (Windows)

If clicking the Cast button in Stremio v5 on Windows does nothing — your
Chromecasts don't appear, the device picker never opens — this is the fix.

This is the same fix as PR
[Stremio/stremio-web#1249](https://github.com/Stremio/stremio-web/pull/1249).
While that PR is reviewed, you can apply it manually with the steps below.
Once it's merged and Stremio deploys it, every desktop user gets cast working
automatically and you can throw this all away.

## Why is the cast button broken in the first place?

The Stremio v5 desktop shell on Windows hosts the web UI in **WebView2**
(Microsoft's embedded browser). WebView2 does not ship Chromium's Cast Sender
Media Router — Microsoft strips it out — so the Google Cast SDK loads but
device discovery never returns anything. The cast button is dead because there
are no devices for it to talk to. Setting `--enable-features=MediaRouter`
doesn't help; the underlying component isn't packaged.

## What this fix does

Stremio's bundled streaming server already implements full Chromecast + DLNA
support (mDNS/SSDP discovery, the [castv2](https://github.com/thibauts/node-castv2-client) sender protocol, ffmpeg
transcoding) — it just isn't wired up to the web UI in v5. The fix is a
small addition to `stremio-web` that detects shell mode and routes the cast
button through that streaming server instead of through Google CAF.

The result: cast works to Chromecast and DLNA receivers on your network, with
pause / play / seek / resume-from-saved-position.

## Limitations

- **Volume** control via the in-app slider doesn't work on most receivers
  (the Default Media Receiver overrides). Pause silences the TV.
- **Subtitle styling** and **audio track switching** during cast are
  best-effort — the fix uses the Chromecast Default Media Receiver, not
  Stremio's custom receiver app, so you lose some receiver-side niceties.
- Tested on Windows 10/11 with Chromecast (Sony) and a DLNA TV. Other
  receiver brands should work but YMMV.
- This is a **community workaround**. It is not a Stremio-supported install.
  Your Stremio app and account are not modified — the fix only changes which
  HTML/JS the desktop shell loads while it's running.

## Prerequisites

You need Node.js (18 or newer) and Git.

- Node.js: https://nodejs.org/ (the LTS download is fine)
- Git: https://git-scm.com/download/win (or `winget install Git.Git`)

If you can run `node -v` and `git --version` in a PowerShell or Command
Prompt window and get version numbers back, you're set.

## One-time setup

1. Open **PowerShell** (no admin needed).
2. Pick a folder to put the patched UI in — I'll use `%USERPROFILE%\stremio-cast-fix`:

   ```powershell
   cd $env:USERPROFILE
   git clone --branch windows-cast-fix-install --single-branch https://github.com/oren001/stremio-web.git stremio-cast-fix
   cd stremio-cast-fix
   npm install
   npm run build
   ```

   The `npm install` takes about 2 minutes the first time (it pulls ~1100
   packages). The `npm run build` takes about a minute and produces a
   `build\` folder.

3. Done. From now on you only need the launcher in step 4 — you do **not**
   need to rebuild unless you `git pull` an update.

## Daily use

Every time you want to use cast:

1. Close Stremio if it's already running (right-click → Quit from the
   system tray, or Task Manager).
2. From the `stremio-cast-fix` folder, double-click
   `desktop-cast-fix\Stremio (patched).bat`.

That's it. The script:
- Starts a tiny local static server on port 11471 (it'll exit when you log
  out, or you can kill it via Task Manager — search for `node.exe`).
- Launches Stremio pointed at the patched UI.

You'll see a brief "Casting to ..." overlay when you cast a movie. Pause,
seek, etc. all work.

To go back to the unpatched Stremio, just close Stremio and reopen it from
your normal Start Menu shortcut.

## Updating

When this fork updates (or after Stremio's PR merges and you want to switch
back), pull and rebuild:

```powershell
cd $env:USERPROFILE\stremio-cast-fix
git pull
npm install
npm run build
```

## Troubleshooting

- **"node is not recognized"** — Install Node.js, then close and reopen
  PowerShell so it picks up the new PATH.
- **`npm install` fails on `pnpm-lock.yaml`** — that's fine, we use npm
  here. The build still produces a working `build\`.
- **Cast button still does nothing** — make sure Stremio is launched via
  the .bat (not your normal shortcut), and confirm the static server is
  running by visiting <http://127.0.0.1:11471/> in a browser — you should
  see the Stremio UI.
- **No devices in the picker** — confirm the device is on the same Wi-Fi
  / VLAN, and that Windows Firewall isn't blocking mDNS for stremio-runtime
  (the streaming server has to do device discovery — if it can't, the
  picker stays empty).

## What's in this folder

- `static_serve.mjs` — a tiny zero-dependency Node HTTP server that serves
  the freshly built `..\build\` directory and reverse-proxies any unknown
  path (`/casting/`, `/<infoHash>/...`, `/settings`, etc.) to the streaming
  server on `127.0.0.1:11470`. Same-origin = no CORS issues.
- `Stremio (patched).bat` — the launcher; closes any running Stremio,
  starts the static server (in the background, hidden), launches Stremio
  with `--webui-url=http://127.0.0.1:11471/`, and sets `NO_CORS=1` for the
  bundled streaming server (lets the patched web UI fetch from the streaming
  server even though it's on a different port).

## Credit

The fix itself is in `src/services/Chromecast/ShellChromecastTransport.js`
on this branch. Open the [PR diff on stremio-web](https://github.com/Stremio/stremio-web/pull/1249)
to see the same code reviewed in proper context.
