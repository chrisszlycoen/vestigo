import * as vscode from 'vscode';
import { getDatabase, getWorkspaceId } from '../db/database';
import { createMemory, findMemoryBySource, getWorkspaceSettings, setWorkspaceSettings } from '../db/queries';
import { GITHUB_PAT_SECRET_KEY } from '../utils/constants';
import { log, warn } from '../utils/logger';
import { normalizeFilePath } from '../utils/pathUtils';

interface GithubPR {
    number: number;
    body: string | null;
    html_url: string;
    merged_at: string | null;
    state: string;
}

interface PRFile {
    filename: string;
    status: string;
}

export async function harvestGithubPRs(
    context: vscode.ExtensionContext,
    _workspaceRoot: string
): Promise<void> {
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
        return;
    }

    const pat = await context.secrets.get(GITHUB_PAT_SECRET_KEY);
    if (!pat) {
        log('No GitHub PAT configured; skipping PR harvest.');
        return;
    }

    const db = getDatabase();
    const settings = getWorkspaceSettings(db, workspaceId);
    if (!settings?.github_owner || !settings?.github_repo) {
        log('GitHub owner/repo not detected; skipping PR harvest.');
        return;
    }

    const config = vscode.workspace.getConfiguration('vestigo');
    const maxPRs = config.get<number>('harvest.maxPRs') ?? 50;

    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
    };

    const prs = await fetchClosedPRs(settings.github_owner, settings.github_repo, maxPRs, headers);
    log(`Found ${prs.length} closed PRs`);

    let storedCount = 0;
    for (const pr of prs) {
        if (!pr.merged_at || !pr.body || pr.body.trim().length === 0) {
            continue;
        }

        const files = await fetchPRFiles(
            settings.github_owner,
            settings.github_repo,
            pr.number,
            headers
        );

        for (const file of files) {
            if (file.status === 'removed') {
                continue;
            }
            const filePath = normalizeFilePath(file.filename);
            const existing = findMemoryBySource(db, workspaceId, 'pr', String(pr.number), filePath);
            if (existing) {
                continue;
            }
            createMemory(db, {
                workspace_id: workspaceId,
                file_path: filePath,
                content: pr.body.trim(),
                source_type: 'pr',
                source_ref: String(pr.number),
                source_url: pr.html_url,
            });
            storedCount++;
        }
    }

    setWorkspaceSettings(db, workspaceId, { last_pr_sync: new Date().toISOString() });
    log(`Stored ${storedCount} PR memories`);
}

async function fetchClosedPRs(
    owner: string,
    repo: string,
    perPage: number,
    headers: Record<string, string>
): Promise<GithubPR[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${perPage}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
    }
    return (await response.json()) as GithubPR[];
}

async function fetchPRFiles(
    owner: string,
    repo: string,
    pullNumber: number,
    headers: Record<string, string>
): Promise<PRFile[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        warn(`Failed to fetch files for PR #${pullNumber}: ${response.status}`);
        return [];
    }
    return (await response.json()) as PRFile[];
}
