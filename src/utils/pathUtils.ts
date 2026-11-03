import * as path from 'path';

export function relativeToWorkspace(absolutePath: string, workspaceRoot: string): string {
    return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
}

export function normalizeFilePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function isInsideWorkspace(absolutePath: string, workspaceRoot: string): boolean {
    const rel = path.relative(workspaceRoot, absolutePath);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
}
