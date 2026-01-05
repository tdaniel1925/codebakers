"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ChatViewProvider_1 = require("./ChatViewProvider");
const CodeBakersClient_1 = require("./CodeBakersClient");
const ProjectContext_1 = require("./ProjectContext");
let chatProvider;
let client;
let projectContext;
async function activate(context) {
    console.log('CodeBakers extension activating...');
    // Initialize the CodeBakers API client
    client = new CodeBakersClient_1.CodeBakersClient(context);
    // Register global URI handler for OAuth callbacks
    // This must be registered at activation time, not just during login()
    context.subscriptions.push(vscode.window.registerUriHandler({
        handleUri: async (uri) => {
            console.log('CodeBakers: Received URI callback:', uri.toString());
            // Only handle our callback path
            if (!uri.path.includes('callback')) {
                return;
            }
            const params = new URLSearchParams(uri.query);
            const encodedToken = params.get('token');
            const error = params.get('error');
            if (error) {
                const message = params.get('message') || 'Login failed';
                vscode.window.showErrorMessage(`CodeBakers login failed: ${message}`);
                return;
            }
            if (encodedToken) {
                const success = await client.handleOAuthCallback(encodedToken);
                if (success) {
                    // Refresh the chat view if it exists
                    if (chatProvider) {
                        chatProvider.refresh();
                    }
                }
            }
            else {
                vscode.window.showErrorMessage('CodeBakers login failed: No token received');
            }
        }
    }));
    // Initialize project context manager (for perfect recall)
    projectContext = new ProjectContext_1.ProjectContext();
    // Create the chat view provider
    chatProvider = new ChatViewProvider_1.ChatViewProvider(context, client, projectContext);
    // Register the webview provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('codebakers.chat', chatProvider, {
        webviewOptions: {
            retainContextWhenHidden: true
        }
    }));
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('codebakers.openChat', () => {
        vscode.commands.executeCommand('codebakers.chat.focus');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('codebakers.login', async () => {
        await client.login();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('codebakers.logout', async () => {
        await client.logout();
        if (chatProvider) {
            chatProvider.refresh();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('codebakers.showPatterns', async () => {
        const patterns = await client.getAvailablePatterns();
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = patterns.map(p => ({ label: p.name, description: p.description }));
        quickPick.title = 'Available CodeBakers Patterns';
        quickPick.show();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('codebakers.runAudit', async () => {
        await chatProvider.sendMessage('/audit');
    }));
    // Check authentication on startup (non-blocking - don't await!)
    // Show login prompt immediately if no session token
    if (!client.hasSessionToken()) {
        vscode.window.showInformationMessage('Welcome to CodeBakers! Sign in with GitHub to start your free trial.', 'Sign In').then(selection => {
            if (selection === 'Sign In') {
                client.login();
            }
        });
    }
    else {
        // Validate token in background (don't block activation)
        client.checkAuth().then(isValid => {
            if (!isValid) {
                vscode.window.showInformationMessage('Your CodeBakers session has expired. Please sign in again.', 'Sign In').then(selection => {
                    if (selection === 'Sign In') {
                        client.login();
                    }
                });
            }
        }).catch(() => {
            // Auth check failed - user can try logging in manually
            console.warn('Auth check failed - network issue?');
        });
    }
    // Watch for file changes to update project context
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');
    watcher.onDidChange(() => projectContext.invalidateCache());
    watcher.onDidCreate(() => projectContext.invalidateCache());
    watcher.onDidDelete(() => projectContext.invalidateCache());
    context.subscriptions.push(watcher);
    console.log('CodeBakers extension activated!');
}
function deactivate() {
    console.log('CodeBakers extension deactivated');
}
//# sourceMappingURL=extension.js.map