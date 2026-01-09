import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface FileChange {
  path: string;
  action: 'create' | 'edit' | 'delete';
  content?: string;
  description?: string;
}

export interface CommandToRun {
  command: string;
  description?: string;
}

export interface OperationResult {
  success: boolean;
  error?: string;
  backup?: FileBackup;
}

export interface FileBackup {
  path: string;
  originalContent: string | null; // null if file didn't exist
  timestamp: number;
}

export class FileOperations {
  private workspaceRoot: string | undefined;
  private _backups: Map<string, FileBackup> = new Map();
  private _operationLock: Set<string> = new Set(); // Prevent concurrent operations on same file

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Check if a file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    try {
      const fullPath = path.join(this.workspaceRoot, relativePath);
      await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a lock on a file path to prevent concurrent operations
   */
  private async acquireLock(relativePath: string, timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (this._operationLock.has(relativePath)) {
      if (Date.now() - startTime > timeoutMs) {
        console.error(`FileOperations: Timeout waiting for lock on ${relativePath}`);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    this._operationLock.add(relativePath);
    return true;
  }

  private releaseLock(relativePath: string): void {
    this._operationLock.delete(relativePath);
  }

  /**
   * Create a backup of a file before modifying it
   */
  private async createBackup(relativePath: string): Promise<FileBackup> {
    const content = await this.readFile(relativePath);
    const backup: FileBackup = {
      path: relativePath,
      originalContent: content,
      timestamp: Date.now()
    };
    this._backups.set(relativePath, backup);
    return backup;
  }

  /**
   * Restore a file from backup
   */
  async restoreFromBackup(relativePath: string): Promise<boolean> {
    const backup = this._backups.get(relativePath);
    if (!backup) {
      vscode.window.showWarningMessage(`No backup found for ${relativePath}`);
      return false;
    }

    try {
      if (backup.originalContent === null) {
        // File didn't exist before - delete it
        await this.deleteFile(relativePath);
      } else {
        // Restore original content
        await this.writeFile(relativePath, backup.originalContent);
      }
      this._backups.delete(relativePath);
      vscode.window.showInformationMessage(`✅ Restored ${relativePath}`);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to restore ${relativePath}: ${error}`);
      return false;
    }
  }

  /**
   * Get all available backups
   */
  getBackups(): FileBackup[] {
    return Array.from(this._backups.values());
  }

  /**
   * Clear old backups (older than 1 hour)
   */
  cleanupOldBackups(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [path, backup] of this._backups) {
      if (backup.timestamp < oneHourAgo) {
        this._backups.delete(path);
      }
    }
  }

  /**
   * Read a file from the workspace
   */
  async readFile(relativePath: string): Promise<string | null> {
    if (!this.workspaceRoot) return null;

    try {
      const fullPath = path.join(this.workspaceRoot, relativePath);
      const uri = vscode.Uri.file(fullPath);
      const content = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(content).toString('utf-8');
    } catch (error) {
      console.error(`Failed to read file ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(relativePath: string, content: string): Promise<boolean> {
    if (!this.workspaceRoot) {
      vscode.window.showErrorMessage('No workspace folder open');
      return false;
    }

    try {
      const fullPath = path.join(this.workspaceRoot, relativePath);
      const uri = vscode.Uri.file(fullPath);

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
      return true;
    } catch (error) {
      console.error(`Failed to write file ${relativePath}:`, error);
      vscode.window.showErrorMessage(`Failed to write ${relativePath}: ${error}`);
      return false;
    }
  }

  /**
   * Delete a file with proper error handling
   */
  async deleteFile(relativePath: string): Promise<boolean> {
    if (!this.workspaceRoot) {
      console.error('FileOperations: No workspace root');
      return false;
    }

    try {
      const fullPath = path.join(this.workspaceRoot, relativePath);
      const uri = vscode.Uri.file(fullPath);

      // Check if file exists first
      const exists = await this.fileExists(relativePath);
      if (!exists) {
        console.log(`FileOperations: File ${relativePath} doesn't exist, treating as success`);
        return true; // File doesn't exist - that's fine, we wanted it gone anyway
      }

      await vscode.workspace.fs.delete(uri);
      console.log(`FileOperations: Deleted ${relativePath}`);
      return true;
    } catch (error: any) {
      // Handle "file not found" as success (already deleted)
      if (error?.code === 'FileNotFound' || error?.code === 'ENOENT') {
        console.log(`FileOperations: File ${relativePath} already deleted`);
        return true;
      }
      console.error(`FileOperations: Failed to delete ${relativePath}:`, error);
      vscode.window.showErrorMessage(`Failed to delete ${relativePath}: ${error.message || error}`);
      return false;
    }
  }

  /**
   * Show diff between current file and proposed content
   */
  async showDiff(relativePath: string, newContent: string, title?: string): Promise<void> {
    if (!this.workspaceRoot) return;

    const fullPath = path.join(this.workspaceRoot, relativePath);
    const originalUri = vscode.Uri.file(fullPath);

    // Create a virtual document for the new content
    const newUri = vscode.Uri.parse(`codebakers-diff:${relativePath}?content=${encodeURIComponent(newContent)}`);

    const diffTitle = title || `CodeBakers: ${relativePath}`;

    await vscode.commands.executeCommand('vscode.diff', originalUri, newUri, diffTitle);
  }

  /**
   * Apply a single file change with locking and backup
   */
  async applyChange(change: FileChange): Promise<boolean> {
    // Acquire lock to prevent concurrent operations on same file
    const lockAcquired = await this.acquireLock(change.path);
    if (!lockAcquired) {
      vscode.window.showErrorMessage(`Cannot modify ${change.path} - another operation is in progress`);
      return false;
    }

    try {
      // Create backup before any modification
      if (change.action === 'edit' || change.action === 'delete') {
        await this.createBackup(change.path);
      }

      switch (change.action) {
        case 'create':
          if (!change.content) {
            vscode.window.showErrorMessage(`Cannot create ${change.path} - no content provided`);
            return false;
          }
          // Check if file already exists
          const existsForCreate = await this.fileExists(change.path);
          if (existsForCreate) {
            // It's actually an edit, create backup
            await this.createBackup(change.path);
          }
          return this.writeFile(change.path, change.content);

        case 'edit':
          if (!change.content) {
            vscode.window.showErrorMessage(`Cannot edit ${change.path} - no content provided`);
            return false;
          }
          // Check if file exists
          const existsForEdit = await this.fileExists(change.path);
          if (!existsForEdit) {
            console.log(`FileOperations: File ${change.path} doesn't exist, creating instead of editing`);
          }
          return this.writeFile(change.path, change.content);

        case 'delete':
          return this.deleteFile(change.path);

        default:
          vscode.window.showErrorMessage(`Unknown action: ${(change as any).action}`);
          return false;
      }
    } finally {
      // Always release the lock
      this.releaseLock(change.path);
    }
  }

  /**
   * Apply multiple file changes
   */
  async applyChanges(changes: FileChange[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const change of changes) {
      const result = await this.applyChange(change);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Run a command in the integrated terminal
   * Automatically converts bash-style && to PowerShell-compatible ; on Windows
   */
  async runCommand(command: string, name?: string): Promise<void> {
    // Convert bash-style && to PowerShell-compatible ; on Windows
    let processedCommand = command;
    if (process.platform === 'win32') {
      // Replace && with ; for PowerShell compatibility
      processedCommand = command.replace(/\s*&&\s*/g, '; ');
    }

    const terminal = vscode.window.createTerminal({
      name: name || 'CodeBakers',
      cwd: this.workspaceRoot
    });

    terminal.show();
    terminal.sendText(processedCommand);
  }

  /**
   * Run a command and capture output (for quick commands)
   * Automatically converts bash-style && to PowerShell-compatible ; on Windows
   */
  async runCommandWithOutput(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');

      // Convert bash-style && to PowerShell-compatible ; on Windows
      let processedCommand = command;
      if (process.platform === 'win32') {
        processedCommand = command.replace(/\s*&&\s*/g, '; ');
      }

      exec(processedCommand, { cwd: this.workspaceRoot, timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(new Error(stderr || error.message));
        } else {
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Get list of files in workspace matching a pattern
   */
  async findFiles(pattern: string, exclude?: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(pattern, exclude || '**/node_modules/**');
    return files.map(f => vscode.workspace.asRelativePath(f));
  }

  /**
   * Open a file in the editor
   */
  async openFile(relativePath: string, selection?: { line: number; column?: number }): Promise<void> {
    if (!this.workspaceRoot) return;

    const fullPath = path.join(this.workspaceRoot, relativePath);
    const uri = vscode.Uri.file(fullPath);
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    if (selection) {
      const pos = new vscode.Position(selection.line - 1, (selection.column || 1) - 1);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
  }

  /**
   * Get the currently open file content and path
   */
  getCurrentFile(): { path: string; content: string; selection?: string } | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;

    const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
    const content = editor.document.getText();
    const selection = editor.selection.isEmpty ? undefined : editor.document.getText(editor.selection);

    return { path: relativePath, content, selection };
  }

  /**
   * Get workspace file tree (top-level structure)
   */
  async getFileTree(maxDepth: number = 2): Promise<string[]> {
    const files: string[] = [];

    const addFiles = async (dir: string, depth: number) => {
      if (depth > maxDepth) return;

      const pattern = new vscode.RelativePattern(dir, '*');
      const entries = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);

      for (const entry of entries) {
        const relativePath = vscode.workspace.asRelativePath(entry);
        files.push(relativePath);
      }
    };

    if (this.workspaceRoot) {
      await addFiles(this.workspaceRoot, 0);
    }

    return files.sort();
  }
}

// Virtual document provider for diff view
export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  provideTextDocumentContent(uri: vscode.Uri): string {
    const params = new URLSearchParams(uri.query);
    const content = params.get('content');
    return content ? decodeURIComponent(content) : '';
  }
}
