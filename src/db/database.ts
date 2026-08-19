import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | undefined;
let db: SqlJsDatabase | undefined;
let workspaceIdCache: string | undefined;
let workspaceRootCache: string | undefined;
let dbPathCache: string | undefined;

export function getWorkspaceRoot(): string | undefined {
    return workspaceRootCache;
}

export function getWorkspaceId(): string | undefined {
    return workspaceIdCache;
}

export function computeWorkspaceId(rootPath: string): string {
    return crypto.createHash('sha256').update(rootPath).digest('hex');
}

export function getVestigoDir(rootPath: string): string {
    return path.join(rootPath, '.vestigo');
}

export function getDbPath(rootPath: string): string {
    return path.join(getVestigoDir(rootPath), 'memory.db');
}

export async function initializeDatabase(rootPath: string): Promise<SqlJsDatabase> {
    if (db && workspaceRootCache === rootPath) {
        return db;
    }

    workspaceRootCache = rootPath;
    workspaceIdCache = computeWorkspaceId(rootPath);
    dbPathCache = getDbPath(rootPath);

    const vestigoDir = getVestigoDir(rootPath);
    if (!fs.existsSync(vestigoDir)) {
        fs.mkdirSync(vestigoDir, { recursive: true });
    }

    const sqlJsDistDir = path.dirname(require.resolve('sql.js'));
    const wasmPath = path.join(sqlJsDistDir, 'sql-wasm.wasm');
    SQL = await initSqlJs({
        locateFile: () => wasmPath,
    });

    if (fs.existsSync(dbPathCache)) {
        const filebuffer = fs.readFileSync(dbPathCache);
        db = new SQL.Database(filebuffer);
    } else {
        db = new SQL.Database();
    }

    runMigrations(db);
    persistDatabase();

    return db;
}

export function getDatabase(): SqlJsDatabase {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return db;
}

export function persistDatabase(): void {
    if (!db || !dbPathCache) {
        return;
    }
    const data = db.export();
    fs.writeFileSync(dbPathCache, Buffer.from(data));
}

function runMigrations(database: SqlJsDatabase): void {
    database.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        return;
    }

    const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

    const appliedResult = database.exec('SELECT name FROM _migrations');
    const applied = new Set(
        (appliedResult[0]?.values ?? []).map((row) => row[0] as string)
    );

    for (const file of files) {
        if (applied.has(file)) {
            continue;
        }
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        database.exec(sql);
        database.run(
            'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
            [file, new Date().toISOString()]
        );
    }
}

export function closeDatabase(): void {
    if (db) {
        persistDatabase();
        db.close();
        db = undefined;
        SQL = undefined;
        workspaceIdCache = undefined;
        workspaceRootCache = undefined;
        dbPathCache = undefined;
    }
}
