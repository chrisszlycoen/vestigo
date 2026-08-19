import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
    if (!channel) {
        channel = vscode.window.createOutputChannel('Vestigo');
    }
    return channel;
}

export function log(message: string): void {
    const ch = getOutputChannel();
    ch.appendLine(`[${new Date().toISOString()}] ${message}`);
}

export function warn(message: string): void {
    log(`WARN: ${message}`);
}

export function error(message: string, err?: unknown): void {
    log(`ERROR: ${message}`);
    if (err instanceof Error) {
        log(err.stack ?? err.message);
    } else if (err !== undefined) {
        log(String(err));
    }
}
