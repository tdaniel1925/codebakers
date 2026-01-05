import * as vscode from 'vscode';
import { CodeBakersClient } from './CodeBakersClient';
import { ProjectContext } from './ProjectContext';
export declare class ChatViewProvider implements vscode.WebviewViewProvider {
    private readonly context;
    private readonly client;
    private readonly projectContext;
    private _view?;
    private _messages;
    private _conversationSummary;
    constructor(context: vscode.ExtensionContext, client: CodeBakersClient, projectContext: ProjectContext);
    /**
     * Refresh the webview after login/logout
     */
    refresh(): void;
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private _initializeStatus;
    private _executeTool;
    sendMessage(userMessage: string): Promise<void>;
    private _buildContextualizedMessages;
    private _summarizeConversation;
    private _updateWebview;
    private _getHtmlForWebview;
}
//# sourceMappingURL=ChatViewProvider.d.ts.map