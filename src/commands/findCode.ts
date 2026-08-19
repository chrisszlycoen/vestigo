import * as vscode from 'vscode';
import { log } from '../utils/logger';

export function registerFindCodeCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('vestigo.findCode', async () => {
        log('Find code command triggered (semantic search is a V1.5 feature)');
        vscode.window.showInformationMessage(
            'Vestigo semantic code search is coming in a future update.'
        );
    });

    context.subscriptions.push(disposable);
}
