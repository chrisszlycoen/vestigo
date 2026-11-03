import * as fs from 'fs';
import * as path from 'path';
import { simpleGit, SimpleGit } from 'simple-git';
import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId, initializeDatabase } from '../db/database';
import { setWorkspaceSettings } from '../db/queries';
import { harvestGitCommits } from '../harvesters/gitCommitHarvester';
import { harvestGithubPRs } from '../harvesters/githubPRHarvester';
import { parseGitHubRemote } from '../utils/gitUtils';
import { log, warn } from '../utils/logger';

let activeGit: SimpleGit | undefined;
let fetchHeadWatcher: fs.StatWatcher | undefined;

export function getGitInstance(): SimpleGit | undefined {
    return activeGit;
}

export async function initializeGitWatcher(
    context: vscode.ExtensionContext,
    workspaceRoot: string
): Promise<void> {
    activeGit = simpleGit(workspaceRoot);

    const isRepo = await activeGit.checkIsRepo();
    if (!isRepo) {
        warn(`Workspace is not a git repository: ${workspaceRoot}`);
        return;
    }

    await initializeDatabase(workspaceRoot);
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
        throw new Error('Workspace ID not initialized');
    }

    const remotes = await activeGit.getRemotes(true);
    const origin = remotes.find((r) => r.name === 'origin') || remotes[0];
    if (origin?.refs?.fetch) {
        const parsed = parseGitHubRemote(origin.refs.fetch);
        if (parsed) {
            const db = getDatabase();
            setWorkspaceSettings(db, workspaceId, {
                github_owner: parsed.owner,
                github_repo: parsed.repo,
            });
            log(`Detected GitHub repository: ${parsed.owner}/${parsed.repo}`);
        }
    }

    await runHarvesters(context, workspaceRoot);

    const fetchHeadPath = path.join(workspaceRoot, '.git', 'FETCH_HEAD');
    if (fs.existsSync(fetchHeadPath)) {
        watchFetchHead(fetchHeadPath, context, workspaceRoot);
    }
}

async function runHarvesters(context: vscode.ExtensionContext, workspaceRoot: string): Promise<void> {
    log('Starting memory harvest...');
    try {
        await harvestGithubPRs(context, workspaceRoot);
    } catch (err) {
        warn(`GitHub PR harvest failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
        await harvestGitCommits(workspaceRoot);
    } catch (err) {
        warn(`Git commit harvest failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    log('Memory harvest complete');
}

function watchFetchHead(
    fetchHeadPath: string,
    context: vscode.ExtensionContext,
    workspaceRoot: string
): void {
    if (fetchHeadWatcher) {
        fetchHeadWatcher.removeAllListeners();
    }

    let lastMtime: number | undefined;
    try {
        lastMtime = fs.statSync(fetchHeadPath).mtimeMs;
    } catch {
        // ignore
    }

    fetchHeadWatcher = fs.watchFile(fetchHeadPath, { interval: 2000 }, async (curr) => {
        if (!curr.isFile()) {
            return;
        }
        if (lastMtime !== undefined && curr.mtimeMs === lastMtime) {
            return;
        }
        lastMtime = curr.mtimeMs;
        log('Detected git fetch/pull, re-harvesting PR memories');
        try {
            await harvestGithubPRs(context, workspaceRoot);
        } catch (err) {
            warn(`Post-pull harvest failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
}

export function disposeGitWatcher(): void {
    if (fetchHeadWatcher) {
        fetchHeadWatcher.removeAllListeners();
        fetchHeadWatcher = undefined;
    }
    activeGit = undefined;
}

