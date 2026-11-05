const assert = require('assert');
const vscode = require('vscode');

suite('Extension Test Suite', () => {
    test('Extension activates and commands are registered', async () => {
        const ext = vscode.extensions.getExtension('vestigo.vestigo');
        assert.ok(ext, 'Extension should be found');
        await ext.activate();
        const commands = await vscode.commands.getCommands(true);
        console.log('Available vestigo commands:', commands.filter(c => c.startsWith('vestigo.')));
        assert.ok(commands.includes('vestigo.addNote'), 'addNote command should be registered');
        assert.ok(commands.includes('vestigo.setGithubPat'), 'setGithubPat command should be registered');
        assert.ok(commands.includes('vestigo.findCode'), 'findCode command should be registered');
        assert.ok(commands.includes('vestigo.showTimeline'), 'showTimeline command should be registered');
        assert.ok(commands.includes('vestigo.refreshSidebar'), 'refreshSidebar command should be registered');
        for (const command of ['copyProjectContext', 'recordWork', 'exportProjectContext', 'connectAgent']) {
            assert.ok(commands.includes(`vestigo.${command}`), `${command} should be registered`);
        }
    });

    test('project context is available without an AI account or saved memories', async () => {
        await vscode.commands.executeCommand('vestigo.copyProjectContext');
        const context = JSON.parse(await vscode.env.clipboard.readText());
        assert.ok(context.project.name);
        assert.ok(context.estimatedTokens <= context.tokenBudget);
        assert.ok(Array.isArray(context.memories));
    });

    test('agent connection instructions use the packaged server', async () => {
        await vscode.commands.executeCommand('vestigo.connectAgent');
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor);
        const instructions = editor.document.getText();
        assert.ok(instructions.includes('out/agent/server.js'));
        assert.ok(instructions.includes('get_project_brief'));
        assert.ok(instructions.includes('record_work'));
    });

    test('the sidebar resolves without extension host errors', async () => {
        await vscode.commands.executeCommand('vestigo.memorySidebar.focus');
        await vscode.commands.executeCommand('vestigo.refreshSidebar');
    });
});
