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

export class FileOperations {
  private workspaceRoot: string | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
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
   * Delete a file
   */
  async deleteFile(relativePath: string): Promise<boolean> {
    if (!this.workspaceRoot) return false;

    try {
      const fullPath = path.join(this.workspaceRoot, relativePath);
      const uri = vscode.Uri.file(fullPath);
      await vscode.workspace.fs.delete(uri);
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${relativePath}:`, error);
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
   * Apply a single file change
   */
  async applyChange(change: FileChange): Promise<boolean> {
    switch (change.action) {
      case 'create':
      case 'edit':
        if (!change.content) return false;
        return this.writeFile(change.path, change.content);
      case 'delete':
        return this.deleteFile(change.path);
      default:
        return false;
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
   */
  async runCommand(command: string, name?: string): Promise<void> {
    const terminal = vscode.window.createTerminal({
      name: name || 'CodeBakers',
      cwd: this.workspaceRoot
    });

    terminal.show();
    terminal.sendText(command);
  }

  /**
   * Run a command and capture output (for quick commands)
   */
  async runCommandWithOutput(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');

      exec(command, { cwd: this.workspaceRoot, timeout: 30000 }, (error: any, stdout: string, stderr: string) => {
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
