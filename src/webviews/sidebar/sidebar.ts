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
}

type WebviewMessage = UpdateMessage;

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
    const content = escapeHtml(memory.content).replace(/\n/g, '<br>');

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

function render(memories: Memory[], filePath: string): void {
    const container = document.getElementById('memories-container');
    const fileLabel = document.getElementById('file-label');
    if (!container || !fileLabel) {
        return;
    }

    fileLabel.textContent = filePath || 'No file open';

    if (memories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No memories yet. Vestigo will capture reasoning from your PRs and commits
                automatically as they are added.
            </div>
        `;
        return;
    }

    container.innerHTML = memories.map(renderMemory).join('');
}

function handleMessage(event: MessageEvent<WebviewMessage>): void {
    const message = event.data;
    if (message.type === 'update') {
        render(message.memories, message.filePath);
    }
}

function attachListeners(): void {
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
document.addEventListener('DOMContentLoaded', attachListeners);

export {};

