import * as vscode from 'vscode';

// Use dynamic imports to prevent ANY import errors from blocking command registration
let ChatPanelProvider: any;
let CodeBakersClient: any;
let ProjectContext: any;
let DiffContentProvider: any;

let chatPanel: any;
let client: any;
let projectContext: any;
let statusBarItem: vscode.StatusBarItem | undefined;
let extensionContext: vscode.ExtensionContext;
let initializationError: string | null = null;

// Pair programming state
let pairProgrammingEnabled = true;
let suggestionDebounceTimer: NodeJS.Timeout | undefined;
let lastSuggestionTime = 0;
const SUGGESTION_DEBOUNCE_MS = 5000; // 5 seconds of inactivity
const SUGGESTION_COOLDOWN_MS = 60000; // 1 minute between suggestions

function loadPairProgrammingConfig(): void {
  const config = vscode.workspace.getConfiguration('codebakers');
  pairProgrammingEnabled = config.get<boolean>('pairProgramming', true);
}

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

    console.log('CodeBakers: Loading FileOperations...');
    const fileOpsModule = await import('./FileOperations');
    DiffContentProvider = fileOpsModule.DiffContentProvider;
    console.log('CodeBakers: FileOperations loaded');

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

interface PairSuggestion {
  type: 'error-handling' | 'testing' | 'optimization' | 'security' | 'pattern' | 'completion';
  message: string;
  actionLabel: string;
  prompt: string;
}

function analyzePairProgrammingSuggestion(document: vscode.TextDocument, changeRange?: vscode.Range): PairSuggestion | null {
  const text = document.getText();
  const languageId = document.languageId;
  const fileName = document.fileName;

  // Only suggest for code files
  if (!['typescript', 'typescriptreact', 'javascript', 'javascriptreact'].includes(languageId)) {
    return null;
  }

  // Analyze recent code for suggestion opportunities
  const lines = text.split('\n');
  const recentLines = changeRange
    ? lines.slice(Math.max(0, changeRange.start.line - 5), changeRange.end.line + 5).join('\n')
    : lines.slice(-30).join('\n');

  // Check for missing error handling in async functions
  if (recentLines.includes('async ') && !recentLines.includes('try') && !recentLines.includes('catch')) {
    return {
      type: 'error-handling',
      message: '💡 I noticed async code without error handling',
      actionLabel: 'Add try/catch',
      prompt: `Add proper error handling with try/catch to this async code:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  // Check for console.log that should be removed
  if (recentLines.includes('console.log') && fileName.includes('/src/')) {
    return {
      type: 'optimization',
      message: '💡 Consider removing console.log before production',
      actionLabel: 'Clean up logs',
      prompt: `Replace console.log statements with proper logging or remove them:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  // Check for any type usage
  if (recentLines.includes(': any') || recentLines.includes('<any>')) {
    return {
      type: 'pattern',
      message: '💡 Found "any" type - want me to add proper types?',
      actionLabel: 'Add types',
      prompt: `Replace the 'any' types with proper TypeScript types:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  // Check for TODO/FIXME comments
  if (recentLines.includes('TODO') || recentLines.includes('FIXME')) {
    return {
      type: 'completion',
      message: '💡 Found TODO/FIXME - want me to implement it?',
      actionLabel: 'Implement',
      prompt: `Implement the TODO/FIXME items in this code:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  // Check for missing null checks
  if ((recentLines.includes('.map(') || recentLines.includes('.filter(') || recentLines.includes('.find('))
      && !recentLines.includes('?.') && !recentLines.includes('|| []')) {
    return {
      type: 'error-handling',
      message: '💡 Array method without null safety - want me to add it?',
      actionLabel: 'Add null safety',
      prompt: `Add null safety to the array operations in this code:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  // Check for API routes without validation
  if ((fileName.includes('/api/') || fileName.includes('/route.ts'))
      && recentLines.includes('req.') && !recentLines.includes('zod') && !recentLines.includes('schema')) {
    return {
      type: 'security',
      message: '💡 API route without input validation detected',
      actionLabel: 'Add Zod validation',
      prompt: `Add Zod schema validation to this API route:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  // Check for component without loading state
  if (recentLines.includes('useState') && recentLines.includes('fetch') && !recentLines.includes('loading') && !recentLines.includes('isLoading')) {
    return {
      type: 'pattern',
      message: '💡 Component with fetch but no loading state',
      actionLabel: 'Add loading state',
      prompt: `Add a loading state to handle the async fetch in this component:\n\n\`\`\`${languageId}\n${recentLines}\n\`\`\``
    };
  }

  return null;
}

async function showPairProgrammingSuggestion(document: vscode.TextDocument, changeRange?: vscode.Range): Promise<void> {
  if (!pairProgrammingEnabled) return;

  const now = Date.now();
  if (now - lastSuggestionTime < SUGGESTION_COOLDOWN_MS) return;

  const suggestion = analyzePairProgrammingSuggestion(document, changeRange);
  if (!suggestion) return;

  const initialized = await ensureInitialized();
  if (!initialized) return;

  lastSuggestionTime = now;

  const selection = await vscode.window.showInformationMessage(
    `🤖 Pair Programming: ${suggestion.message}`,
    suggestion.actionLabel,
    'Dismiss',
    'Disable suggestions'
  );

  if (selection === suggestion.actionLabel) {
    chatPanel.show();
    await chatPanel.sendMessage(suggestion.prompt);
  } else if (selection === 'Disable suggestions') {
    pairProgrammingEnabled = false;
    vscode.window.showInformationMessage('Pair programming suggestions disabled. Run "CodeBakers: Toggle Pair Programming" to re-enable.');
  }
}

function debouncePairProgrammingSuggestion(document: vscode.TextDocument, changeRange?: vscode.Range): void {
  if (suggestionDebounceTimer) {
    clearTimeout(suggestionDebounceTimer);
  }

  suggestionDebounceTimer = setTimeout(() => {
    showPairProgrammingSuggestion(document, changeRange);
  }, SUGGESTION_DEBOUNCE_MS);
}

async function handleSelectionCommand(action: 'ask' | 'explain' | 'refactor' | 'tests'): Promise<void> {
  const initialized = await ensureInitialized();
  if (!initialized) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('No text selected');
    return;
  }

  const selectedText = editor.document.getText(selection);
  const fileName = editor.document.fileName;
  const relativePath = vscode.workspace.asRelativePath(fileName);
  const languageId = editor.document.languageId;
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;

  // Build the prompt based on action
  let prompt = '';
  switch (action) {
    case 'ask':
      prompt = `I have a question about this code from ${relativePath} (lines ${startLine}-${endLine}):\n\n\`\`\`${languageId}\n${selectedText}\n\`\`\`\n\n`;
      break;
    case 'explain':
      prompt = `Please explain this code from ${relativePath} (lines ${startLine}-${endLine}):\n\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;
      break;
    case 'refactor':
      prompt = `Please refactor this code from ${relativePath} (lines ${startLine}-${endLine}) to improve readability, performance, or follow best practices:\n\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;
      break;
    case 'tests':
      prompt = `Please write tests for this code from ${relativePath} (lines ${startLine}-${endLine}):\n\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;
      break;
  }

  try {
    chatPanel.show();
    // Send the selection context to the chat panel
    if (action === 'ask') {
      // For "ask", pre-fill the input but don't send yet
      chatPanel.setInputWithContext(prompt);
    } else {
      // For other actions, send immediately
      await chatPanel.sendMessage(prompt);
    }
  } catch (e) {
    console.error('CodeBakers: Error handling selection command:', e);
    vscode.window.showErrorMessage(`CodeBakers error: ${e}`);
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
  console.log('CodeBakers: activate() called - v1.0.60 (pair programming)');
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

    // Editor selection context menu commands
    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.askAboutSelection', async () => {
        console.log('CodeBakers: askAboutSelection command executed');
        await handleSelectionCommand('ask');
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.explainSelection', async () => {
        console.log('CodeBakers: explainSelection command executed');
        await handleSelectionCommand('explain');
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.refactorSelection', async () => {
        console.log('CodeBakers: refactorSelection command executed');
        await handleSelectionCommand('refactor');
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.addTestsForSelection', async () => {
        console.log('CodeBakers: addTestsForSelection command executed');
        await handleSelectionCommand('tests');
      })
    );

    // Pair programming toggle command
    context.subscriptions.push(
      vscode.commands.registerCommand('codebakers.togglePairProgramming', () => {
        pairProgrammingEnabled = !pairProgrammingEnabled;
        const status = pairProgrammingEnabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`🤖 Pair Programming suggestions ${status}`);
        console.log(`CodeBakers: Pair programming ${status}`);
      })
    );

    console.log('CodeBakers: All 10 commands registered successfully');

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

  // Register diff content provider for showing file diffs
  try {
    if (DiffContentProvider) {
      const diffProvider = new DiffContentProvider();
      context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('codebakers-diff', diffProvider)
      );
      console.log('CodeBakers: Diff content provider registered');
    }
  } catch (e) {
    console.error('CodeBakers: Diff provider registration failed:', e);
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

        // Load pair programming config and watch for changes
        loadPairProgrammingConfig();
        context.subscriptions.push(
          vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('codebakers.pairProgramming')) {
              loadPairProgrammingConfig();
              console.log(`CodeBakers: Pair programming config changed to ${pairProgrammingEnabled}`);
            }
          })
        );

        // Real-time pair programming: watch for document changes
        try {
          const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
            // Only trigger for code files with actual content changes
            if (event.contentChanges.length === 0) return;

            const doc = event.document;
            if (doc.uri.scheme !== 'file') return;

            // Get the range of the first change for context
            const firstChange = event.contentChanges[0];
            const changeRange = new vscode.Range(
              firstChange.range.start,
              doc.positionAt(doc.offsetAt(firstChange.range.start) + firstChange.text.length)
            );

            debouncePairProgrammingSuggestion(doc, changeRange);
          });
          context.subscriptions.push(changeListener);
          console.log('CodeBakers: Pair programming document listener registered');
        } catch (e) {
          console.warn('CodeBakers: Pair programming listener failed:', e);
        }
      }
    } catch (e) {
      console.error('CodeBakers: Background init failed:', e);
    }
  }, 500);

  console.log('CodeBakers: activate() completed - v1.0.60');
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
