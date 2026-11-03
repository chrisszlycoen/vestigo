import * as vscode from 'vscode';
import { currentStore } from './projectMemory';
import { formatMemory } from '../memory/context';

export function registerFindCodeCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('vestigo.findCode', async () => {
        const query = await vscode.window.showInputBox({ prompt: 'What do you want to pick up or understand?',
            placeHolder: 'Password reset, payment decisions, unfinished work…' });
        if (!query?.trim()) { return; }
        try {
            const results = currentStore().search(query, undefined, 20);
            if (!results.length) { void vscode.window.showInformationMessage('No matching saved context yet. Connect your AI or save a checkpoint.'); return; }
            const choice = await vscode.window.showQuickPick(results.map((memory) => ({
                label: memory.input.summary, description: memory.input.kind, detail: memory.input.next, memory,
            })), { placeHolder: 'Choose a memory to see its evidence and next step', matchOnDetail: true });
            if (!choice) { return; }
            const document = await vscode.workspace.openTextDocument({ content: formatMemory(choice.memory), language: 'plaintext' });
            await vscode.window.showTextDocument(document, { preview: true });
        } catch (err) { void vscode.window.showErrorMessage(`Vestigo: ${err instanceof Error ? err.message : 'Could not search memory.'}`); }
    });

    context.subscriptions.push(disposable);
}
