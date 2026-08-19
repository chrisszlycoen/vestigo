import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
    closeDatabase,
    computeWorkspaceId,
    getDatabase,
    getVestigoDir,
    initializeDatabase,
} from '../../src/db/database';
import {
    createMemory,
    getMemoriesForFile,
    markMemoryOutdated,
    updateMemoryContent,
} from '../../src/db/queries';

const tmpRoot = path.join('/tmp', 'opencode', 'vestigo-db-test');

function cleanTmp(): void {
    if (fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
}

async function run(): Promise<void> {
    cleanTmp();
    fs.mkdirSync(tmpRoot, { recursive: true });

    const workspaceId = computeWorkspaceId(tmpRoot);
    const db = await initializeDatabase(tmpRoot);

    assert.strictEqual(getVestigoDir(tmpRoot), path.join(tmpRoot, '.vestigo'));
    assert.strictEqual(getDatabase(), db);

    const memory = createMemory(db, {
        workspace_id: workspaceId,
        file_path: 'src/auth.ts',
        line_start: 42,
        content: 'Test memory content',
        source_type: 'manual',
    });

    assert.strictEqual(memory.file_path, 'src/auth.ts');
    assert.strictEqual(memory.content, 'Test memory content');
    assert.strictEqual(memory.source_type, 'manual');

    const memories = getMemoriesForFile(db, workspaceId, 'src/auth.ts');
    assert.strictEqual(memories.length, 1);
    assert.strictEqual(memories[0].content, 'Test memory content');

    updateMemoryContent(db, memory.id, 'Updated content');
    const updated = getMemoriesForFile(db, workspaceId, 'src/auth.ts');
    assert.strictEqual(updated[0].content, 'Updated content');

    markMemoryOutdated(db, memory.id, true);
    const outdated = getMemoriesForFile(db, workspaceId, 'src/auth.ts');
    assert.strictEqual(outdated[0].is_outdated, 1);

    closeDatabase();
    cleanTmp();

    console.log('Database integration tests passed');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
