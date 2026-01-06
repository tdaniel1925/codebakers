import * as vscode from 'vscode';

// Use dynamic imports to prevent ANY import errors from blocking command registration
let ChatPanelProvider: any;
let CodeBakersClient: any;
let ProjectContext: any;

let chatPanel: any;
let client: any;
let projectContext: any;
let statusBarItem: vscode.StatusBarItem | undefined;
let extensionContext: vscode.ExtensionContext;
let initializationError: string | null = null;

async function loadModules(): Promise<boolean> {
  try {
    console.log('CodeBakers: Loading ChatPanelProvider...');
    const chatModule = await import('./ChatPanelProvider');
    ChatPanelProvider = chatModule.ChatPanelProvider;
    console.log('CodeBakers: ChatPanelProvider loaded');

    console.log('CodeBakers: Loading CodeBakersClient...');
    const clientModule = await import('./CodeBakersClient');
    CodeBakersClient = clientModule.CodeBakersClient;
    console.log('CodeBakers: CodeBakersClient loaded');

    console.log('CodeBakers: Loading ProjectContext...');
    const contextModule = await import('./ProjectContext');
    ProjectContext = contextModule.ProjectContext;
    console.log('CodeBakers: ProjectContext loaded');

    console.log('CodeBakers: All modules loaded successfully');
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    const errorStack = error?.stack || '';
    console.error('CodeBakers: Failed to load modules:', errorMessage);
    console.error('CodeBakers: Stack:', errorStack);
    initializationError = `Module load failed: ${errorMessage}`;
    return false;
  }
}

async function ensureInitialized(): Promise<boolean> {
  if (client && projectContext && chatPanel) {
    console.log('CodeBakers: Already initialized');
    return true;
  }

  if (!ChatPanelProvider || !CodeBakersClient || !ProjectContext) {
    console.log('CodeBakers: Modules not loaded, loading now...');
    const loaded = await loadModules();
    if (!loaded) {
      vscode.window.showErrorMessage(`CodeBakers: ${initializationError}`);
      return false;
    }
  }

  try {
    console.log('CodeBakers: Initializing components...');

    if (!client) {
      console.log('CodeBakers: Creating CodeBakersClient...');
      client = new CodeBakersClient(extensionContext);
      console.log('CodeBakers: CodeBakersClient created successfully');
    }

    if (!projectContext) {
      console.log('CodeBakers: Creating ProjectContext...');
      projectContext = new ProjectContext();
      console.log('CodeBakers: ProjectContext created successfully');
    }

    if (!chatPanel) {
      console.log('CodeBakers: Creating ChatPanelProvider...');
      chatPanel = ChatPanelProvider.getInstance(extensionContext, client, projectContext);
      console.log('CodeBakers: ChatPanelProvider created successfully');
    }

    console.log('CodeBakers: All components initialized successfully');
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error('CodeBakers: Component initialization failed:', errorMessage);
    console.error('CodeBakers: Stack:', error?.stack || 'no stack');
    initializationError = `Init failed: ${errorMessage}`;
    vscode.window.showErrorMessage(`CodeBakers: ${initializationError}`);
    return false;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeBakers: activate() called - v1.0.42 (production ready: cancel button, TSC progress UI)');
  extensionContext = context;

  // IMMEDIATELY register commands - nothing can fail before this
  try {
    console.log('CodeBakers: Registering commands...');

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.openChat', async () => {
        console.log('CodeBakers: openChat command executed');

        const initialized = await ensureInitialized();
        if (!initialized) {
          vscode.window.showErrorMessage('CodeBakers failed to initialize. Please try reloading VS Code.');
          return;
        }

        try {
          if (!client.hasSessionToken()) {
            vscode.window.showWarningMessage(
              '🍪 Sign in to CodeBakers to start your free trial',
              'Sign In with GitHub'
            ).then((selection: string | undefined) => {
              if (selection === 'Sign In with GitHub') {
                client.login();
              }
            });
          }
          chatPanel.show();
        } catch (e) {
          console.error('CodeBakers: Error in openChat:', e);
          vscode.window.showErrorMessage(`CodeBakers error: ${e}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.login', async () => {
        console.log('CodeBakers: login command executed');
        const initialized = await ensureInitialized();
        if (!initialized) return;

        try {
          await client.login();
        } catch (e) {
          console.error('CodeBakers: Login error:', e);
          vscode.window.showErrorMessage(`Login failed: ${e}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.logout', async () => {
        console.log('CodeBakers: logout command executed');
        const initialized = await ensureInitialized();
        if (!initialized) return;

        try {
          await client.logout();
          chatPanel.refresh();
          updateStatusBar();
        } catch (e) {
          console.error('CodeBakers: Logout error:', e);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.showPatterns', async () => {
        const initialized = await ensureInitialized();
        if (!initialized) return;

        try {
          const patterns = await client.getAvailablePatterns();
          const quickPick = vscode.window.createQuickPick();
          quickPick.items = patterns.map((p: any) => ({ label: p.name, description: p.description }));
          quickPick.title = 'Available CodeBakers Patterns';
          quickPick.show();
        } catch (e) {
          console.error('CodeBakers: Error showing patterns:', e);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.runAudit', async () => {
        const initialized = await ensureInitialized();
        if (!initialized) return;

        try {
          chatPanel.show();
          await chatPanel.sendMessage('/audit');
        } catch (e) {
          console.error('CodeBakers: Error running audit:', e);
        }
      })
    );

    console.log('CodeBakers: All 5 commands registered successfully');

  } catch (error) {
    // This should NEVER happen since registerCommand is synchronous
    console.error('CodeBakers: FATAL - Command registration failed:', error);
    vscode.window.showErrorMessage(`CodeBakers FATAL: Failed to register commands - ${error}`);
    return;
  }

  // Create status bar
  try {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(code) CodeBakers';
    statusBarItem.tooltip = 'Open CodeBakers Chat (Ctrl+Alt+C)';
    statusBarItem.command = 'codebakers.openChat';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    console.log('CodeBakers: Status bar created');
  } catch (e) {
    console.error('CodeBakers: Status bar failed:', e);
  }

  // Register URI handler
  try {
    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri: async (uri) => {
          console.log('CodeBakers: URI callback received:', uri.toString());

          if (!uri.path.includes('callback')) return;

          const initialized = await ensureInitialized();
          if (!initialized) return;

          try {
            const params = new URLSearchParams(uri.query);
            const encodedToken = params.get('token');
            const error = params.get('error');

            if (error) {
              vscode.window.showErrorMessage(`Login failed: ${params.get('message') || error}`);
              return;
            }

            if (encodedToken) {
              const success = await client.handleOAuthCallback(encodedToken);
              if (success) {
                chatPanel.refresh();
                updateStatusBar();
                chatPanel.show();
              }
            } else {
              vscode.window.showErrorMessage('Login failed: No token received');
            }
          } catch (e) {
            console.error('CodeBakers: URI handler error:', e);
            vscode.window.showErrorMessage(`OAuth error: ${e}`);
          }
        }
      })
    );
    console.log('CodeBakers: URI handler registered');
  } catch (e) {
    console.error('CodeBakers: URI handler registration failed:', e);
  }

  // Background initialization
  setTimeout(async () => {
    try {
      const initialized = await ensureInitialized();
      if (initialized) {
        updateStatusBar();

        if (!client.hasSessionToken()) {
          vscode.window.showInformationMessage(
            '🍪 CodeBakers installed! Click the CodeBakers button in the status bar to get started.',
            'Sign In Now'
          ).then((selection: string | undefined) => {
            if (selection === 'Sign In Now') {
              client.login();
            }
          });
        }

        // File watcher
        try {
          const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,tsx,js,jsx}');
          watcher.onDidChange(() => projectContext?.invalidateCache());
          watcher.onDidCreate(() => projectContext?.invalidateCache());
          watcher.onDidDelete(() => projectContext?.invalidateCache());
          context.subscriptions.push(watcher);
        } catch (e) {
          console.warn('CodeBakers: File watcher failed:', e);
        }
      }
    } catch (e) {
      console.error('CodeBakers: Background init failed:', e);
    }
  }, 500);

  console.log('CodeBakers: activate() completed - v1.0.42');
}

function updateStatusBar() {
  if (!statusBarItem) return;

  try {
    if (client?.hasSessionToken()) {
      const planInfo = client.getPlanInfo();
      statusBarItem.text = `$(code) CodeBakers [${planInfo.plan}]`;
      statusBarItem.backgroundColor = undefined;
    } else {
      statusBarItem.text = '$(code) CodeBakers (Sign In)';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
  } catch (e) {
    statusBarItem.text = '$(code) CodeBakers';
  }
}

export function deactivate() {
  console.log('CodeBakers: deactivate() called');
}
