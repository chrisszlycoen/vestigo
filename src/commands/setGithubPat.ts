import * as vscode from 'vscode';
import { GITHUB_PAT_SECRET_KEY } from '../utils/constants';
import { log } from '../utils/logger';

export function registerSetGithubPatCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand('vestigo.setGithubPat', async () => {
        const token = await vscode.window.showInputBox({
            prompt: 'Enter your GitHub personal access token',
            placeHolder: 'ghp_...',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Token cannot be empty';
                }
                return undefined;
            },
        });

        if (!token) {
            return;
        }

        await context.secrets.store(GITHUB_PAT_SECRET_KEY, token.trim());
        log('GitHub PAT stored in SecretStorage');
        vscode.window.showInformationMessage('Vestigo: GitHub token saved securely.');
    });

    context.subscriptions.push(disposable);
}
