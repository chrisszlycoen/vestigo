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
    });
});
