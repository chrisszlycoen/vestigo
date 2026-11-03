import * as vscode from 'vscode';
import * as path from 'path';
import { currentStore } from './projectMemory';
import { formatMemory } from '../memory/context';

export function registerShowTimelineCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
        'vestigo.showTimeline',
        async (uri: vscode.Uri | undefined) => {
            try {
                const store = currentStore();
                const file = uri?.scheme === 'file' ? path.relative(store.root, uri.fsPath).replace(/\\/g, '/') : undefined;
                if (file) { store.safePath(file); }
                const records = store.list(true).filter((memory) => !file || memory.input.files.includes(file));
                const text = records.slice(0, 100).map((memory) =>
                    `${memory.capturedAt} · ${memory.id}\n${formatMemory(store.inspect(memory))}`).join('\n\n────────\n\n');
                const document = await vscode.workspace.openTextDocument({ language: 'plaintext',
                    content: text || 'No saved work history yet. Connect your AI or save a work checkpoint.' });
                await vscode.window.showTextDocument(document, { preview: true });
            } catch (err) { void vscode.window.showErrorMessage(`Vestigo: ${err instanceof Error ? err.message : 'Could not load history.'}`); }
        }
    );

    context.subscriptions.push(disposable);
}
