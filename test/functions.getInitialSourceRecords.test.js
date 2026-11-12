const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { getInitialSourceRecords, setWorkDir, splitStages } = require('../src/functions.js');

before(() => {
    setWorkDir(__dirname);
});

describe("Get initial source records and line nums tests:", () => {
    const testCases = [
        ['ls -1 ./testFolder', [[1, 'testFile.log'], [2, 'testFile2.log']]],
        ['echo Hello World', [[1,'Hello World']]],
        ["find -type f -name '*.log' -exec wc -l {} +", [[1,'  4 ./app.log'],[2,'  5 ./app2.log'],[3,'  0 ./testFolder/testFile.log'],[4,'  2 ./testFolder/testFile2.log'],[5,' 11 total']]],
        ['head -n 2 app.log', [[1,'ERROR payments Card declined\r'], [2, 'INFO accounts User signed in\r']]],
    ];

    testCases.forEach(([input, expected]) => {
        test(`Run initial command: ${input}`, async () => {
            const stages = splitStages(input);
            const results = [];
            await getInitialSourceRecords(stages[0], results);
            const res = results[0];
            assert.deepStrictEqual(res.lineNums, expected);
        });
    });
});