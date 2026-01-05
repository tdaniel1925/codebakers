import * as vscode from 'vscode';
import { ChatViewProvider } from './ChatViewProvider';
import { CodeBakersClient } from './CodeBakersClient';
import { ProjectContext } from './ProjectContext';

let chatProvider: ChatViewProvider;
let client: CodeBakersClient;
let projectContext: ProjectContext;

export async function activate(context: vscode.ExtensionContext) {
  console.log('CodeBakers extension activating...');

  // Initialize the CodeBakers API client
  client = new CodeBakersClient(context);

  // Initialize project context manager (for perfect recall)
  projectContext = new ProjectContext();

  // Create the chat view provider
  chatProvider = new ChatViewProvider(context, client, projectContext);

  // Register the webview provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'codebakers.chat',
      chatProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.openChat', () => {
      vscode.commands.executeCommand('codebakers.chat.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.login', async () => {
      await client.login();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.showPatterns', async () => {
      const patterns = await client.getAvailablePatterns();
      const quickPick = vscode.window.createQuickPick();
      quickPick.items = patterns.map(p => ({ label: p.name, description: p.description }));
      quickPick.title = 'Available CodeBakers Patterns';
      quickPick.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codebakers.runAudit', async () => {
      await chatProvider.sendMessage('/audit');
    })
  );

  // Check authentication on startup (non-blocking - don't await!)
  // Show login prompt immediately if no session token
  if (!client.hasSessionToken()) {
    vscode.window.showInformationMessage(
      'Welcome to CodeBakers! Sign in with GitHub to start your free trial.',
      'Sign In'
    ).then(selection => {
      if (selection === 'Sign In') {
        client.login();
      }
    });
  } else {
    // Validate token in background (don't block activation)
    client.checkAuth().then(isValid => {
      if (!isValid) {
        vscode.window.showInformationMessage(
          'Your CodeBakers session has expired. Please sign in again.',
          'Sign In'
        ).then(selection => {
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

export function deactivate() {
  console.log('CodeBakers extension deactivated');
}
