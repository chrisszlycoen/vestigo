import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId, getWorkspaceRoot } from '../db/database';
import { getMemoriesForFile } from '../db/queries';
import { relativeToWorkspace } from '../utils/pathUtils';
import { log } from '../utils/logger';

let statusBarItem: vscode.StatusBarItem | undefined;

export function createStatusBarItem(context: vscode.ExtensionContext): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'vestigo.refreshSidebar';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
}

export function updateStatusBar(): void {
    if (!statusBarItem) {
        return;
    }

    const workspaceRoot = getWorkspaceRoot();
    const workspaceId = getWorkspaceId();
    if (!workspaceRoot || !workspaceId) {
        statusBarItem.hide();
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        statusBarItem.hide();
        return;
    }

    const filePath = relativeToWorkspace(editor.document.uri.fsPath, workspaceRoot);
    try {
        const db = getDatabase();
        const count = getMemoriesForFile(db, workspaceId, filePath).length;
        statusBarItem.text = `$(bookmark) ${count}`;
        statusBarItem.tooltip = `${count} memory${count === 1 ? '' : 'ies'} for ${filePath}`;
        statusBarItem.show();
    } catch (err) {
        log(`Failed to update status bar: ${err instanceof Error ? err.message : String(err)}`);
        statusBarItem.hide();
    }
}

export function disposeStatusBarItem(): void {
    statusBarItem?.dispose();
    statusBarItem = undefined;
}
