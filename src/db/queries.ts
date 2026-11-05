import type { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { persistDatabase } from './database';

export type SourceType = 'pr' | 'commit' | 'session' | 'manual';

export interface Memory {
    id: string;
    workspace_id: string;
    file_path: string;
    line_start: number | null;
    line_end: number | null;
    content: string;
    source_type: SourceType;
    source_ref: string | null;
    source_url: string | null;
    is_outdated: number;
    created_at: string;
    updated_at: string;
}

export interface CreateMemoryInput {
    workspace_id: string;
    file_path: string;
    line_start?: number | null;
    line_end?: number | null;
    content: string;
    source_type: SourceType;
    source_ref?: string | null;
    source_url?: string | null;
}

function rowToMemory(row: Record<string, unknown>): Memory {
    return {
        id: String(row.id),
        workspace_id: String(row.workspace_id),
        file_path: String(row.file_path),
        line_start: row.line_start === null ? null : Number(row.line_start),
        line_end: row.line_end === null ? null : Number(row.line_end),
        content: String(row.content),
        source_type: String(row.source_type) as SourceType,
        source_ref: row.source_ref === null ? null : String(row.source_ref),
        source_url: row.source_url === null ? null : String(row.source_url),
        is_outdated: Number(row.is_outdated),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    };
}

function getAll(statement: import('sql.js').Statement): Memory[] {
    const rows: Memory[] = [];
    while (statement.step()) {
        rows.push(rowToMemory(statement.getAsObject()));
    }
    statement.free();
    return rows;
}

export function createMemory(db: Database, input: CreateMemoryInput): Memory {
    const id = uuidv4();
    const now = new Date().toISOString();
    const memory: Memory = {
        id,
        workspace_id: input.workspace_id,
        file_path: input.file_path,
        line_start: input.line_start ?? null,
        line_end: input.line_end ?? null,
        content: input.content.trim(),
        source_type: input.source_type,
        source_ref: input.source_ref ?? null,
        source_url: input.source_url ?? null,
        is_outdated: 0,
        created_at: now,
        updated_at: now,
    };

    db.run(
        `
        INSERT INTO memories (
            id, workspace_id, file_path, line_start, line_end, content,
            source_type, source_ref, source_url, is_outdated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            memory.id,
            memory.workspace_id,
            memory.file_path,
            memory.line_start,
            memory.line_end,
            memory.content,
            memory.source_type,
            memory.source_ref,
            memory.source_url,
            memory.is_outdated,
            memory.created_at,
            memory.updated_at,
        ]
    );

    persistDatabase();
    return memory;
}

export function findMemoryBySource(
    db: Database,
    workspaceId: string,
    sourceType: SourceType,
    sourceRef: string,
    filePath: string
): Memory | undefined {
    const stmt = db.prepare(
        `
        SELECT * FROM memories
        WHERE workspace_id = ? AND source_type = ? AND source_ref = ? AND file_path = ?
        `
    );
    stmt.bind([workspaceId, sourceType, sourceRef, filePath]);
    if (!stmt.step()) {
        stmt.free();
        return undefined;
    }
    const row = rowToMemory(stmt.getAsObject());
    stmt.free();
    return row;
}

export function getMemoriesForFile(
    db: Database,
    workspaceId: string,
    filePath: string
): Memory[] {
    const stmt = db.prepare(
        `
        SELECT * FROM memories
        WHERE workspace_id = ? AND file_path = ?
        ORDER BY is_outdated ASC, created_at DESC
        `
    );
    stmt.bind([workspaceId, filePath]);
    return getAll(stmt);
}

export function updateMemoryContent(db: Database, id: string, content: string): void {
    db.run('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?', [
        content.trim(),
        new Date().toISOString(),
        id,
    ]);
    persistDatabase();
}

export function markMemoryOutdated(db: Database, id: string, outdated: boolean): void {
    db.run('UPDATE memories SET is_outdated = ?, updated_at = ? WHERE id = ?', [
        outdated ? 1 : 0,
        new Date().toISOString(),
        id,
    ]);
    persistDatabase();
}

export function getWorkspaceSettings(db: Database, workspaceId: string): WorkspaceSettings | undefined {
    const stmt = db.prepare('SELECT * FROM workspace_settings WHERE workspace_id = ?');
    stmt.bind([workspaceId]);
    if (!stmt.step()) {
        stmt.free();
        return undefined;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return {
        workspace_id: String(row.workspace_id),
        github_owner: row.github_owner === null ? null : String(row.github_owner),
        github_repo: row.github_repo === null ? null : String(row.github_repo),
        sync_enabled: Number(row.sync_enabled),
        last_pr_sync: row.last_pr_sync === null ? null : String(row.last_pr_sync),
        index_paths: row.index_paths === null ? null : String(row.index_paths),
    };
}

export function setWorkspaceSettings(
    db: Database,
    workspaceId: string,
    settings: Partial<WorkspaceSettings>
): void {
    const existing = getWorkspaceSettings(db, workspaceId);
    if (existing) {
        db.run(
            `
            UPDATE workspace_settings SET
                github_owner = COALESCE(?, github_owner),
                github_repo = COALESCE(?, github_repo),
                sync_enabled = COALESCE(?, sync_enabled),
                last_pr_sync = COALESCE(?, last_pr_sync),
                index_paths = COALESCE(?, index_paths)
            WHERE workspace_id = ?
            `,
            [
                settings.github_owner ?? null,
                settings.github_repo ?? null,
                settings.sync_enabled ?? null,
                settings.last_pr_sync ?? null,
                settings.index_paths ?? null,
                workspaceId,
            ]
        );
    } else {
        db.run(
            `
            INSERT INTO workspace_settings
                (workspace_id, github_owner, github_repo, sync_enabled, last_pr_sync, index_paths)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                workspaceId,
                settings.github_owner ?? null,
                settings.github_repo ?? null,
                settings.sync_enabled ?? 0,
                settings.last_pr_sync ?? null,
                settings.index_paths ?? null,
            ]
        );
    }
    persistDatabase();
}

export interface WorkspaceSettings {
    workspace_id: string;
    github_owner: string | null;
    github_repo: string | null;
    sync_enabled: number;
    last_pr_sync: string | null;
    index_paths: string | null;
}

export function getRecentCommitSyncCutoff(db: Database, workspaceId: string): Date {
    const stmt = db.prepare(
        `
        SELECT MAX(created_at) as latest FROM memories
        WHERE workspace_id = ? AND source_type = 'commit'
        `
    );
    stmt.bind([workspaceId]);
    if (!stmt.step()) {
        stmt.free();
        return new Date(0);
    }
    const row = stmt.getAsObject();
    stmt.free();
    return row.latest ? new Date(String(row.latest)) : new Date(0);
}

export function countMemoriesForWorkspace(db: Database, workspaceId: string): number {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM memories WHERE workspace_id = ?');
    stmt.bind([workspaceId]);
    if (!stmt.step()) {
        stmt.free();
        return 0;
    }
    const row = stmt.getAsObject();
    stmt.free();
    return Number(row.total);
}
