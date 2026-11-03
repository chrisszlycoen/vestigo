import * as fs from 'fs';
import * as path from 'path';
import { log } from './logger';

export function ensureGitignoreEntry(workspaceRoot: string): void {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const entry = '.vestigo/';

    try {
        let content = '';
        if (fs.existsSync(gitignorePath)) {
            content = fs.readFileSync(gitignorePath, 'utf8');
            const lines = content.split(/\r?\n/);
            if (lines.some((line) => line.trim() === entry)) {
                return;
            }
        }

        const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
        fs.writeFileSync(gitignorePath, `${content}${prefix}${entry}\n`, 'utf8');
        log('Added .vestigo/ to .gitignore');
    } catch (err) {
        log(`Failed to update .gitignore: ${err instanceof Error ? err.message : String(err)}`);
    }
}
