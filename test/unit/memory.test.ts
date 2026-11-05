import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MemoryStore } from '../../src/memory/store';
import { estimateTokens } from '../../src/memory/schema';
import { getProjectBrief, getTaskContext } from '../../src/memory/context';

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vestigo-memory-'));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'auth.ts'), 'export const reset = true;\n');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'Example app', description: 'Manage bookings.',
        scripts: { test: 'node --test' }, dependencies: { example: '1.0.0' } }));
    return { root, store: new MemoryStore(root), clean: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('compact writes are private, deduplicated and fingerprinted without claiming independent verification', async () => {
    const f = fixture();
    try {
        const input = { summary: 'Added password reset', files: ['src/auth.ts'],
            verification: { status: 'passed', command: 'npm test' } };
        const first = await f.store.record(input);
        const duplicate = await f.store.record(input);
        assert.equal(first.status, 'saved');
        assert.equal(duplicate.status, 'duplicate');
        assert.equal(first.id, duplicate.id);
        assert.equal(f.store.list().length, 1);
        const memory = f.store.search('password')[0];
        assert.equal(memory.input.visibility, 'private');
        assert.equal(memory.verificationSource, 'agent_reported');
        assert.equal(memory.evidenceState, 'unchanged');
        assert.equal(memory.evidence[0].sha256?.length, 64);
        fs.writeFileSync(path.join(f.root, 'src', 'auth.ts'), 'changed');
        assert.equal(f.store.search('password')[0].evidenceState, 'changed');
        fs.unlinkSync(path.join(f.root, 'src', 'auth.ts'));
        assert.equal(f.store.search('password')[0].evidenceState, 'missing');
    } finally { f.clean(); }
});

test('concurrent writers can publish records without rewriting a shared database', async () => {
    const f = fixture();
    try {
        const results = await Promise.all(Array.from({ length: 12 }, () => new MemoryStore(f.root).record({ summary: 'Same checkpoint' })));
        assert.equal(new Set(results.map((item) => item.id)).size, 1);
        assert.equal(results.filter((item) => item.status === 'saved').length, 1);
        assert.equal(f.store.list().length, 1);
        assert.equal(fs.readdirSync(f.store.directory).filter((item) => item.endsWith('.tmp')).length, 0);
        await Promise.all(Array.from({ length: 12 }, (_, index) => new MemoryStore(f.root).record({ summary: `Checkpoint ${index}` })));
        assert.equal(f.store.list().length, 13);
    } finally { f.clean(); }
});

test('portable context survives another checkout and excludes private work', async () => {
    const f = fixture();
    const clone = fixture();
    try {
        await f.store.record({ summary: 'Private discussion' });
        await f.store.record({ kind: 'constraint', summary: 'Reset tokens expire', files: ['src/auth.ts'], visibility: 'project' });
        const exported = await f.store.exportPortable();
        assert.equal(exported.count, 1);
        const serialized = fs.readFileSync(exported.path, 'utf8');
        assert.ok(!serialized.includes('Private discussion'));
        fs.writeFileSync(path.join(clone.root, 'vestigo.context.json'), serialized);
        const records = clone.store.search('tokens');
        assert.equal(records.length, 1);
        assert.equal(records[0].evidenceState, 'unchanged');
        assert.equal(clone.store.list().length, 1);
        assert.equal(fs.existsSync(clone.store.directory), false, 'Reading portable context should not copy it into local storage');
        fs.writeFileSync(path.join(clone.root, 'src', 'auth.ts'), 'different checkout content');
        assert.equal(clone.store.search('tokens')[0].evidenceState, 'changed');
    } finally { f.clean(); clone.clean(); }
});

test('a real Git clone recovers exported context and identifies changed evidence', async () => {
    const f = fixture();
    const cloneParent = fs.mkdtempSync(path.join(os.tmpdir(), 'vestigo-clone-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: f.root, stdio: 'pipe' });
    try {
        git('init', '-q');
        git('add', '.');
        git('-c', 'user.name=Vestigo Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Initial project');
        const saved = await f.store.record({ summary: 'Reset uses the existing auth module', files: ['src/auth.ts'], visibility: 'project' });
        const original = f.store.list()[0];
        assert.equal(original.revision?.length, 40);
        assert.equal(original.dirty, false);
        await f.store.record({ summary: 'Private work must not travel with the clone' });
        await f.store.exportPortable();
        git('add', 'vestigo.context.json');
        git('-c', 'user.name=Vestigo Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Share project context');
        const cloneRoot = path.join(cloneParent, 'app');
        git('clone', '-q', '--no-hardlinks', f.root, cloneRoot);
        const cloned = new MemoryStore(cloneRoot);
        assert.equal(cloned.list().length, 1);
        assert.equal(cloned.list()[0].id, saved.id);
        assert.equal(cloned.search('reset')[0].evidenceState, 'unchanged');
        const brief = await getProjectBrief(cloned);
        assert.equal(brief.name, 'Example app');
        assert.equal(brief.portableContext, 'different_revision');
        fs.writeFileSync(path.join(cloneRoot, 'src', 'auth.ts'), 'new implementation');
        assert.equal(cloned.search('reset')[0].evidenceState, 'changed');
        const next = await cloned.record({ summary: 'Changed the reset implementation', files: ['src/auth.ts'] });
        assert.equal(cloned.list().find((record) => record.id === next.id)?.dirty, true);
    } finally { f.clean(); fs.rmSync(cloneParent, { recursive: true, force: true }); }
});

test('corrections supersede old memories while preserving history', async () => {
    const f = fixture();
    try {
        const old = await f.store.record({ summary: 'Tokens last an hour' });
        const correction = await f.store.record({ summary: 'Tokens now last ten minutes', supersedes: old.id });
        assert.deepEqual(f.store.list().map((item) => item.id), [correction.id]);
        assert.equal(f.store.list(true).length, 2);
        await assert.rejects(f.store.record({ summary: 'Unknown predecessor', supersedes: 'a'.repeat(24) }), /not found/);
    } finally { f.clean(); }
});

test('unsafe paths, symlink escapes, credentials and unsupported verification claims are rejected', async () => {
    const f = fixture();
    const outside = fixture();
    try {
        for (const file of ['../secret', '/etc/passwd', 'C:\\secret', 'src/../../secret', '.env.local', '.aws/config', 'node_modules/a.js']) {
            await assert.rejects(f.store.record({ summary: 'Unsafe path', files: [file] }));
        }
        fs.symlinkSync(outside.root, path.join(f.root, 'escape'));
        await assert.rejects(f.store.record({ summary: 'Unsafe link', files: ['escape/package.json'] }), /inside the project/);
        fs.symlinkSync(outside.root, path.join(f.root, '.vestigo'));
        await assert.rejects(f.store.record({ summary: 'Storage escape' }), /inside the project/);
        fs.unlinkSync(path.join(f.root, '.vestigo'));
        await assert.rejects(f.store.record({ summary: `Token ghp_${'a'.repeat(30)}` }), /credential/);
        await assert.rejects(f.store.record({ summary: 'Tests passed', verification: { status: 'passed' } }), /command/);
        await assert.rejects(f.store.record({ summary: 'x', invented: true }));
    } finally { f.clean(); outside.clean(); }
});

test('UTF-8 write budget rejects oversized input instead of silently losing important details', async () => {
    const f = fixture();
    try {
        await assert.rejects(f.store.record({ summary: '🧭'.repeat(150), reason: '🧭'.repeat(190),
            next: '🧭'.repeat(150), verification: { status: 'not_run', detail: '🧭'.repeat(110) } }), /UTF-8 bytes/);
        assert.equal(f.store.list().length, 0);
    } finally { f.clean(); }
});

test('task retrieval ranks matches, respects exact file filters and stays within its labelled estimate budget', async () => {
    const f = fixture();
    try {
        await f.store.record({ summary: 'Database connection retries', reason: 'Retry transient failures' });
        await f.store.record({ summary: 'Password reset token expiry', files: ['src/auth.ts'], next: 'Verify delivery' });
        for (let index = 0; index < 12; index++) {
            await f.store.record({ summary: `Password work ${index}: ${'a'.repeat(150)}`, reason: 'b'.repeat(300) });
        }
        const result = await getTaskContext(f.store, { query: 'password reset token', tokenBudget: 600, includeProject: false });
        assert.equal(result.memories[0].summary, 'Password reset token expiry');
        assert.ok(result.omitted > 0);
        assert.ok(estimateTokens(result) <= 600);
        assert.ok(result.estimatedTokens <= 600);
        assert.equal((await getTaskContext(f.store, { query: 'password', file: 'src/auth.ts' })).memories.length, 1);
        assert.equal((await getTaskContext(f.store, { query: 'unknown' })).memories.length, 0);
        const tiny = await getTaskContext(f.store, { tokenBudget: 256 });
        assert.ok(estimateTokens(tiny) <= 256);
    } finally { f.clean(); }
});

test('project brief is bounded and works without any AI service or saved memory', async () => {
    const f = fixture();
    try {
        fs.mkdirSync(path.join(f.root, 'node_modules'));
        fs.writeFileSync(path.join(f.root, '.env'), 'SECRET=not-for-context');
        const brief = await getProjectBrief(f.store);
        assert.equal(brief.name, 'Example app');
        assert.equal(brief.description, 'Manage bookings.');
        assert.deepEqual(brief.scripts, { test: 'node --test' });
        assert.ok(brief.paths.includes('src/auth.ts'));
        assert.ok(!JSON.stringify(brief).includes('SECRET'));
        assert.ok(!brief.paths.some((item) => item.includes('node_modules') || item.includes('.env')));
        assert.equal(brief.portableContext, 'absent');
    } finally { f.clean(); }
});

test('unreadable records are reported without hiding healthy memories', async () => {
    const f = fixture();
    try {
        await f.store.record({ summary: 'Healthy record' });
        fs.writeFileSync(path.join(f.store.directory, `${'a'.repeat(24)}.json`), '{broken');
        assert.equal(f.store.list().length, 1);
        assert.equal(f.store.readIssues, 1);
        assert.equal((await getTaskContext(f.store)).skippedRecords, 1);
    } finally { f.clean(); }
});

test('tampered records are rejected and oversized evidence is unavailable rather than missing', async () => {
    const f = fixture();
    try {
        const saved = await f.store.record({ summary: 'Original evidence', files: ['src/auth.ts'] });
        fs.writeFileSync(path.join(f.root, 'src', 'auth.ts'), Buffer.alloc(1024 * 1024 + 1));
        assert.equal(f.store.search('original')[0].evidenceState, 'unavailable');
        const file = path.join(f.store.directory, `${saved.id}.json`);
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        data.input.summary = 'Changed outside Vestigo';
        fs.writeFileSync(file, JSON.stringify(data));
        assert.equal(f.store.list().length, 0);
        assert.equal(f.store.readIssues, 1);
    } finally { f.clean(); }
});
