import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId } from '../db/database';
import { countMemoriesForWorkspace } from '../db/queries';
import { log } from '../utils/logger';

const ONBOARDING_SHOWN_KEY = 'vestigo.onboardingShown';

export async function showOnboardingNotificationIfNeeded(
    context: vscode.ExtensionContext
): Promise<void> {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
        return;
    }

    const hasShown = context.workspaceState.get<boolean>(ONBOARDING_SHOWN_KEY, false);
    if (hasShown) {
        return;
    }

    try {
        const db = getDatabase();
        const count = countMemoriesForWorkspace(db, workspaceId);
        if (count === 0) {
            return;
        }

        const message = `Vestigo harvested ${count} memory${count === 1 ? '' : 'ies'} from your codebase. Open any file to see attached context.`;
        const selection = await vscode.window.showInformationMessage(
            message,
            { modal: false },
            'Show me →'
        );

        await context.workspaceState.update(ONBOARDING_SHOWN_KEY, true);

        if (selection === 'Show me →') {
            await vscode.commands.executeCommand('vestigo.memorySidebar.focus');
        }
    } catch (err) {
        log(`Failed to show onboarding notification: ${err instanceof Error ? err.message : String(err)}`);
    }
}
