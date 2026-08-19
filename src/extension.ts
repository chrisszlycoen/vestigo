import * as vscode from 'vscode';
import { initializeDatabase } from './db/database';
import { registerAddNoteCommand } from './commands/addNote';
import { registerFindCodeCommand } from './commands/findCode';
import { registerSetGithubPatCommand } from './commands/setGithubPat';
import { registerShowTimelineCommand } from './commands/showTimeline';
import { initializeGitWatcher, disposeGitWatcher } from './git/gitWatcher';
import { MemorySidebarProvider } from './providers/memorySidebarProvider';
import { showOnboardingNotificationIfNeeded } from './providers/onboarding';
import { createStatusBarItem, disposeStatusBarItem, updateStatusBar } from './providers/statusBar';
import { ensureGitignoreEntry } from './utils/fileUtils';
import { log } from './utils/logger';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    log('Vestigo activating');

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        log('No workspace folder open; Vestigo will remain inactive.');
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    await initializeDatabase(workspaceRoot);
    ensureGitignoreEntry(workspaceRoot);

    const sidebarProvider = new MemorySidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            MemorySidebarProvider.viewType,
            sidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    createStatusBarItem(context);

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            sidebarProvider.refresh();
            updateStatusBar();
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            sidebarProvider.refresh();
            updateStatusBar();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vestigo.refreshSidebar', () => {
            sidebarProvider.refresh();
            updateStatusBar();
        })
    );

    registerAddNoteCommand(context);
    registerFindCodeCommand(context);
    registerSetGithubPatCommand(context);
    registerShowTimelineCommand(context);

    try {
        await initializeGitWatcher(context, workspaceRoot);
    } catch (err) {
        log(`Git watcher initialization failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    sidebarProvider.refresh();
    updateStatusBar();

    // Show one-time onboarding after first successful harvest.
    await showOnboardingNotificationIfNeeded(context);

    log('Vestigo activated');
}

export function deactivate(): void {
    disposeGitWatcher();
    disposeStatusBarItem();
    log('Vestigo deactivated');
}
