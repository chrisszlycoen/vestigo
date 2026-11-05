import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
    MAX_RECORD_BYTES, PORTABLE_CONTEXT_FILE, recordInputSchema, workMemorySchema,
    portableContextSchema, estimateTokens,
    type MemoryView, type WorkMemory, type NormalizedRecordInput,
} from './schema';

const execFileAsync = promisify(execFile);
const MAX_FILE_BYTES = 1024 * 1024;
const SECRET = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b)/;
const BLOCKED_SEGMENT = /^(?:\.git|\.vestigo|node_modules|\.aws|\.ssh|secrets?)$/i;
const BLOCKED_FILE = /^(?:\.env(?:\..*)?|.*\.(?:pem|key|p12|pfx)|credentials(?:\..*)?)$/i;

function sha256(value: string | Buffer): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

export async function readGitState(root: string): Promise<{ revision: string | null; dirty: boolean | null }> {
    try {
        const options = { cwd: root, timeout: 2000, maxBuffer: 128 * 1024, windowsHide: true };
        const [head, status] = await Promise.all([
            execFileAsync('git', ['rev-parse', 'HEAD'], options),
            execFileAsync('git', ['status', '--porcelain', '--untracked-files=normal', '--', '.', ':(exclude).vestigo'], options),
        ]);
        const revision = head.stdout.trim();
        return { revision: /^[a-f0-9]{40,64}$/.test(revision) ? revision : null, dirty: status.stdout.length > 0 };
    } catch {
        return { revision: null, dirty: null };
    }
}

export class MemoryStore {
    readonly root: string;
    readonly directory: string;
    readIssues = 0;

    constructor(root: string) {
        this.root = fs.realpathSync(root);
        if (!fs.statSync(this.root).isDirectory()) {
            throw new Error('Open a project folder to use Vestigo.');
        }
        this.directory = path.join(this.root, '.vestigo', 'agent-memory');
    }

    /** Resolve every existing parent, including symlinks, before touching a file. */
    safePath(relative: string, internal = false): string {
        const normalized = relative.replace(/\\/g, '/');
        const segments = normalized.split('/');
        if (!normalized || path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)
            || segments.some((part) => !part || part === '.' || part === '..')
            || (!internal && segments.some((part) => BLOCKED_SEGMENT.test(part) || BLOCKED_FILE.test(part)))) {
            throw new Error('Use a project-relative path outside private or generated folders.');
        }
        const target = path.join(this.root, ...segments);
        let existing = target;
        while (!fs.existsSync(existing)) {
            // A dangling symlink must not be treated as a missing, safe parent.
            try {
                if (fs.lstatSync(existing).isSymbolicLink()) {
                    throw new Error('Broken symbolic links cannot be used for memory storage.');
                }
            } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== 'ENOENT') { throw err; }
            }
            existing = path.dirname(existing);
        }
        const resolved = fs.realpathSync(existing);
        const rel = path.relative(this.root, resolved);
        if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
            throw new Error('Memory paths must remain inside the project.');
        }
        return target;
    }

    private fingerprint(file: string): string | null {
        const absolute = this.safePath(file);
        try {
            const stat = fs.statSync(absolute);
            if (!stat.isFile() || stat.size > MAX_FILE_BYTES) { return null; }
            return sha256(fs.readFileSync(absolute));
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') { return null; }
            throw err;
        }
    }

    private validateInput(value: unknown): NormalizedRecordInput {
        const input = recordInputSchema.parse(value);
        input.files = [...new Set(input.files.map((file) => file.replace(/\\/g, '/')))].sort();
        input.files.forEach((file) => this.safePath(file));
        const serialized = JSON.stringify(input);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_RECORD_BYTES) {
            throw new Error(`Memory exceeds ${MAX_RECORD_BYTES} UTF-8 bytes. Keep only the decision, evidence and next step.`);
        }
        if (SECRET.test(serialized)) {
            throw new Error('Possible credential detected. Remove it before saving memory.');
        }
        if (input.verification && input.verification.status !== 'not_run' && !input.verification.command) {
            throw new Error('A passed or failed check needs the command that was actually run.');
        }
        return input;
    }

    async record(value: unknown): Promise<{ id: string; status: 'saved' | 'duplicate'; estimatedTokens: number }> {
        const input = this.validateInput(value);
        const evidence = input.files.map((file) => ({ path: file, sha256: this.fingerprint(file) }));
        const id = sha256(JSON.stringify({ input, evidence })).slice(0, 24);
        const existing = this.list(true).find((memory) => memory.id === id);
        if (existing) { return { id, status: 'duplicate', estimatedTokens: estimateTokens(input) }; }
        if (input.supersedes && !this.list(true).some((memory) => memory.id === input.supersedes)) {
            throw new Error('The memory being superseded was not found.');
        }
        const git = await readGitState(this.root);
        const memory: WorkMemory = { version: 1, id, input, capturedAt: new Date().toISOString(), ...git, evidence };
        this.safePath('.vestigo/agent-memory', true);
        fs.mkdirSync(this.directory, { recursive: true });
        // Protect local records even when launched outside the VS Code extension.
        const ignore = this.safePath('.vestigo/.gitignore', true);
        fs.writeFileSync(ignore, '*\n', { mode: 0o600 });
        const target = this.safePath(`.vestigo/agent-memory/${id}.json`, true);
        // A hard link publishes a complete immutable record without replacing a concurrent write.
        const temporary = this.safePath(`.vestigo/agent-memory/${id}.${crypto.randomUUID()}.tmp`, true);
        fs.writeFileSync(temporary, JSON.stringify(memory), { flag: 'wx', mode: 0o600 });
        let status: 'saved' | 'duplicate' = 'saved';
        try {
            fs.linkSync(temporary, target);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'EEXIST') { throw err; }
            status = 'duplicate';
        } finally {
            fs.unlinkSync(temporary);
        }
        return { id, status, estimatedTokens: estimateTokens(input) };
    }

    private readRecord(file: string): WorkMemory | undefined {
        try {
            if (fs.statSync(file).size > 16 * 1024) { throw new Error('Oversized record'); }
            const memory = workMemorySchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
            this.validateInput(memory.input);
            if (JSON.stringify(memory.evidence.map((item) => item.path)) !== JSON.stringify(memory.input.files)) {
                throw new Error('Evidence paths do not match memory paths');
            }
            if (sha256(JSON.stringify({ input: memory.input, evidence: memory.evidence })).slice(0, 24) !== memory.id) {
                throw new Error('Memory contents do not match their identifier');
            }
            return memory;
        } catch {
            this.readIssues++;
            return undefined;
        }
    }

    list(includeSuperseded = false): WorkMemory[] {
        this.readIssues = 0;
        const memories = new Map<string, WorkMemory>();
        const portable = this.readPortable();
        portable?.memories.forEach((memory) => memories.set(memory.id, memory));
        const directory = this.safePath('.vestigo/agent-memory', true);
        if (fs.existsSync(directory)) {
            for (const entry of fs.readdirSync(directory)) {
                if (!/^[a-f0-9]{24}\.json$/.test(entry)) { continue; }
                try {
                    const memory = this.readRecord(this.safePath(`.vestigo/agent-memory/${entry}`, true));
                    if (memory) { memories.set(memory.id, memory); }
                } catch { this.readIssues++; }
            }
        }
        const all = [...memories.values()];
        const superseded = new Set(all.map((memory) => memory.input.supersedes).filter(Boolean));
        return all.filter((memory) => includeSuperseded || !superseded.has(memory.id))
            .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || a.id.localeCompare(b.id));
    }

    inspect(memory: WorkMemory): MemoryView {
        let evidenceState: MemoryView['evidenceState'] = memory.evidence.length ? 'unchanged' : 'unavailable';
        for (const evidence of memory.evidence) {
            try {
                const current = this.fingerprint(evidence.path);
                if (current === null) {
                    evidenceState = fs.existsSync(this.safePath(evidence.path)) ? 'unavailable' : 'missing';
                    break;
                }
                if (evidence.sha256 === null) { evidenceState = 'unavailable'; }
                else if (current !== evidence.sha256) { evidenceState = 'changed'; break; }
            } catch { evidenceState = 'unavailable'; }
        }
        return { ...memory, evidenceState, verificationSource: 'agent_reported' };
    }

    search(query = '', file?: string, limit = 5): MemoryView[] {
        if (file) { this.safePath(file); }
        const terms = query.toLocaleLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
        return this.list().map((memory, index) => {
            const text = JSON.stringify(memory.input).toLocaleLowerCase();
            const score = terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
            return { memory, score, index };
        }).filter(({ memory, score }) => (!file || memory.input.files.includes(file)) && (!terms.length || score > 0))
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, Math.max(1, Math.min(20, limit)))
            .map(({ memory }) => this.inspect(memory));
    }

    readPortable(): ReturnType<typeof portableContextSchema.parse> | undefined {
        const file = this.safePath(PORTABLE_CONTEXT_FILE, true);
        if (!fs.existsSync(file)) { return undefined; }
        try {
            if (fs.statSync(file).size > 1024 * 1024) { throw new Error('Oversized context pack'); }
            const pack = portableContextSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
            for (const memory of pack.memories) {
                this.validateInput(memory.input);
                if (memory.input.visibility !== 'project'
                    || JSON.stringify(memory.evidence.map((item) => item.path)) !== JSON.stringify(memory.input.files)
                    || sha256(JSON.stringify({ input: memory.input, evidence: memory.evidence })).slice(0, 24) !== memory.id) {
                    throw new Error('Portable context must contain only project memories with matching evidence.');
                }
            }
            return pack;
        } catch { this.readIssues++; return undefined; }
    }

    async exportPortable(): Promise<{ path: string; count: number }> {
        const memories = this.list().filter((memory) => memory.input.visibility === 'project');
        if (memories.length > 200) { throw new Error('Portable context is limited to 200 project memories.'); }
        const { revision } = await readGitState(this.root);
        const pack = { version: 1, exportedAt: new Date().toISOString(), revision, memories };
        const target = this.safePath(PORTABLE_CONTEXT_FILE, true);
        const temporary = this.safePath(`vestigo.context.${crypto.randomUUID()}.tmp`, true);
        fs.writeFileSync(temporary, `${JSON.stringify(pack, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
        try { fs.renameSync(temporary, target); }
        finally { if (fs.existsSync(temporary)) { fs.unlinkSync(temporary); } }
        return { path: target, count: memories.length };
    }
}
