const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { runStage, splitStages, setWorkDir } = require("../src/functions");
const { getSourceRecords, getInitialSourceRecords } = require("../src/tracing");

async function testPipelines(pipelines) {
    pipelines.forEach((pipeline) => {
        test(`Run pipeline: ${pipeline}`, async () => {
            const stages = splitStages(pipeline);
            const results = [];
            let input = '';
            for (const stage of stages) {
                const result = await runStage(stage, input);
                results.push({ cmd: stage.join(' '), ...result });
                if (result.code !== 0) {
                    console.log('stage failed');
                    return;
                }
                input = result.out;
                if (input !== '') {
                    getSourceRecords(stage, results)
                } else {
                    results[results.length - 1].warn = 'skipped due to no output';
                }
            }
            for (const r of results) {
                if (r.warn) {
                    console.log(r.warn);
                    if (!r.lineNums) continue; // dont throw if empty lineNums
                }
                for (let i = 0; i < r.lineNums.length; i++) {
                    console.log(r.filenames[i] + ':' + r.lineNums[i]);
                }
                console.log();
            }
        });
    });
}

before(() => {
    setWorkDir(__dirname);
});

describe('Test ls tracing', () => {
    const pipelines = [
        'ls -l',
        'ls -l | ls',
    ];
    testPipelines(pipelines);
});

describe('Test echo tracing', () => {
    const pipelines = [
        String.raw`echo Hello world`,
        String.raw`echo -e Hello world\nI am\nmultiple lines | echo -e "New text\nOverwritten\nHi"`,
        String.raw`echo Hello world\nI am\nmultiple lines | echo "New text\nOverwritten\nHi"`,
    ];
    testPipelines(pipelines);
});

describe('Test head tracing', () => {
    const pipelines = [
        'ls -l | head -n 2',
        'ls -l | head -n -2',
        'ls -l | head -c -30 app.log',
        'ls -l | head -c -30 app.log - app2.log',
        'head',
        'head app.log',
        'head -2 app.log',
        'head -2 app.log | head app.log - app2.log',
        'head -2 app.log | head app.log app2.log',
        'head -c -30 app.log app2.log',
        'head -q app.log app2.log' // produces dummy output for now
    ];
    testPipelines(pipelines);
});