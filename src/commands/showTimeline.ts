import * as vscode from 'vscode';
import { log } from '../utils/logger';

export function registerShowTimelineCommand(context: vscode.ExtensionContext): void {
    const disposable = vscode.commands.registerCommand(
        'vestigo.showTimeline',
        async (_uri: vscode.Uri | undefined) => {
            log('Show timeline command triggered (timeline is a V1.1 feature)');
            vscode.window.showInformationMessage(
                'Vestigo timeline view is coming in a future update.'
            );
        }
    );

    context.subscriptions.push(disposable);
}
