const path = require('path');
const fs = require('fs');
const { runTests } = require('@vscode/test-electron');

function ensureTestWorkspace(workspacePath) {
    fs.mkdirSync(workspacePath, { recursive: true });
    const gitDir = path.join(workspacePath, '.git');
    if (!fs.existsSync(gitDir)) {
        require('child_process').execSync('git init', { cwd: workspacePath });
        fs.writeFileSync(path.join(workspacePath, 'app.js'), "console.log('hello');\n");
        require('child_process').execSync('git add .', { cwd: workspacePath });
        require('child_process').execSync(
            'git -c user.email=test@test.com -c user.name=Test commit -m init',
            { cwd: workspacePath }
        );
    }
}

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '..');
        const extensionTestsPath = path.resolve(__dirname, 'suite', 'index');
        const workspacePath = path.resolve(__dirname, '..', 'test-workspace');

        ensureTestWorkspace(workspacePath);

        const cachedEditor = path.join(extensionDevelopmentPath, '.vscode-test', 'vscode-linux-x64-1.127.0', 'code');
        await runTests({
            ...(fs.existsSync(cachedEditor) ? { vscodeExecutablePath: cachedEditor } : {}),
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [workspacePath, '--disable-extensions', '--no-sandbox', '--disable-gpu', '--skip-welcome', '--skip-release-notes'],
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
