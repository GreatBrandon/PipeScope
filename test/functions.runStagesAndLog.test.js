const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { runStagesAndLog, splitStages, setWorkDir } = require('../src/functions.js');

before(() => {
    setWorkDir(__dirname);
});

describe('Run multistage command: ', () => {
    const testCases = [
        ["grep -F ERROR app.log | cut -d ' ' -f 2 | sort | uniq -c", [
            'ERROR payments Card declined\r\nERROR payments Connection timeout\r\nERROR accounts Invalid password\r\n',
            'payments\npayments\naccounts\n',
            'accounts\npayments\npayments\n',
            '      1 accounts\n      2 payments\n'
        ]],
        ["head -n 5 app2.log | tr [A-Z] [a-z] | wc -c", [
            'ERROR\r\nERROR\r\nINFO\r\nDEBUG\r\nDEBUG\r\n',
            'error\r\nerror\r\ninfo\r\ndebug\r\ndebug\r\n',
            '34\n'
        ]],
        ['cat app2.log | tr [A-Z] [a-z]', [
            'ERROR\r\nERROR\r\nINFO\r\nDEBUG\r\nDEBUG\r\nINFO',
            'error\r\nerror\r\ninfo\r\ndebug\r\ndebug\r\ninfo'
        ]], // tr
        ["grep DEBUGG app.log | cut -d ' ' -f 2 | sort | uniq -c", [''], [1]], // check it breaks early with invalid commands
        ["head -n 1 app2.log | grep DEBUG | wc -c", ['ERROR\r\n', ''], [0,1]]
    ];

    testCases.forEach(([input, expected, expectedCode]) => {
        test(`Run pipeline ${input}`, async () => {
            const stages = splitStages(input); // assumes this works, tested elsewhere already
            const result = await runStagesAndLog(stages);

            let expectedI = 0;
            result.stages.forEach((res, i) => {
                assert.strictEqual(expectedI, i);
                expectedI++;

                if (expectedCode === undefined) eCode = 0;
                else eCode = expectedCode[i];

                assert.strictEqual(res.out, expected[i]);
                assert.strictEqual(res.err, '');
                assert.strictEqual(res.code, eCode);
            });
        });
    });
});