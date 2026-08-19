import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId, getWorkspaceRoot } from '../db/database';
import { getMemoriesForFile, markMemoryOutdated, updateMemoryContent } from '../db/queries';
import { relativeToWorkspace } from '../utils/pathUtils';
import { log } from '../utils/logger';

export class MemorySidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vestigo.memorySidebar';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'editMemory':
                    await this._handleEditMemory(message.id, message.content);
                    break;
                case 'markOutdated':
                    await this._handleMarkOutdated(message.id, message.outdated);
                    break;
                case 'openUrl':
                    if (message.url) {
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
                    }
                    break;
            }
        });

        this.refresh();
    }

    refresh(): void {
        if (!this._view) {
            return;
        }
        const { filePath, memories } = this._getCurrentFileMemories();
        this._view.webview.postMessage({
            type: 'update',
            filePath,
            memories,
        });
    }

    private _getCurrentFileMemories(): { filePath: string; memories: ReturnType<typeof getMemoriesForFile> } {
        const workspaceRoot = getWorkspaceRoot();
        const workspaceId = getWorkspaceId();
        if (!workspaceRoot || !workspaceId) {
            return { filePath: '', memories: [] };
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return { filePath: '', memories: [] };
        }

        const filePath = relativeToWorkspace(editor.document.uri.fsPath, workspaceRoot);
        try {
            const db = getDatabase();
            const memories = getMemoriesForFile(db, workspaceId, filePath);
            return { filePath, memories };
        } catch (err) {
            log(`Failed to load memories: ${err instanceof Error ? err.message : String(err)}`);
            return { filePath, memories: [] };
        }
    }

    private async _handleEditMemory(id: string, content: string): Promise<void> {
        try {
            const db = getDatabase();
            updateMemoryContent(db, id, content);
            this.refresh();
        } catch (err) {
            log(`Failed to edit memory: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private async _handleMarkOutdated(id: string, outdated: boolean): Promise<void> {
        try {
            const db = getDatabase();
            markMemoryOutdated(db, id, outdated);
            this.refresh();
        } catch (err) {
            log(`Failed to mark memory outdated: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'out', 'webviews', 'sidebar', 'sidebar.js')
        );

        const cssPath = path.join(
            this._extensionUri.fsPath,
            'out',
            'webviews',
            'sidebar',
            'sidebar.css'
        );
        let style = '';
        try {
            style = fs.readFileSync(cssPath, 'utf8');
        } catch {
            // CSS file may not exist yet; the webview will still render without styles.
        }

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vestigo Memory</title>
    <style nonce="${nonce}">${style}</style>
</head>
<body>
    <div id="app">
        <div id="file-header">
            <div id="file-label">No file open</div>
        </div>
        <div id="memories-container">
            <div class="empty-state">Loading memories...</div>
        </div>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
