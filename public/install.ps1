# CodeBakers One-Line Installer for Windows
# Usage: irm https://codebakers.ai/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "║                                                           ║" -ForegroundColor Red
Write-Host "║   " -ForegroundColor Red -NoNewline
Write-Host "CodeBakers" -ForegroundColor Blue -NoNewline
Write-Host " - One-Click Install                        ║" -ForegroundColor Red
Write-Host "║                                                           ║" -ForegroundColor Red
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""

# Check for Node.js
Write-Host "Checking prerequisites..." -ForegroundColor Blue

try {
    $nodeVersion = node -v 2>$null
    if (-not $nodeVersion) {
        throw "Node.js not found"
    }
} catch {
    Write-Host "Node.js is not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js first:"
    Write-Host "  Download from: https://nodejs.org/en/download"
    Write-Host "  Or use: winget install OpenJS.NodeJS.LTS"
    Write-Host ""
    exit 1
}

# Check Node version
$versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNumber -lt 18) {
    Write-Host "Warning: Node.js 18+ recommended. You have $nodeVersion" -ForegroundColor Yellow
}

try {
    $npmVersion = npm -v 2>$null
    if (-not $npmVersion) {
        throw "npm not found"
    }
} catch {
    Write-Host "npm is not installed." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
Write-Host "✓ npm $npmVersion found" -ForegroundColor Green
Write-Host ""

# Install CodeBakers CLI
Write-Host "Installing CodeBakers CLI..." -ForegroundColor Blue

try {
    npm install -g @codebakers/cli@latest 2>$null
    Write-Host "✓ CodeBakers CLI installed" -ForegroundColor Green
} catch {
    Write-Host "Failed to install CLI. Trying with elevated permissions..." -ForegroundColor Yellow
    Start-Process npm -ArgumentList "install -g @codebakers/cli@latest" -Wait -NoNewWindow
    Write-Host "✓ CodeBakers CLI installed" -ForegroundColor Green
}
Write-Host ""

# Register MCP with Claude Code
Write-Host "Connecting to Claude Code..." -ForegroundColor Blue

try {
    $claudeExists = Get-Command claude -ErrorAction SilentlyContinue
    if ($claudeExists) {
        claude mcp add --transport stdio codebakers -- cmd /c "npx -y @codebakers/cli serve" 2>$null
        Write-Host "✓ Connected to Claude Code" -ForegroundColor Green
    } else {
        Write-Host "⚠ Claude Code not detected - will connect when you open it" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not auto-connect to Claude Code" -ForegroundColor Yellow
}
Write-Host ""

# Start trial and install patterns
Write-Host "Starting your free trial..." -ForegroundColor Blue
Write-Host ""

try {
    # Try to run codebakers go
    $env:CODEBAKERS_NONINTERACTIVE = "1"
    & codebakers go 2>$null
} catch {
    try {
        & npx @codebakers/cli go 2>$null
    } catch {
        Write-Host "Running interactive setup..." -ForegroundColor Yellow
        & npx @codebakers/cli go
    }
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ CodeBakers is ready!                                  ║" -ForegroundColor Green
Write-Host "║                                                           ║" -ForegroundColor Green
Write-Host "║  Open Claude Code and start building:                     ║" -ForegroundColor Green
Write-Host '║  "Build me a todo app with authentication"               ║' -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Restart Claude Code to load CodeBakers patterns." -ForegroundColor Yellow
Write-Host ""
