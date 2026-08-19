import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId, getWorkspaceRoot } from '../db/database';
import { createMemory } from '../db/queries';
import { relativeToWorkspace } from '../utils/pathUtils';
import { log } from '../utils/logger';

export function registerAddNoteCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('vestigo.addNote', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const workspaceRoot = getWorkspaceRoot();
        const workspaceId = getWorkspaceId();
        if (!workspaceRoot || !workspaceId) {
            vscode.window.showInformationMessage('Vestigo is not active in this workspace.');
            return;
        }

        const input = await vscode.window.showInputBox({
            prompt: 'Add a memory note for the current file',
            placeHolder: 'Why is this code here? What should the next developer know?',
            ignoreFocusOut: true,
        });

        if (!input || input.trim().length === 0) {
            return;
        }

        const filePath = relativeToWorkspace(editor.document.uri.fsPath, workspaceRoot);
        const position = editor.selection.active;

        try {
            const db = getDatabase();
            createMemory(db, {
                workspace_id: workspaceId,
                file_path: filePath,
                line_start: position.line + 1,
                content: input.trim(),
                source_type: 'manual',
            });
            log(`Manual note added for ${filePath}`);
            vscode.commands.executeCommand('vestigo.refreshSidebar');
        } catch (err) {
            log(`Failed to add note: ${err instanceof Error ? err.message : String(err)}`);
        }
    });

    context.subscriptions.push(disposable);
}
