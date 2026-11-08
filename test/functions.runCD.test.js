const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { runCD, getWorkDir, setWorkDir } = require('../src/functions.js');

describe('Run CD command tests: ', () => {
    const testCases = [
        [['cd'], 'Invalid CD usage'],
        [['cd', './', './'], 'Invalid CD usage'],
        [['cd', './nonExistentDir'], 'Path does not exist'],
        [['cd', './app.log'], 'Path is not a directory'],
        [['cd', './testFolder/testFile.log'], 'Path is not a directory'],
        [['cd', './testFolder']],
        [['cd', '../']],
        [['cd', '../src']],
        [['cd', '/']],
        [['cd', '~']],
        [['cd', '~/']],
        [['cd', './']]
        // no need to test invalid command usage as it's parsed and caught before getting here
    ];

    let cwd;
    before(() => {
        cwd = getWorkDir();
    });

    beforeEach(() => {
        setWorkDir(cwd);
    });

    testCases.forEach(([input, expectedError = null]) => {
        test(`${input}`, async () => {
            const result = runCD(input);
            if (expectedError == null) {
                const setPath = getWorkDir();
                assert.strictEqual(result.cwdPath, setPath);
            }
            assert.strictEqual(result.cwdError, expectedError);
        });
    });
});