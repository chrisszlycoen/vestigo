const path = require('path');
const fs = require('fs');
const { runTests } = require('@vscode/test-electron');

function ensureTestWorkspace(workspacePath) {
    if (fs.existsSync(workspacePath)) {
        return;
    }
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

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [workspacePath, '--disable-extensions'],
        });
    } catch (err) {
        console.error('Failed to run tests', err);
        process.exit(1);
    }
}

main();
