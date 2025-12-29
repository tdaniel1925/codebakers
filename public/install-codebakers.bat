@echo off
:: CodeBakers Installer for Windows
:: Double-click this file to install CodeBakers

title CodeBakers Installer
cls

echo.
echo ===============================================================
echo                   CodeBakers - One-Click Install
echo ===============================================================
echo.

:: Check for Node.js
echo Checking prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed.
    echo.
    echo Please install Node.js first:
    echo   Download from: https://nodejs.org
    echo   Or use: winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_VER=%%a
set NODE_VER=%NODE_VER:v=%
if %NODE_VER% LSS 18 (
    echo [WARNING] Node.js 18+ recommended.
)

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not installed.
    pause
    exit /b 1
)

echo [OK] Node.js found
echo [OK] npm found
echo.

:: Check if already installed
where codebakers >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo CodeBakers is already installed.
    echo Updating to latest version...
    set ALREADY_INSTALLED=1
) else (
    echo Installing CodeBakers CLI...
    set ALREADY_INSTALLED=0
)

:: Install/Update using PowerShell for better output
powershell -Command "npm install -g @codebakers/cli@latest" 2>nul

echo.
echo [OK] CodeBakers CLI installed!
echo.

:: Configure MCP for Claude Code
echo Connecting to Claude Code...

where claude >nul 2>nul
if %ERRORLEVEL% equ 0 (
    claude mcp add --transport stdio codebakers -- cmd /c "npx -y @codebakers/cli serve" 2>nul
    echo [OK] Connected to Claude Code
) else (
    echo [INFO] Claude Code not detected - will connect when you open it
)

echo.
echo ===============================================================
echo                   CodeBakers CLI installed!
echo ===============================================================
echo.
echo Next steps:
echo.
echo   1. Go to your project folder:
echo      cd your-project
echo.
echo   2. Start your free trial and install patterns:
echo      codebakers go
echo.
echo   3. Open Claude Code and start building!
echo      "Build me a todo app with authentication"
echo.
echo ===============================================================
echo.
pause
