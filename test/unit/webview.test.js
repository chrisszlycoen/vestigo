const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('browser bundles run without Node globals and request initial sidebar state', () => {
    for (const view of ['sidebar', 'search']) {
        const messages = [];
        const context = {
            acquireVsCodeApi: () => ({ postMessage: (message) => messages.push(message) }),
            window: { addEventListener() {} },
            document: { readyState: 'complete', addEventListener() {}, getElementById() { return null; } },
        };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../out/webviews', view, `${view}.js`), 'utf8'), context);
        if (view === 'sidebar') { assert.equal(messages[0].command, 'ready'); }
    }
});

test('sidebar renders agent evidence and escapes stored HTML', () => {
    let handleMessage;
    const nodes = new Map();
    const element = () => ({ textContent: '', innerHTML: '', addEventListener() {},
        classList: { toggle() {} }, setAttribute() {} });
    for (const id of ['memories-container', 'file-label', 'project-name', 'project-description', 'memory-count', 'context-status']) {
        nodes.set(id, element());
    }
    const context = {
        acquireVsCodeApi: () => ({ postMessage() {} }),
        window: { addEventListener: (type, fn) => { if (type === 'message') { handleMessage = fn; } } },
        document: { readyState: 'complete', getElementById: (id) => nodes.get(id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../out/webviews/sidebar/sidebar.js'), 'utf8'), context);
    handleMessage({ data: { type: 'update', filePath: '', memories: [], total: 1, shown: 1, scope: 'project', skippedRecords: 0,
        project: { name: 'App', description: 'Build things', portableContext: 'absent' },
        workMemories: [{ id: 'a', kind: 'work', summary: '<img onerror="evil()">', reason: 'Reason',
            files: ['src/a.ts'], visibility: 'private', capturedAt: '2026-01-01T00:00:00.000Z',
            verification: { status: 'passed', command: 'npm test' }, evidenceState: 'changed', next: 'Verify delivery' }],
    } });
    const html = nodes.get('memories-container').innerHTML;
    assert.ok(html.includes('&lt;img'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('agent-reported'));
    assert.ok(html.includes('check context'));
    assert.ok(html.includes('Verify delivery'));
});
