const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { runStage, splitStages, setWorkDir } = require("../src/functions");
const { getSourceRecords, getInitialSourceRecords } = require("../src/tracing");

before(() => {
    setWorkDir(__dirname);
});

describe('Test tracing', async () => {
    const pipelines = [
        'ls -l | ls', 
        String.raw`echo -e Hello world\nI am\nmultiple lines | echo -e "New text\nOverwritten\nHi"`
    ];

    pipelines.forEach((pipeline) => {
        test(`Run pipeline: ${pipeline}`, async () => {
            const stages = splitStages(pipeline);
            const results = [];
            let firstStage = true;
            for (const stage of stages) {
                const result = await runStage(stage, '');
                results.push({ cmd: stage.join(' '), ...result });
                if (result.code !== 0) {
                    console.log('stage failed');
                    return;
                }
                console.log(JSON.stringify(result.out));
                if (firstStage) {
                    getInitialSourceRecords(stage, results);
                    firstStage = false;
                } else {
                    getSourceRecords(stage, results);
                }
            }
            for (const r of results) {
                if (r.warn) {
                    console.log(r.warn);
                }
                for (let i = 0; i < r.lineNums.length; i++) {
                    console.log(r.filenames[i] + ':' + r.lineNums[i]);
                }
            }
            assert.strictEqual(0,0); // dummy
        });
    });
});