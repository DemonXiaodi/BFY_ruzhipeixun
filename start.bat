@echo off
setlocal
title Onboarding Training Platform - Local Server
cd /d "%~dp0"

set PORT=5180
set URL=http://127.0.0.1:%PORT%/index.html

echo.
echo  Starting onboarding training platform ...
echo  Root: %CD%
echo.

:: Prefer Node (bundled server.js has WeCom sync proxy)
where node >nul 2>nul
if %errorlevel%==0 (
    echo  [Runtime] Node found - starting bundled server (WeCom sync enabled)
    start "" "%URL%"
    node server.js %PORT%
    goto :done
)

:: Fallback to Python
where python >nul 2>nul
if %errorlevel%==0 (
    echo  [Runtime] Node not found - using Python static server
    echo  (Note: WeCom sync needs Node; other content works fine)
    start "" "%URL%"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo  [Runtime] Node not found - using Python static server
    start "" "%URL%"
    py -m http.server %PORT% --bind 127.0.0.1
    goto :done
)

:: No runtime available: open the page directly.
:: Images and text work; the 3 interactive games need a local server.
echo  [WARN] Node.js or Python not found on this PC.
echo  Opening index.html directly - images and text will show,
echo  but the 3 interactive games require a local server to run.
echo  Install Node.js (recommended), then re-run start.bat for full features.
echo.
start "" "%~dp0index.html"
pause
goto :done

:done
