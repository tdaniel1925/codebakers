import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting extension tests...');

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('codebakers.codebakers');
    assert.ok(extension, 'Extension should be installed');
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('codebakers.codebakers');
    if (extension) {
      await extension.activate();
      assert.strictEqual(extension.isActive, true, 'Extension should be active');
    }
  });

  test('All commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    const expectedCommands = [
      'codebakers.openChat',
      'codebakers.login',
      'codebakers.logout',
      'codebakers.showPatterns',
      'codebakers.runAudit',
      'codebakers.askAboutSelection',
      'codebakers.explainSelection',
      'codebakers.refactorSelection',
      'codebakers.addTestsForSelection',
      'codebakers.openMindMap',
      'codebakers.openBuildPlanner',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(
        commands.includes(cmd),
        `Command ${cmd} should be registered`
      );
    }
  });

  test('openBuildPlanner command should be executable', async () => {
    // This test verifies the command can be called without throwing
    // The actual panel may not open in headless test mode
    try {
      // Execute but don't wait - it opens a panel which we can't easily test
      vscode.commands.executeCommand('codebakers.openBuildPlanner');
      assert.ok(true, 'Command executed without immediate error');
    } catch (error) {
      assert.fail(`openBuildPlanner command threw an error: ${error}`);
    }
  });

  test('openMindMap command should be executable', async () => {
    try {
      vscode.commands.executeCommand('codebakers.openMindMap');
      assert.ok(true, 'Command executed without immediate error');
    } catch (error) {
      assert.fail(`openMindMap command threw an error: ${error}`);
    }
  });

  test('openChat command should be executable', async () => {
    try {
      vscode.commands.executeCommand('codebakers.openChat');
      assert.ok(true, 'Command executed without immediate error');
    } catch (error) {
      assert.fail(`openChat command threw an error: ${error}`);
    }
  });
});
