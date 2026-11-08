const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { runStage } = require('../src/functions.js');

describe('Unsupported commands tests: ', () => {
    const testCases = [
        [['rm'], 'rm'],
        [['sudo'], 'sudo'],
        [['mkdir', 'test'], 'mkdir'],
        [['sudo', 'ls'], 'sudo'],
        [['cd'], 'cd'],
        [['cd', '../'], 'cd'],
        [['cd', '~'], 'cd']
    ];

    testCases.forEach(([input, expectedError]) => {
        test(`rejects unsupported command: ${input}`, async () => {
            const result = await runStage(input);
            assert.strictEqual(result.out, '');
            assert.strictEqual(result.err, `Unsupported command: ${expectedError}`);
            assert.strictEqual(result.code, 127);
        });
    });
});

describe('Run commands tests:', () => {
    const testCases = [
        // Below commands have no error messages or codes
        [['cat', 'app.log'], 'ERROR payments Card declined\r\nINFO accounts User signed in\r\nERROR payments Connection timeout\r\nERROR accounts Invalid password\r\n', '', 0], // cat
        [['head', '-n', '1', 'app.log'], 'ERROR payments Card declined\r\n'], // head
        [['tail', '-n', '1', 'app.log'], 'ERROR accounts Invalid password\r\n'], // tail
        [['grep', '-F', 'ERROR', 'app.log'], 'ERROR payments Card declined\r\nERROR payments Connection timeout\r\nERROR accounts Invalid password\r\n'], // grep
        [['cut', '-d', ' ', '-f', '1', 'app.log'], 'ERROR\nINFO\nERROR\nERROR\n'], // cut
        [['sort', 'app2.log'], 'DEBUG\r\nDEBUG\r\nERROR\r\nERROR\r\nINFO\nINFO\r\n'], // sort
        [['uniq', 'app2.log'], 'ERROR\r\nINFO\r\nDEBUG\r\nINFO\n'], // uniq
        [['wc', '-l', 'app.log'], '4 app.log\n'], // wc
        // ls and pwd skipped as those change depending on user's PC and files in test folder

        // Below commands have error messages and/or error codes
        [['cat', 'fakefile.log'], '', 'cat: fakefile.log: No such file or directory\n', 1],
        [['grep', '[', 'fakefile.log'], '', 'grep: Invalid regular expression\n', 2],
        [['sort', 'fakefile.log'], '', 'sort: cannot read: fakefile.log: No such file or directory\n', 2],
        [['uniq', 'fakefile.log'], '', 'uniq: Could not open fakefile.log: No such file or directory\n', 1],
        [['head', '-n', 'invalid'], '', 'head: invalid number of lines: \'invalid\'\n', 1],
        [['tail', '-n', 'invalid'], '', 'tail: invalid number of lines: \'invalid\'\n', 1],
        [['wc', 'fakefile.log'], '', 'wc: fakefile.log: No such file or directory\n', 1],
        [['cut', '-f', 'invalid'], '', "cut: range 'invalid' was invalid: failed to parse range\n", 1],
        [['grep', '-F', 'DEBUGGG', 'app.log'], '', '', 1] // empty grep returns error 1
    ];

    testCases.forEach(([input, expectedOut, expectedError = '', expectedCode = 0]) => {
        test(`Run command: ${input}`, async () => {
            const result = await runStage(input);
            assert.strictEqual(result.out, expectedOut);
            assert.strictEqual(result.err, expectedError);
            assert.strictEqual(result.code, expectedCode);
        });
    });
});

describe('Run piped commands test:', () => {
    const testCases = [
        [['cat', 'app2.log'], ['tr', '[A-Z]', '[a-z]'], 'error\r\nerror\r\ninfo\r\ndebug\r\ndebug\r\ninfo'] // tr
    ];

    testCases.forEach(([cmd1, cmd2, expectedOut, expectedError = '', expectedCode = 0]) => {
        test(`Run command: ${cmd2}`, async () => {
            const res1 = await runStage(cmd1);
            const input = res1.out;
            const result = await runStage(cmd2, input);
            assert.strictEqual(result.out, expectedOut);
            assert.strictEqual(result.err, expectedError);
            assert.strictEqual(result.code, expectedCode);
        });
    })
});

// TODO
describe('Find and sed tests:', () => {
    test('Find and sed test', {todo: true})
})