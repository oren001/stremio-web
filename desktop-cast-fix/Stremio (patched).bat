@echo off
REM Launches Stremio v5 with the patched stremio-web build that fixes the
REM Chromecast button on Windows. WebView2 doesn't ship Chromium's Cast
REM Sender Media Router, so the stock cast button can't discover devices;
REM the patched build routes through the bundled streaming server's
REM /casting/ HTTP API instead.
REM
REM Prerequisite: from the repo root run `npm install` and `npm run build`
REM once. After that, this .bat is the only thing you need to run.

setlocal

REM This .bat sits in <repo>\desktop-cast-fix — the build/ is one level up.
set "FIX_DIR=%~dp0"
set "STREMIO_EXE=%LOCALAPPDATA%\Programs\Stremio\stremio-shell-ng.exe"
set "STATIC_SERVE=%FIX_DIR%static_serve.mjs"

REM Sanity check: did the user actually build the patched UI?
if not exist "%FIX_DIR%..\build\index.html" (
    echo.
    echo ERROR: Patched build not found at "%FIX_DIR%..\build\index.html"
    echo.
    echo From the repo root, run:
    echo   npm install
    echo   npm run build
    echo.
    pause
    exit /b 1
)

REM Make the streaming server's /casting/ endpoints emit CORS headers so
REM the patched UI (origin 127.0.0.1:11471) can fetch from it (origin
REM 127.0.0.1:11470). The bundled server already supports this env var;
REM stremio-runtime inherits it from Stremio's environment.
set "NO_CORS=1"

REM Uncomment to enable WebView2 DevTools (F12) for debugging.
REM set "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222"

REM Stop any already-running Stremio so it picks up our env + flags.
taskkill /F /IM stremio-shell-ng.exe >nul 2>&1
taskkill /F /IM stremio-runtime.exe >nul 2>&1

REM Start the static file server in a hidden background window if it's not
REM already running on port 11471.
powershell -NoProfile -Command "if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 11471 -WarningAction SilentlyContinue -InformationLevel Quiet)) { Start-Process -WindowStyle Hidden -FilePath node.exe -ArgumentList '%STATIC_SERVE%' }"

REM Give the server a beat to bind, then launch Stremio pointed at it.
ping -n 2 127.0.0.1 >nul
start "" "%STREMIO_EXE%" --webui-url=http://127.0.0.1:11471/

endlocal
