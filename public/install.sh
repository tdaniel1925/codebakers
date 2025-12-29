#!/bin/bash

# CodeBakers One-Line Installer for Mac/Linux
# Usage: curl -fsSL https://codebakers.ai/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Install CodeBakers CLI
echo -e "${BLUE}Installing CodeBakers CLI...${NC}"
npm install -g @codebakers/cli@latest --silent 2>/dev/null || npm install -g @codebakers/cli@latest

echo -e "${GREEN}✓ CodeBakers CLI installed${NC}"
echo ""

# Register MCP with Claude Code
echo -e "${BLUE}Connecting to Claude Code...${NC}"

# Check if claude command exists
if command -v claude &> /dev/null; then
    claude mcp add --transport stdio codebakers -- npx -y @codebakers/cli serve 2>/dev/null || true
    echo -e "${GREEN}✓ Connected to Claude Code${NC}"
else
    echo -e "${YELLOW}⚠ Claude Code not detected - will connect when you open it${NC}"
fi
echo ""

# Start trial and install patterns
echo -e "${BLUE}Starting your free trial...${NC}"
echo ""

# Run codebakers go to start trial
cd "${PWD}"
codebakers go --non-interactive 2>/dev/null || npx @codebakers/cli go --non-interactive 2>/dev/null || {
    # If --non-interactive fails, try without it
    echo -e "${YELLOW}Running interactive setup...${NC}"
    codebakers go 2>/dev/null || npx @codebakers/cli go
}

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ CodeBakers is ready!                                  ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  Open Claude Code and start building:                     ║${NC}"
echo -e "${GREEN}║  \"Build me a todo app with authentication\"               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Note: Restart Claude Code to load CodeBakers patterns.${NC}"
echo ""
