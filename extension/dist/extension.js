"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));

// src/PatternManager.ts
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var PatternManager = class {
  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";
    this.claudeMdPath = path.join(this.workspaceRoot, "CLAUDE.md");
    this.cursorRulesPath = path.join(this.workspaceRoot, ".cursorrules");
    this.claudeFolderPath = path.join(this.workspaceRoot, ".claude");
  }
  /**
   * Get current pattern status
   */
  getStatus() {
    const hasClaudeMd = fs.existsSync(this.claudeMdPath);
    const hasCursorRules = fs.existsSync(this.cursorRulesPath);
    const hasClaudeFolder = fs.existsSync(this.claudeFolderPath);
    let patternCount = 0;
    if (hasClaudeFolder) {
      try {
        const files = fs.readdirSync(this.claudeFolderPath);
        patternCount = files.filter((f) => f.endsWith(".md")).length;
      } catch (e) {
        console.error("Error reading .claude folder:", e);
      }
    }
    let lastUpdated = null;
    if (hasClaudeMd) {
      try {
        const stats = fs.statSync(this.claudeMdPath);
        lastUpdated = stats.mtime.toISOString();
      } catch (e) {
      }
    }
    let inSync = true;
    if (hasClaudeMd && hasCursorRules) {
      try {
        const claudeContent = fs.readFileSync(this.claudeMdPath, "utf-8");
        const cursorContent = fs.readFileSync(this.cursorRulesPath, "utf-8");
        inSync = claudeContent === cursorContent;
      } catch (e) {
        inSync = false;
      }
    } else if (hasClaudeMd !== hasCursorRules) {
      inSync = false;
    }
    return {
      hasClaudeMd,
      hasCursorRules,
      hasClaudeFolder,
      patternCount,
      lastUpdated,
      inSync
    };
  }
  /**
   * Sync CLAUDE.md to .cursorrules (or vice versa)
   */
  async syncPatternFiles() {
    try {
      const hasClaudeMd = fs.existsSync(this.claudeMdPath);
      const hasCursorRules = fs.existsSync(this.cursorRulesPath);
      if (hasClaudeMd && !hasCursorRules) {
        const content = fs.readFileSync(this.claudeMdPath, "utf-8");
        fs.writeFileSync(this.cursorRulesPath, content);
        vscode.window.showInformationMessage("Synced CLAUDE.md to .cursorrules");
        return true;
      }
      if (!hasClaudeMd && hasCursorRules) {
        const content = fs.readFileSync(this.cursorRulesPath, "utf-8");
        fs.writeFileSync(this.claudeMdPath, content);
        vscode.window.showInformationMessage("Synced .cursorrules to CLAUDE.md");
        return true;
      }
      if (hasClaudeMd && hasCursorRules) {
        const claudeContent = fs.readFileSync(this.claudeMdPath, "utf-8");
        const cursorContent = fs.readFileSync(this.cursorRulesPath, "utf-8");
        if (claudeContent !== cursorContent) {
          fs.writeFileSync(this.cursorRulesPath, claudeContent);
          vscode.window.showInformationMessage("Synced CLAUDE.md to .cursorrules");
          return true;
        } else {
          vscode.window.showInformationMessage("Pattern files already in sync");
          return true;
        }
      }
      vscode.window.showWarningMessage('No pattern files found. Run "CodeBakers: Initialize Patterns" first.');
      return false;
    } catch (error) {
      console.error("Error syncing pattern files:", error);
      vscode.window.showErrorMessage(`Failed to sync pattern files: ${error}`);
      return false;
    }
  }
  /**
   * Initialize patterns in the workspace (download from server or create defaults)
   */
  async initializePatterns(apiKey) {
    try {
      if (!fs.existsSync(this.claudeFolderPath)) {
        fs.mkdirSync(this.claudeFolderPath, { recursive: true });
      }
      if (apiKey) {
        const downloaded = await this.downloadPatterns(apiKey);
        if (downloaded) return true;
      }
      if (!fs.existsSync(this.claudeMdPath)) {
        const defaultContent = this.getDefaultClaudeMd();
        fs.writeFileSync(this.claudeMdPath, defaultContent);
      }
      await this.syncPatternFiles();
      vscode.window.showInformationMessage("CodeBakers patterns initialized!");
      return true;
    } catch (error) {
      console.error("Error initializing patterns:", error);
      vscode.window.showErrorMessage(`Failed to initialize patterns: ${error}`);
      return false;
    }
  }
  /**
   * Download patterns from CodeBakers server
   */
  async downloadPatterns(apiKey) {
    try {
      const response = await fetch("https://codebakers.ai/api/patterns/download", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      if (data.claudeMd) {
        fs.writeFileSync(this.claudeMdPath, data.claudeMd);
      }
      if (data.modules && Array.isArray(data.modules)) {
        for (const module2 of data.modules) {
          const modulePath = path.join(this.claudeFolderPath, module2.name);
          fs.writeFileSync(modulePath, module2.content);
        }
      }
      await this.syncPatternFiles();
      vscode.window.showInformationMessage(`Downloaded ${data.modules?.length || 0} pattern modules`);
      return true;
    } catch (error) {
      console.error("Error downloading patterns:", error);
      return false;
    }
  }
  /**
   * Update patterns from server
   */
  async updatePatterns(apiKey) {
    const downloaded = await this.downloadPatterns(apiKey);
    if (downloaded) {
      vscode.window.showInformationMessage("Patterns updated successfully!");
    } else {
      vscode.window.showWarningMessage("Failed to update patterns from server");
    }
    return downloaded;
  }
  /**
   * Open CLAUDE.md in editor
   */
  async openClaudeMd() {
    if (fs.existsSync(this.claudeMdPath)) {
      const doc = await vscode.workspace.openTextDocument(this.claudeMdPath);
      await vscode.window.showTextDocument(doc);
    } else {
      vscode.window.showWarningMessage('CLAUDE.md not found. Run "CodeBakers: Initialize Patterns" first.');
    }
  }
  /**
   * Get default CLAUDE.md content - v6.15 Short template
   * Rules at START and END for better AI attention
   */
  getDefaultClaudeMd() {
    return `# CodeBakers v6.15

## \u{1F6A8} ALWAYS DO THIS (Critical - Read First)
1. ALWAYS call \`project_status()\` FIRST \u2192 If works show "\u{1F36A} CodeBakers is working..." / If fails show "\u26A0\uFE0F Not connected"
2. ALWAYS call \`discover_patterns({ task: "..." })\` BEFORE writing any code
3. ALWAYS call \`validate_complete({ feature: "...", files: [...] })\` BEFORE saying "done"
4. ALWAYS show footer after code: \`\u{1F36A} **CodeBakers** | Patterns: X | TSC: \u2705 | Tests: \u2705\`

## \u274C NEVER DO THIS
1. NEVER write code without calling discover_patterns first
2. NEVER say "done" without validate_complete passing
3. NEVER show the success header without project_status succeeding first
4. NEVER skip writing tests for new features

## Quick Reference
\`\`\`
project_status()                                    \u2192 Verify connection FIRST
discover_patterns({ task: "what you're building" }) \u2192 Get patterns BEFORE code
validate_complete({ feature: "name", files: [...] }) \u2192 Validate BEFORE done
\`\`\`

Header (after project_status succeeds): \u{1F36A} CodeBakers is working on this...
Header (if project_status fails): \u26A0\uFE0F CodeBakers not connected - run: codebakers go
Footer (after code): \u{1F36A} **CodeBakers** | Patterns: X | TSC: \u2705 | Tests: \u2705

## \u{1F6A8} ALWAYS DO THIS (Critical - Repeated at End)
1. Call \`project_status()\` FIRST
2. Call \`discover_patterns()\` before code
3. Call \`validate_complete()\` before done
4. Show footer after code responses
`;
  }
  /**
   * Check pattern health and return warnings
   */
  checkPatternHealth() {
    const status = this.getStatus();
    const warnings = [];
    let score = 100;
    if (!status.hasClaudeMd) {
      warnings.push({
        severity: "critical",
        title: "No Pattern File",
        message: "CLAUDE.md not found. AI tools have no rules to follow.",
        action: "Initialize Patterns",
        actionCommand: "codebakers.initPatterns"
      });
      score -= 50;
    } else {
      try {
        const content = fs.readFileSync(this.claudeMdPath, "utf-8");
        if (content.trim().length < 100) {
          warnings.push({
            severity: "high",
            title: "Minimal Patterns",
            message: "CLAUDE.md is nearly empty. AI has very few rules to follow.",
            action: "Update Patterns",
            actionCommand: "codebakers.updatePatterns"
          });
          score -= 30;
        }
        const enforcementKeywords = [
          "MUST",
          "ALWAYS",
          "NEVER",
          "REQUIRED",
          "MANDATORY",
          "NOT ALLOWED",
          "NON-NEGOTIABLE"
        ];
        const hasEnforcementLanguage = enforcementKeywords.some(
          (kw) => content.toUpperCase().includes(kw)
        );
        if (!hasEnforcementLanguage) {
          warnings.push({
            severity: "medium",
            title: "Weak Enforcement Language",
            message: "CLAUDE.md lacks strong enforcement words (MUST, ALWAYS, NEVER). AI may ignore soft suggestions.",
            action: "Open CLAUDE.md",
            actionCommand: "codebakers.openClaudeMd"
          });
          score -= 15;
        }
        const hasGateEnforcement = content.includes("discover_patterns") || content.includes("validate_complete");
        if (!hasGateEnforcement) {
          warnings.push({
            severity: "medium",
            title: "No Gate Enforcement",
            message: "No MCP tool gates found. Consider adding discover_patterns and validate_complete.",
            action: "Update Patterns",
            actionCommand: "codebakers.updatePatterns"
          });
          score -= 10;
        }
        const hasPreCommitHook = content.includes("pre-commit") || content.includes("validate-codebakers");
        if (!hasPreCommitHook) {
          warnings.push({
            severity: "low",
            title: "No Pre-Commit Validation",
            message: "No pre-commit hook configured. Non-compliant code can be committed.",
            action: "Open CLAUDE.md",
            actionCommand: "codebakers.openClaudeMd"
          });
          score -= 5;
        }
      } catch (e) {
        console.error("Error reading CLAUDE.md:", e);
      }
    }
    if (!status.inSync && status.hasClaudeMd) {
      warnings.push({
        severity: "high",
        title: "Files Out of Sync",
        message: "CLAUDE.md and .cursorrules differ. One AI tool may have different rules.",
        action: "Sync Now",
        actionCommand: "codebakers.syncPatterns"
      });
      score -= 20;
    }
    if (!status.hasClaudeFolder || status.patternCount === 0) {
      warnings.push({
        severity: "medium",
        title: "No Pattern Modules",
        message: "No .claude/ folder or modules. Full CodeBakers patterns not installed.",
        action: "Update Patterns",
        actionCommand: "codebakers.updatePatterns"
      });
      score -= 10;
    }
    if (status.lastUpdated) {
      const lastUpdate = new Date(status.lastUpdated);
      const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1e3 * 60 * 60 * 24);
      if (daysSinceUpdate > 30) {
        warnings.push({
          severity: "low",
          title: "Patterns May Be Outdated",
          message: `Patterns last updated ${Math.floor(daysSinceUpdate)} days ago. Consider updating.`,
          action: "Update Patterns",
          actionCommand: "codebakers.updatePatterns"
        });
        score -= 5;
      }
    }
    score = Math.max(0, Math.min(100, score));
    let enforceability;
    if (score >= 80) {
      enforceability = "strong";
    } else if (score >= 60) {
      enforceability = "moderate";
    } else if (score >= 30) {
      enforceability = "weak";
    } else {
      enforceability = "none";
    }
    return { score, warnings, enforceability };
  }
  /**
   * Watch for pattern file changes
   */
  createFileWatcher() {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.workspaceRoot, "{CLAUDE.md,.cursorrules,.claude/**}")
    );
    watcher.onDidChange(() => {
      console.log("Pattern file changed");
    });
    watcher.onDidCreate(() => {
      console.log("Pattern file created");
    });
    watcher.onDidDelete(() => {
      console.log("Pattern file deleted");
    });
    return watcher;
  }
};

// src/StatusBarManager.ts
var vscode2 = __toESM(require("vscode"));
var StatusBarManager = class {
  constructor(patternManager2) {
    this.refreshInterval = null;
    this.lastHealth = null;
    this.warningShownThisSession = false;
    this.patternManager = patternManager2;
    this.statusBarItem = vscode2.window.createStatusBarItem(
      vscode2.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = "codebakers.showMenu";
    this.update();
    this.statusBarItem.show();
    this.refreshInterval = setInterval(() => this.update(), 3e4);
    setTimeout(() => this.checkAndShowWarnings(), 2e3);
  }
  /**
   * Update the status bar based on current pattern status
   */
  update() {
    const status = this.patternManager.getStatus();
    this.lastHealth = this.patternManager.checkPatternHealth();
    const health = this.lastHealth;
    let icon;
    let backgroundColor;
    if (health.enforceability === "none" || health.enforceability === "weak") {
      icon = "$(error)";
      backgroundColor = new vscode2.ThemeColor("statusBarItem.errorBackground");
    } else if (health.enforceability === "moderate") {
      icon = "$(warning)";
      backgroundColor = new vscode2.ThemeColor("statusBarItem.warningBackground");
    } else {
      icon = "$(check)";
      backgroundColor = void 0;
    }
    const moduleText = status.patternCount > 0 ? ` [${status.patternCount}]` : "";
    const scoreText = ` ${health.score}%`;
    this.statusBarItem.text = `${icon} CodeBakers${moduleText}${scoreText}`;
    this.statusBarItem.tooltip = this.buildHealthTooltip(status, health);
    this.statusBarItem.backgroundColor = backgroundColor;
  }
  /**
   * Build detailed tooltip with health info
   */
  buildHealthTooltip(status, health) {
    const severityIcons = {
      critical: "\u{1F534}",
      high: "\u{1F7E0}",
      medium: "\u{1F7E1}",
      low: "\u{1F535}"
    };
    const enforcementLabels = {
      strong: "\u2705 Strong - AI will likely follow rules",
      moderate: "\u26A0\uFE0F Moderate - AI may sometimes ignore rules",
      weak: "\u274C Weak - AI will likely ignore rules",
      none: "\u{1F6AB} None - No patterns to enforce"
    };
    const lines = [
      `CodeBakers Pattern Health: ${health.score}%`,
      "",
      enforcementLabels[health.enforceability],
      "",
      `CLAUDE.md: ${status.hasClaudeMd ? "\u2713" : "\u2717"}`,
      `.cursorrules: ${status.hasCursorRules ? "\u2713" : "\u2717"}`,
      `Modules: ${status.patternCount}`,
      `In sync: ${status.inSync ? "\u2713" : "\u2717"}`
    ];
    if (health.warnings.length > 0) {
      lines.push("", "--- Warnings ---");
      for (const warning of health.warnings.slice(0, 3)) {
        lines.push(`${severityIcons[warning.severity]} ${warning.title}`);
      }
      if (health.warnings.length > 3) {
        lines.push(`... and ${health.warnings.length - 3} more`);
      }
    }
    lines.push("", "Click for options");
    return lines.join("\n");
  }
  /**
   * Check health and show warnings if critical issues found
   */
  checkAndShowWarnings() {
    if (this.warningShownThisSession) return;
    const health = this.patternManager.checkPatternHealth();
    const criticalWarnings = health.warnings.filter((w) => w.severity === "critical" || w.severity === "high");
    if (criticalWarnings.length > 0) {
      this.warningShownThisSession = true;
      const firstWarning = criticalWarnings[0];
      const message = `CodeBakers: ${firstWarning.title} - ${firstWarning.message}`;
      if (firstWarning.action) {
        vscode2.window.showWarningMessage(message, firstWarning.action, "Show All Warnings").then((selection) => {
          if (selection === firstWarning.action && firstWarning.actionCommand) {
            vscode2.commands.executeCommand(firstWarning.actionCommand);
          } else if (selection === "Show All Warnings") {
            this.showWarnings();
          }
        });
      } else {
        vscode2.window.showWarningMessage(message, "Show All Warnings").then((selection) => {
          if (selection === "Show All Warnings") {
            this.showWarnings();
          }
        });
      }
    }
  }
  /**
   * Show all warnings in a detailed panel
   */
  async showWarnings() {
    const health = this.lastHealth || this.patternManager.checkPatternHealth();
    if (health.warnings.length === 0) {
      vscode2.window.showInformationMessage("No pattern warnings. Your setup looks good!");
      return;
    }
    const severityIcons = {
      critical: "\u{1F534} CRITICAL",
      high: "\u{1F7E0} HIGH",
      medium: "\u{1F7E1} MEDIUM",
      low: "\u{1F535} LOW"
    };
    const items = health.warnings.map((warning) => ({
      label: `${severityIcons[warning.severity]}: ${warning.title}`,
      description: warning.action || "",
      detail: warning.message
    }));
    items.unshift({
      label: `Pattern Health Score: ${health.score}%`,
      description: `Enforceability: ${health.enforceability}`,
      detail: `${health.warnings.length} issue(s) found`,
      kind: vscode2.QuickPickItemKind.Separator
    });
    const selected = await vscode2.window.showQuickPick(items, {
      placeHolder: "Pattern Warnings - Select to fix",
      title: `CodeBakers Pattern Health: ${health.score}%`
    });
    if (selected && selected.description) {
      const warning = health.warnings.find((w) => w.action === selected.description);
      if (warning?.actionCommand) {
        await vscode2.commands.executeCommand(warning.actionCommand);
      }
    }
  }
  /**
   * Show quick pick menu with options
   */
  async showMenu() {
    const status = this.patternManager.getStatus();
    const items = [];
    if (!status.hasClaudeMd) {
      items.push({
        label: "$(add) Initialize Patterns",
        description: "Create CLAUDE.md and .cursorrules"
      });
    }
    if (status.hasClaudeMd && !status.inSync) {
      items.push({
        label: "$(sync) Sync Pattern Files",
        description: "Sync CLAUDE.md to .cursorrules"
      });
    }
    if (status.hasClaudeMd) {
      items.push({
        label: "$(file) Open CLAUDE.md",
        description: "View and edit patterns"
      });
    }
    items.push({
      label: "$(cloud-download) Update Patterns",
      description: "Download latest patterns from server"
    });
    items.push({
      label: "$(refresh) Refresh Status",
      description: "Check pattern file status"
    });
    items.push({
      label: "$(info) Pattern Status",
      description: `${status.patternCount} modules loaded`
    });
    const health = this.lastHealth || this.patternManager.checkPatternHealth();
    if (health.warnings.length > 0) {
      items.unshift({
        label: `$(alert) Show Warnings (${health.warnings.length})`,
        description: `Health: ${health.score}% - ${health.enforceability} enforcement`
      });
    }
    const selected = await vscode2.window.showQuickPick(items, {
      placeHolder: "CodeBakers Options"
    });
    if (!selected) return;
    if (selected.label.startsWith("$(alert) Show Warnings")) {
      await this.showWarnings();
      return;
    }
    switch (selected.label) {
      case "$(add) Initialize Patterns":
        await vscode2.commands.executeCommand("codebakers.initPatterns");
        break;
      case "$(sync) Sync Pattern Files":
        await vscode2.commands.executeCommand("codebakers.syncPatterns");
        break;
      case "$(file) Open CLAUDE.md":
        await vscode2.commands.executeCommand("codebakers.openClaudeMd");
        break;
      case "$(cloud-download) Update Patterns":
        await vscode2.commands.executeCommand("codebakers.updatePatterns");
        break;
      case "$(refresh) Refresh Status":
        this.update();
        vscode2.window.showInformationMessage("Pattern status refreshed");
        break;
      case "$(info) Pattern Status":
        this.showStatusInfo();
        break;
    }
  }
  /**
   * Show detailed status info
   */
  showStatusInfo() {
    const status = this.patternManager.getStatus();
    const message = [
      `CLAUDE.md: ${status.hasClaudeMd ? "Found" : "Not found"}`,
      `.cursorrules: ${status.hasCursorRules ? "Found" : "Not found"}`,
      `Pattern modules: ${status.patternCount}`,
      `Files in sync: ${status.inSync ? "Yes" : "No"}`
    ].join(" | ");
    vscode2.window.showInformationMessage(message);
  }
  /**
   * Dispose of resources
   */
  dispose() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.statusBarItem.dispose();
  }
};

// src/extension.ts
var patternManager;
var statusBarManager;
var extensionContext;
function activate(context) {
  console.log("CodeBakers: activate() called - v2.0.0 (Pattern Manager)");
  extensionContext = context;
  patternManager = new PatternManager();
  statusBarManager = new StatusBarManager(patternManager);
  registerCommands(context);
  const watcher = patternManager.createFileWatcher();
  watcher.onDidChange(() => statusBarManager.update());
  watcher.onDidCreate(() => statusBarManager.update());
  watcher.onDidDelete(() => statusBarManager.update());
  context.subscriptions.push(watcher);
  context.subscriptions.push({
    dispose: () => statusBarManager.dispose()
  });
  const status = patternManager.getStatus();
  if (!status.hasClaudeMd && !status.hasCursorRules) {
    vscode3.window.showInformationMessage(
      "CodeBakers: No patterns found. Initialize patterns to enable AI rule enforcement.",
      "Initialize Patterns"
    ).then((selection) => {
      if (selection === "Initialize Patterns") {
        vscode3.commands.executeCommand("codebakers.initPatterns");
      }
    });
  } else if (!status.inSync) {
    vscode3.window.showInformationMessage(
      "CodeBakers: Pattern files are out of sync.",
      "Sync Now"
    ).then((selection) => {
      if (selection === "Sync Now") {
        vscode3.commands.executeCommand("codebakers.syncPatterns");
      }
    });
  }
  console.log("CodeBakers: Extension activated successfully");
}
function registerCommands(context) {
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.showMenu", () => {
      statusBarManager.showMenu();
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.initPatterns", async () => {
      await patternManager.initializePatterns();
      statusBarManager.update();
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.syncPatterns", async () => {
      await patternManager.syncPatternFiles();
      statusBarManager.update();
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.updatePatterns", async () => {
      const apiKey = await getApiKey();
      if (!apiKey) {
        vscode3.window.showWarningMessage(
          "API key required to download patterns. Get one at codebakers.ai",
          "Get API Key"
        ).then((selection) => {
          if (selection === "Get API Key") {
            vscode3.env.openExternal(vscode3.Uri.parse("https://codebakers.ai/dashboard"));
          }
        });
        return;
      }
      await patternManager.updatePatterns(apiKey);
      statusBarManager.update();
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.openClaudeMd", async () => {
      await patternManager.openClaudeMd();
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.refreshStatus", () => {
      statusBarManager.update();
      vscode3.window.showInformationMessage("CodeBakers: Status refreshed");
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.showWarnings", () => {
      statusBarManager.showWarnings();
    })
  );
  context.subscriptions.push(
    vscode3.commands.registerCommand("codebakers.openChat", () => {
      vscode3.window.showInformationMessage(
        "CodeBakers now works with Claude Code and Cursor directly! Your CLAUDE.md rules are automatically applied.",
        "Learn More"
      ).then((selection) => {
        if (selection === "Learn More") {
          vscode3.env.openExternal(vscode3.Uri.parse("https://codebakers.ai/docs/integration"));
        }
      });
    })
  );
  console.log("CodeBakers: All commands registered");
}
async function getApiKey() {
  const config = vscode3.workspace.getConfiguration("codebakers");
  let apiKey = config.get("apiKey");
  if (apiKey) {
    return apiKey;
  }
  apiKey = await extensionContext.secrets.get("codebakers.apiKey") || null;
  if (apiKey) {
    return apiKey;
  }
  const input = await vscode3.window.showInputBox({
    prompt: "Enter your CodeBakers API key (press Escape to skip and use default patterns)",
    placeHolder: "cb_xxxxxxxxxxxxxxxx (optional)",
    password: true,
    ignoreFocusOut: false
  });
  if (input) {
    await extensionContext.secrets.store("codebakers.apiKey", input);
    return input;
  }
  return null;
}
function deactivate() {
  console.log("CodeBakers: deactivate() called");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
