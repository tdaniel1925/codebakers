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

# Check if CodeBakers is already installed
$alreadyInstalled = $false
$currentVersion = ""
try {
    $codebakersExists = Get-Command codebakers -ErrorAction SilentlyContinue
    if ($codebakersExists) {
        $alreadyInstalled = $true
        $currentVersion = (& codebakers --version 2>$null) -replace '\s+', ''
        Write-Host "CodeBakers is already installed (v$currentVersion)" -ForegroundColor Yellow
        Write-Host "Updating to latest version..." -ForegroundColor Blue
    } else {
        Write-Host "Installing CodeBakers CLI..." -ForegroundColor Blue
    }
} catch {
    Write-Host "Installing CodeBakers CLI..." -ForegroundColor Blue
}

# Install/Update CodeBakers CLI
try {
    npm install -g @codebakers/cli@latest 2>$null
} catch {
    Write-Host "Trying with elevated permissions..." -ForegroundColor Yellow
    Start-Process npm -ArgumentList "install -g @codebakers/cli@latest" -Wait -NoNewWindow
}

# Get new version
$newVersion = ""
try {
    $newVersion = (& codebakers --version 2>$null) -replace '\s+', ''
} catch {
    $newVersion = "latest"
}

if ($alreadyInstalled) {
    if ($currentVersion -eq $newVersion) {
        Write-Host "✓ Already on latest version (v$newVersion)" -ForegroundColor Green
    } else {
        Write-Host "✓ Updated from v$currentVersion to v$newVersion" -ForegroundColor Green
    }
} else {
    Write-Host "✓ CodeBakers CLI installed (v$newVersion)" -ForegroundColor Green
}
Write-Host ""

# Register MCP with Claude Code
Write-Host "Connecting to Claude Code..." -ForegroundColor Blue

try {
    $claudeExists = Get-Command claude -ErrorAction SilentlyContinue
    if ($claudeExists) {
        # Check if already registered
        $mcpList = & claude mcp list 2>$null
        if ($mcpList -match "codebakers") {
            Write-Host "✓ Already connected to Claude Code" -ForegroundColor Green
        } else {
            claude mcp add --transport stdio codebakers -- cmd /c "npx -y @codebakers/cli serve" 2>$null
            Write-Host "✓ Connected to Claude Code" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠ Claude Code not detected - will connect when you open it" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Could not auto-connect to Claude Code" -ForegroundColor Yellow
}
Write-Host ""

# Start trial and install patterns
if ($alreadyInstalled) {
    Write-Host "Refreshing patterns..." -ForegroundColor Blue
} else {
    Write-Host "Starting your free trial..." -ForegroundColor Blue
}
Write-Host ""

try {
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
if ($alreadyInstalled) {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ CodeBakers updated!                                   ║" -ForegroundColor Green
    Write-Host "║                                                           ║" -ForegroundColor Green
    Write-Host "║  You're all set. Happy building!                          ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
} else {
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✅ CodeBakers is ready!                                  ║" -ForegroundColor Green
    Write-Host "║                                                           ║" -ForegroundColor Green
    Write-Host "║  Open Claude Code and start building:                     ║" -ForegroundColor Green
    Write-Host '║  "Build me a todo app with authentication"               ║' -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
}
Write-Host ""
Write-Host "Note: Restart Claude Code to load CodeBakers patterns." -ForegroundColor Yellow
Write-Host ""
