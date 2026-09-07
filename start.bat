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

:: 同步到企业微信需要同源代理（server.js 提供 /api/wecom-sync），
:: 普通静态服务器（python -m http.server / Vite / Live Server 等）没有该路由，
:: POST 会返回 405，导致「同步失败，错误码：HTTP_405」。
:: 因此【优先】使用项目自带的 node server.js（内置同步代理）。
where node >nul 2>nul
if %errorlevel%==0 (
    echo   [Runtime] Node found, starting bundled proxy server ...
    echo   (该服务内置企业微信同步代理，同步功能可用)
    start "" "%URL%"
    node server.js %PORT%
    goto :end
)

:: 兜底：没有 Node 时退回 Python 静态服务器，但同步功能不可用（会报 HTTP_405）
where python >nul 2>nul
if %errorlevel%==0 (
    echo   [WARN] Node 未找到，回退到 Python 纯静态服务器。
    echo   [WARN] 注意：Python 静态服务器没有同步代理，企业微信同步会失败（HTTP_405）。
    echo   [WARN] 如需同步功能，请安装 Node.js 后重新运行 start.bat。
    start "" "%URL%"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

where py >nul 2>nul
if %errorlevel%==0 (
    echo   [WARN] Node 未找到，回退到 Python 纯静态服务器。
    echo   [WARN] 注意：Python 静态服务器没有同步代理，企业微信同步会失败（HTTP_405）。
    echo   [WARN] 如需同步功能，请安装 Node.js 后重新运行 start.bat。
    start "" "%URL%"
    py -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

echo   [ERROR] 未找到 Node.js 或 Python。
echo   请安装 Node.js（推荐，自带同步代理）后重新运行 start.bat。
echo.
pause

:end
echo.
echo   Server stopped.
pause
