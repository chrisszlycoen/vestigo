import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId, getWorkspaceRoot } from '../db/database';
import { getMemoriesForFile, markMemoryOutdated, updateMemoryContent } from '../db/queries';
import { isInsideWorkspace, relativeToWorkspace } from '../utils/pathUtils';
import { log } from '../utils/logger';
import { MemoryStore } from '../memory/store';
import { compactMemory, getProjectBrief } from '../memory/context';

export class MemorySidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vestigo.memorySidebar';
    private _view?: vscode.WebviewView;
    private _refreshId = 0;
    private _scope: 'project' | 'file' = 'project';
    private _brief?: { root: string; time: number; value: Awaited<ReturnType<typeof getProjectBrief>> };

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

        webviewView.onDidDispose(() => { this._view = undefined; });
        webviewView.webview.onDidReceiveMessage(async (message: unknown) => {
            if (!message || typeof message !== 'object' || !('command' in message)) { return; }
            const data = message as Record<string, unknown>;
            switch (data.command) {
                case 'ready':
                    void this.refresh();
                    break;
                case 'scope':
                    this._scope = data.scope === 'file' ? 'file' : 'project';
                    void this.refresh();
                    break;
                case 'copyContext':
                case 'recordWork':
                case 'connectAgent':
                case 'exportContext': {
                    const commands: Record<string, string> = { copyContext: 'vestigo.copyProjectContext',
                        recordWork: 'vestigo.recordWork', connectAgent: 'vestigo.connectAgent',
                        exportContext: 'vestigo.exportProjectContext' };
                    await vscode.commands.executeCommand(commands[String(data.command)]);
                    break;
                }
                case 'editMemory':
                    if (typeof data.id === 'string' && typeof data.content === 'string' && data.content.length <= 10000) {
                        await this._handleEditMemory(data.id, data.content);
                    }
                    break;
                case 'markOutdated':
                    if (typeof data.id === 'string' && typeof data.outdated === 'boolean') {
                        await this._handleMarkOutdated(data.id, data.outdated);
                    }
                    break;
                case 'openUrl':
                    if (typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) {
                        void vscode.env.openExternal(vscode.Uri.parse(data.url));
                    }
                    break;
            }
        });

        this.refresh();
    }

    async refresh(): Promise<void> {
        if (!this._view) {
            return;
        }
        const refreshId = ++this._refreshId;
        const { filePath, memories } = this._getCurrentFileMemories();
        const root = getWorkspaceRoot();
        if (!root) { return; }
        try {
            const store = new MemoryStore(root);
            const all = store.list();
            const skippedRecords = store.readIssues;
            const selected = all.filter((memory) => this._scope === 'project' || memory.input.files.includes(filePath)).slice(0, 12);
            const workMemories = selected.map((memory) => compactMemory(store.inspect(memory)));
            if (!this._brief || this._brief.root !== root || Date.now() - this._brief.time > 5000) {
                this._brief = { root, time: Date.now(), value: await getProjectBrief(store) };
            }
            if (refreshId !== this._refreshId || !this._view) { return; }
            void this._view.webview.postMessage({
                type: 'update',
                filePath,
                memories: this._scope === 'file' ? memories : [],
                workMemories,
                total: all.length,
                shown: selected.length,
                scope: this._scope,
                project: this._brief.value,
                skippedRecords,
            });
        } catch (err) {
            log(`Failed to load project memory: ${err instanceof Error ? err.message : String(err)}`);
            void this._view?.webview.postMessage({ type: 'error', message: 'Could not load project memory. Check the Vestigo output for details.' });
        }
    }

    private _getCurrentFileMemories(): { filePath: string; memories: ReturnType<typeof getMemoriesForFile> } {
        const workspaceRoot = getWorkspaceRoot();
        const workspaceId = getWorkspaceId();
        if (!workspaceRoot || !workspaceId) {
            return { filePath: '', memories: [] };
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'file' || !isInsideWorkspace(editor.document.uri.fsPath, workspaceRoot)) {
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
        <header class="project-header">
            <div class="eyebrow">YOUR PROJECT, REMEMBERED</div>
            <h1 id="project-name">Vestigo</h1>
            <p id="project-description">Pick up where you left off.</p>
            <div class="primary-actions">
                <button id="copy-context" class="primary-button">Copy context for AI</button>
                <button id="connect-agent" class="secondary-button">Connect AI</button>
            </div>
        </header>
        <section class="context-health" aria-label="Context status">
            <span id="memory-count">0 memories</span><span id="context-status">Local memory</span>
        </section>
        <nav class="scope-tabs" aria-label="Memory scope">
            <button id="project-tab" class="scope-tab active" aria-pressed="true">Recent work</button>
            <button id="file-tab" class="scope-tab" aria-pressed="false">This file</button>
        </nav>
        <div id="file-header">
            <div id="file-label">No file open</div>
        </div>
        <div id="memories-container">
            <div class="empty-state">Loading memories...</div>
        </div>
        <footer class="memory-footer">
            <button id="record-work" class="action-button">Save a checkpoint</button>
            <button id="export-context" class="action-button">Export project memory</button>
            <p>No extra AI calls to store or retrieve memory.</p>
        </footer>
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
