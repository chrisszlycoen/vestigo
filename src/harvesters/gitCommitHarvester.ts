import * as vscode from 'vscode';
import { simpleGit } from 'simple-git';
import { getDatabase, getWorkspaceId } from '../db/database';
import { createMemory, findMemoryBySource } from '../db/queries';
import { log } from '../utils/logger';
import { normalizeFilePath } from '../utils/pathUtils';

interface ParsedCommit {
    hash: string;
    body: string;
}

export async function harvestGitCommits(workspaceRoot: string): Promise<void> {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
        return;
    }

    const config = vscode.workspace.getConfiguration('vestigo');
    const lookbackDays = config.get<number>('harvest.commitLookbackDays') ?? 365;
    const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

    const git = simpleGit(workspaceRoot);
    const logOutput = await git.raw([
        'log',
        `--since=${since}`,
        '--format=%H%n%B%n---COMMIT_END---',
        '--diff-filter=M',
    ]);

    const commits = parseCommitLog(logOutput);
    log(`Found ${commits.length} commits with bodies`);

    const db = getDatabase();
    let storedCount = 0;

    for (const commit of commits) {
        const files = await getCommitFiles(git, commit.hash);
        for (const file of files) {
            const filePath = normalizeFilePath(file);
            const existing = findMemoryBySource(db, workspaceId, 'commit', commit.hash, filePath);
            if (existing) {
                continue;
            }
            createMemory(db, {
                workspace_id: workspaceId,
                file_path: filePath,
                content: commit.body,
                source_type: 'commit',
                source_ref: commit.hash,
                source_url: undefined,
            });
            storedCount++;
        }
    }

    log(`Stored ${storedCount} commit memories`);
}

function parseCommitLog(logOutput: string): ParsedCommit[] {
    const commits: ParsedCommit[] = [];
    const blocks = logOutput.split('---COMMIT_END---');
    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) {
            continue;
        }
        const newlineIndex = trimmed.indexOf('\n');
        if (newlineIndex === -1) {
            continue;
        }
        const hash = trimmed.slice(0, newlineIndex).trim();
        const body = trimmed.slice(newlineIndex + 1).trim();
        if (hash && body.length > 0) {
            commits.push({ hash, body });
        }
    }
    return commits;
}

async function getCommitFiles(git: ReturnType<typeof simpleGit>, hash: string): Promise<string[]> {
    const output = await git.raw(['show', '--name-only', '--format=', hash]);
    return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}
