import * as assert from 'assert';
import { parseGitHubRemote } from '../../src/utils/gitUtils';

export function run(): void {
    assert.deepStrictEqual(parseGitHubRemote('git@github.com:vestigo-extension/vestigo.git'), {
        owner: 'vestigo-extension',
        repo: 'vestigo',
    });
    assert.deepStrictEqual(parseGitHubRemote('https://github.com/vestigo-extension/vestigo.git'), {
        owner: 'vestigo-extension',
        repo: 'vestigo',
    });
    assert.deepStrictEqual(parseGitHubRemote('https://github.com/vestigo-extension/vestigo'), {
        owner: 'vestigo-extension',
        repo: 'vestigo',
    });
    assert.strictEqual(parseGitHubRemote('git@gitlab.com:foo/bar.git'), undefined);

    console.log('Parser unit tests passed');
}

run();
