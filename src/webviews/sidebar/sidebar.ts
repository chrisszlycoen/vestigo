import type { compactMemory, getProjectBrief } from '../../memory/context';

interface Memory {
    id: string;
    file_path: string;
    line_start: number | null;
    line_end: number | null;
    content: string;
    source_type: 'pr' | 'commit' | 'session' | 'manual';
    source_ref: string | null;
    source_url: string | null;
    is_outdated: number;
    created_at: string;
    updated_at: string;
}

interface UpdateMessage {
    type: 'update';
    filePath: string;
    memories: Memory[];
    workMemories: ReturnType<typeof compactMemory>[];
    total: number;
    shown: number;
    scope: 'project' | 'file';
    project: Awaited<ReturnType<typeof getProjectBrief>>;
    skippedRecords: number;
}

type WebviewMessage = UpdateMessage | { type: 'error'; message: string };

const vscode = acquireVsCodeApi();

function renderSource(memory: Memory): string {
    switch (memory.source_type) {
        case 'pr':
            return `PR #${memory.source_ref ?? '?'}`;
        case 'commit':
            return `Commit ${memory.source_ref?.slice(0, 7) ?? '?'}`;
        case 'session':
            return `Session ${memory.source_ref ?? '?'}`;
        case 'manual':
            return 'Manual';
        default:
            return 'Unknown';
    }
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderMemory(memory: Memory): string {
    const outdatedClass = memory.is_outdated ? 'memory-outdated' : '';
    const sourceLabel = renderSource(memory);
    const date = formatDate(memory.created_at);
    const content = escapeHtml(memory.content);

    const sourceUrlButton =
        memory.source_url
            ? `<button class="action-button" data-url="${escapeHtml(memory.source_url)}">↗ Source</button>`
            : '';

    return `
        <div class="memory-card ${outdatedClass}" data-id="${memory.id}">
            <div class="memory-header">
                <span class="memory-date">${date}</span>
                <span class="memory-source">${escapeHtml(sourceLabel)}</span>
            </div>
            <div class="memory-content">${content}</div>
            <div class="memory-actions">
                <button class="action-button edit-button" data-id="${memory.id}">Edit</button>
                <button class="action-button outdated-button" data-id="${memory.id}" data-outdated="${memory.is_outdated}">
                    ${memory.is_outdated ? 'Mark current' : 'Mark outdated'}
                </button>
                ${sourceUrlButton}
            </div>
        </div>
    `;
}

function renderWork(memory: ReturnType<typeof compactMemory>): string {
    const label = { work: 'Work checkpoint', decision: 'Decision', constraint: 'Important constraint', issue: 'Known issue' }[memory.kind];
    const evidence = { unchanged: 'Files unchanged', changed: 'Files changed · check context', missing: 'File evidence missing', unavailable: 'Evidence not available' }[memory.evidenceState];
    const check = memory.verification;
    const verification = check ? `<div class="work-detail"><span class="detail-label">Check · agent-reported</span><span>${escapeHtml(check.status.replace('_', ' '))}${check.command ? ` · ${escapeHtml(check.command)}` : ''}${check.detail ? ` — ${escapeHtml(check.detail)}` : ''}</span></div>` : '';
    return `<article class="memory-card work-card">
        <div class="memory-header"><span class="memory-source">${label}</span><span class="memory-date">${escapeHtml(formatDate(memory.capturedAt))}</span></div>
        <h2 class="work-summary">${escapeHtml(memory.summary)}</h2>
        ${memory.reason ? `<div class="work-detail"><span class="detail-label">Why</span><span>${escapeHtml(memory.reason)}</span></div>` : ''}
        ${verification}
        ${memory.next ? `<div class="next-step"><span class="detail-label">Next step</span><span>${escapeHtml(memory.next)}</span></div>` : ''}
        ${memory.files.length ? `<div class="file-references">${memory.files.map((file) => `<span>${escapeHtml(file)}</span>`).join('')}</div>` : ''}
        <div class="evidence-state ${memory.evidenceState === 'changed' || memory.evidenceState === 'missing' ? 'needs-check' : ''}">${evidence} · ${memory.visibility === 'private' ? 'Private' : 'Project'}${memory.dirty ? ' · Uncommitted changes at capture' : ''}</div>
    </article>`;
}

function render(message: UpdateMessage): void {
    const { memories, filePath, workMemories, project, scope } = message;
    const container = document.getElementById('memories-container');
    const fileLabel = document.getElementById('file-label');
    if (!container || !fileLabel) {
        return;
    }

    fileLabel.textContent = scope === 'file' ? filePath || 'Open a file to see its context' : 'Decisions, progress & what comes next';
    const name = document.getElementById('project-name');
    const description = document.getElementById('project-description');
    const count = document.getElementById('memory-count');
    const status = document.getElementById('context-status');
    if (name) { name.textContent = project.name; }
    if (description) { description.textContent = project.description; }
    if (count) { count.textContent = `${message.total} checkpoint${message.total === 1 ? '' : 's'}`; }
    if (status) {
        status.textContent = message.skippedRecords ? `${message.skippedRecords} unreadable record(s)`
            : project.portableContext === 'different_revision' ? 'Shared context · check revision'
            : project.portableContext === 'same_revision' ? 'Shared context loaded' : 'Local memory';
    }
    for (const tab of ['project', 'file']) {
        const button = document.getElementById(`${tab}-tab`);
        button?.classList.toggle('active', scope === tab);
        button?.setAttribute('aria-pressed', String(scope === tab));
    }

    if (memories.length === 0 && workMemories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <strong>${scope === 'file' ? 'No context for this file yet.' : 'Your next session starts here.'}</strong>
                <p>${scope === 'file' ? 'Relevant checkpoints and imported history will appear here.' : 'Connect your AI to save progress and decisions as you build. Or save your first checkpoint below.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = workMemories.map(renderWork).join('')
        + (memories.length ? '<div class="section-label">Imported history & notes</div>' + memories.map(renderMemory).join('') : '')
        + (message.shown >= 12 ? '<p class="list-note">Showing the latest 12 checkpoints. Your AI can search earlier context.</p>' : '');
}

function handleMessage(event: MessageEvent<WebviewMessage>): void {
    const message = event.data;
    if (message.type === 'update') {
        render(message);
    } else if (message.type === 'error') {
        const container = document.getElementById('memories-container');
        if (container) { container.textContent = message.message; }
    }
}

function attachListeners(): void {
    const commands: Record<string, string> = { 'copy-context': 'copyContext', 'connect-agent': 'connectAgent',
        'record-work': 'recordWork', 'export-context': 'exportContext' };
    for (const [id, command] of Object.entries(commands)) {
        document.getElementById(id)?.addEventListener('click', () => vscode.postMessage({ command }));
    }
    for (const scope of ['project', 'file']) {
        document.getElementById(`${scope}-tab`)?.addEventListener('click', () => vscode.postMessage({ command: 'scope', scope }));
    }
    const container = document.getElementById('memories-container');
    if (!container) {
        return;
    }

    container.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        const button = target.closest('button');
        if (!button) {
            return;
        }

        const id = button.dataset.id;
        const url = button.dataset.url;

        if (button.classList.contains('edit-button') && id) {
            const card = document.querySelector(`.memory-card[data-id="${id}"]`);
            const contentEl = card?.querySelector('.memory-content');
            if (!contentEl) {
                return;
            }
            const currentText = contentEl.textContent ?? '';
            contentEl.innerHTML = `<textarea class="edit-textarea">${escapeHtml(currentText)}</textarea>`;
            button.textContent = 'Save';
            button.classList.remove('edit-button');
            button.classList.add('save-button');
            return;
        }

        if (button.classList.contains('save-button') && id) {
            const card = document.querySelector(`.memory-card[data-id="${id}"]`);
            const textarea = card?.querySelector('.edit-textarea') as HTMLTextAreaElement | null;
            if (textarea) {
                vscode.postMessage({ command: 'editMemory', id, content: textarea.value });
            }
            return;
        }

        if (button.classList.contains('outdated-button') && id) {
            const outdated = button.dataset.outdated === '1';
            vscode.postMessage({ command: 'markOutdated', id, outdated: !outdated });
            return;
        }

        if (url) {
            vscode.postMessage({ command: 'openUrl', url });
        }
    });
}

window.addEventListener('message', handleMessage);
function start(): void {
    attachListeners();
    vscode.postMessage({ command: 'ready' });
}
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
else { start(); }

export {};

