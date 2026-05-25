#!/usr/bin/env bash

# ==============================================================================
# 🦾 Vought AI — soldier Global Installer Script
# Installs 'soldier' CLI globally and configures persistent env variables
# ==============================================================================

# Define clean colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}=====================================================${NC}"
echo -e "${MAGENTA}   🦾 Vought AI — soldier CLI Global System Installer${NC}"
echo -e "${MAGENTA}=====================================================${NC}\n"

# 1. Check for Node & NPM
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js and NPM must be installed on your system to run the agent.${NC}"
    exit 1
fi

echo -e "${CYAN}📦 [1/3] Globally linking 'soldier' executable...${NC}"
cd "$(dirname "$0")" || exit 1

# Link packages/cli globally
if npm link --prefix packages/cli; then
    echo -e "${GREEN}✅ [Success]: Globally linked 'soldier' and 'soldier-boy' binaries!${NC}"
else
    echo -e "${YELLOW}⚠️  [Warning]: npm link completed with warning. Attempting explicit linking...${NC}"
    cd packages/cli && npm link && cd ../..
fi

# 2. Append permanent environment variables to bashrc/zshrc
echo -e "\n${CYAN}🔑 [2/3] Injecting persistent cloud configurations...${NC}"

LIVE_URL="https://black-noir-production.up.railway.app"
LIVE_KEY="bn_live_4f3c8a9e2d6b1a0f7e5d3c2b1a0f9e8d"

# Helper function to append if not present
inject_env() {
    local shell_config="$1"
    if [ -f "$shell_config" ]; then
        echo -e "${CYAN}Configuring ${shell_config}...${NC}"
        
        # Remove any previous API_BASE_URL or API_KEY lines to avoid duplicates
        sed -i '/export API_BASE_URL=/d' "$shell_config"
        sed -i '/export API_KEY=/d' "$shell_config"
        
        # Append clean variables
        echo -e "\n# Vought AI soldier-boy CLI Cloud configurations" >> "$shell_config"
        echo "export API_BASE_URL=\"$LIVE_URL\"" >> "$shell_config"
        echo "export API_KEY=\"$LIVE_KEY\"" >> "$shell_config"
        echo -e "${GREEN}✅ Configured variables in ${shell_config}!${NC}"
    fi
}

inject_env "$HOME/.bashrc"
inject_env "$HOME/.zshrc"

# 3. Complete Setup
echo -e "\n${CYAN}🚀 [3/3] Finalizing setup...${NC}"

# Source the configuration immediately in the active terminal to activate env variables
export API_BASE_URL="$LIVE_URL"
export API_KEY="$LIVE_KEY"

echo -e "${MAGENTA}=====================================================${NC}"
echo -e "${GREEN}🎉 INSTALLATION SUCCESSFUL!${NC}"
echo -e "You can now open any folder on your computer and type:"
echo -e "👉 ${YELLOW}soldier chat${NC}  (or ${YELLOW}soldier-boy chat${NC})"
echo -e "${MAGENTA}=====================================================${NC}"
echo -e "${CYAN}💡 Pro Tip: Run ${YELLOW}source ~/.bashrc${NC} (or ${YELLOW}source ~/.zshrc${NC}) to load the settings into other open tabs!${NC}\n"
