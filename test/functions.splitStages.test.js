const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { splitStages } = require('../src/functions.js');

describe('Command parser tests:', () => {
    const testCases = [
        ['ls', [['ls']]], // single command no args
        ['ls | sort', [['ls'], ['sort']]], // 2 commands no args
        ['ls -l | sort', [['ls', '-l'], ['sort']]], // 2 cmd mixed args
        ["grep -F ERROR app.log | cut -d ' ' -f 2 | sort | uniq -c", [['grep', '-F', 'ERROR', 'app.log'], ['cut', '-d', ' ', '-f', '2'], ['sort'], ['uniq', '-c']]], // long command many args,
        ['', [[]]], // no command
        ['cat grep ls app.log out.txt', [['cat', 'grep', 'ls', 'app.log', 'out.txt']]], // some invalid command
        ['cd', [['cd']]], // cd
        ['cd ~/Desktop', [['cd', '~/Desktop']]], // cd with ~
        ['cd ../../ | ls', [['cd', '../../'], ['ls']]], // cd with relative
        ['cat "./file with spaces.txt"', [['cat', './file with spaces.txt']]], // parse "" properly
        ['cat app2.log | tr [A-Z] [a-z]', [['cat', 'app2.log'], ['tr', '[A-Z]', '[a-z]']]], // parse [] properly
        [String.raw`cat ./file\ with\ spaces.txt`, [['cat', './file with spaces.txt']]] // parse backslash properly for file names, String.raw only used here for testing, backslashes go through fine in a HTML form
    ];

    testCases.forEach(([input, expected]) => {
        test(`${input} returns ${expected}`, () => {
            assert.deepStrictEqual(splitStages(input), expected);
        });
    });
});


describe('Unsupported syntax tests:', () => {
    const testCases = [
        ['ls > output.txt', '>'],
        ['ls < input.txt', '<'],
        ['ls && pwd', '&&'],
        ['ls ; pwd', ';'],
        ['ls || grep', '||'],
        ['|', 'last token is pipe'],
        ['ls |', 'last token is pipe']
    ];

    testCases.forEach(([input, expectedError]) => {
        test(`rejects unsupported syntax: ${input}`, () => {
            assert.throws(() => splitStages(input), { message: `Unsupported syntax: ${expectedError}` });
        });
    });
});