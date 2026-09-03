@echo off
chcp 65001 >nul 2>nul
title 出口易新人培训平台 - Local Server
cd /d "%~dp0"

set PORT=5180
set URL=http://127.0.0.1:%PORT%/index.html

echo.
echo   Starting onboarding training platform ...
echo   Root: %CD%
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    echo   [Runtime] Python found, starting server ...
    start "" "%URL%"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo   [Runtime] py found, starting server ...
    start "" "%URL%"
    py -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

where node >nul 2>nul
if %errorlevel%==0 (
    echo   [Runtime] Node found, starting bundled server ...
    start "" "%URL%"
    node server.js %PORT%
    goto :end
)

echo   [ERROR] Neither Python nor Node was found in PATH.
echo   Please install one of them, or open index.html with a local server tool.
echo.
pause

:end
echo.
echo   Server stopped.
pause
