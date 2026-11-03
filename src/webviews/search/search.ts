// Placeholder for the Vestigo semantic search webview.
// Feature 3 (semantic code navigation) is planned for V1.5.

const vscode = acquireVsCodeApi();

function render(): void {
    const container = document.getElementById('search-container');
    if (!container) {
        return;
    }
    container.innerHTML = '<div class="empty-state">Semantic search is coming soon.</div>';
}

document.addEventListener('DOMContentLoaded', render);

// Suppress unused variable warning in strict TS; the API handle is used implicitly.
void vscode;

export {};

