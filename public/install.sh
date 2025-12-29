#!/bin/bash

# CodeBakers One-Line Installer for Mac/Linux
# Usage: curl -fsSL https://codebakers.ai/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo ""
echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                           ║${NC}"
echo -e "${RED}║   ${NC}${BLUE}CodeBakers${NC} - One-Click Install                        ${RED}║${NC}"
echo -e "${RED}║                                                           ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Node.js
echo -e "${BLUE}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed.${NC}"
    echo ""
    echo "Please install Node.js first:"
    echo "  - Mac: brew install node"
    echo "  - Linux: https://nodejs.org/en/download"
    echo ""
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${YELLOW}Warning: Node.js 18+ recommended. You have $(node -v)${NC}"
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) found${NC}"
echo -e "${GREEN}✓ npm $(npm -v) found${NC}"
echo ""

# Check if CodeBakers is already installed
ALREADY_INSTALLED=false
CURRENT_VERSION=""
if command -v codebakers &> /dev/null; then
    ALREADY_INSTALLED=true
    CURRENT_VERSION=$(codebakers --version 2>/dev/null || echo "unknown")
    echo -e "${YELLOW}CodeBakers is already installed (v${CURRENT_VERSION})${NC}"
    echo -e "${BLUE}Updating to latest version...${NC}"
else
    echo -e "${BLUE}Installing CodeBakers CLI...${NC}"
fi

# Install/Update CodeBakers CLI
npm install -g @codebakers/cli@latest --silent 2>/dev/null || npm install -g @codebakers/cli@latest

NEW_VERSION=$(codebakers --version 2>/dev/null || echo "latest")
if [ "$ALREADY_INSTALLED" = true ]; then
    if [ "$CURRENT_VERSION" = "$NEW_VERSION" ]; then
        echo -e "${GREEN}✓ Already on latest version (v${NEW_VERSION})${NC}"
    else
        echo -e "${GREEN}✓ Updated from v${CURRENT_VERSION} to v${NEW_VERSION}${NC}"
    fi
else
    echo -e "${GREEN}✓ CodeBakers CLI installed (v${NEW_VERSION})${NC}"
fi
echo ""

# Register MCP with Claude Code
echo -e "${BLUE}Connecting to Claude Code...${NC}"

if command -v claude &> /dev/null; then
    # Check if already registered
    if claude mcp list 2>/dev/null | grep -q "codebakers"; then
        echo -e "${GREEN}✓ Already connected to Claude Code${NC}"
    else
        claude mcp add --transport stdio codebakers -- npx -y @codebakers/cli serve 2>/dev/null || true
        echo -e "${GREEN}✓ Connected to Claude Code${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Claude Code not detected - will connect when you open it${NC}"
fi
echo ""

echo ""
if [ "$ALREADY_INSTALLED" = true ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ CodeBakers updated!                                   ║${NC}"
    echo -e "${GREEN}║                                                           ║${NC}"
    echo -e "${GREEN}║  You're all set. Happy building!                          ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ CodeBakers CLI installed!                             ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo ""
    echo -e "  ${WHITE}1.${NC} Go to your project folder:"
    echo -e "     ${YELLOW}cd your-project${NC}"
    echo ""
    echo -e "  ${WHITE}2.${NC} Start your free trial and install patterns:"
    echo -e "     ${YELLOW}codebakers go${NC}"
    echo ""
    echo -e "  ${WHITE}3.${NC} Open Claude Code and start building!"
    echo -e "     ${YELLOW}\"Build me a todo app with authentication\"${NC}"
fi
echo ""
