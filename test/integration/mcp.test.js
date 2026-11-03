const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');

test('a real stdio client initializes, writes, deduplicates and retrieves bounded memory', { timeout: 15000 }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vestigo-mcp-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'Fresh clone', description: 'Example project' }));
    fs.writeFileSync(path.join(root, 'app.js'), 'console.log("hello");');
    const child = spawn(process.execPath, [path.resolve(__dirname, '../../out/agent/server.js'), '--workspace', root],
        { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    let sequence = 0;
    const pending = new Map();
    child.stderr.on('data', (data) => { stderr += data; });
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', (line) => {
        let message;
        try { message = JSON.parse(line); } catch { assert.fail(`Non-protocol stdout: ${line}`); }
        const waiter = pending.get(message.id);
        if (waiter) { pending.delete(message.id); message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result); }
    });
    child.on('exit', () => {
        for (const waiter of pending.values()) { waiter.reject(new Error(`Server exited: ${stderr}`)); }
        pending.clear();
    });
    const request = (method, params) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}; ${stderr}`)); }, 5000);
        pending.set(id, { resolve: (result) => { clearTimeout(timeout); resolve(result); }, reject: (err) => { clearTimeout(timeout); reject(err); } });
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
    const call = (name, args) => request('tools/call', { name, arguments: args });
    const read = (result) => JSON.parse(result.content[0].text);
    try {
        const initialized = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'vestigo-test', version: '1.0' } });
        assert.equal(initialized.serverInfo.name, 'vestigo');
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
        const tools = await request('tools/list', {});
        assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ['get_memory', 'get_project_brief', 'get_task_context', 'record_work']);
        const input = { summary: 'Added booking reminders', files: ['app.js'], next: 'Verify delivery' };
        const saved = read(await call('record_work', input));
        assert.equal(saved.status, 'saved');
        assert.equal(read(await call('record_work', input)).status, 'duplicate');
        assert.ok(JSON.stringify(saved).length < 150, 'Acknowledgement should remain compact');
        const context = read(await call('get_task_context', { query: 'booking', tokenBudget: 600 }));
        assert.equal(context.memories[0].id, saved.id);
        assert.equal(context.memories[0].verificationSource, 'agent_reported');
        assert.ok(context.estimatedTokens <= 600);
        const brief = read(await call('get_project_brief', {}));
        assert.equal(brief.project.name, 'Fresh clone');
        assert.equal(read(await call('get_memory', { id: saved.id })).evidence.length, 1);
        assert.equal((await call('record_work', { summary: 'Escape', files: ['../outside'] })).isError, true);
        const malformed = await call('record_work', { summary: '', arbitrary: true });
        assert.equal(malformed.isError, true);
    } finally {
        lines.close();
        child.stdin.end();
        child.kill();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
