const { parse } = require('shell-quote');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const HOMEDIR = require('os').homedir()

const ALLOWED = new Set(['cat', 'grep', 'cut', 'sort', 'uniq', 'head', 'tail', 'wc', 'tr', 'cd', 'ls', 'pwd', 'cowsay', 'sed', 'find']);

let workDir = process.cwd(); // folder PipeScope was launched from

// parse the pipeline into stages using a built in shell parses
function splitStages(text) {
    const stages = [[]];
    for (const tok of parse(text)) {
        if (typeof tok === 'string') stages[stages.length - 1].push(tok);
        else if (tok.op === '|') stages.push([]);
        else throw new Error(`Unsupported syntax: ${tok.op || 'expression'}`);
    }
    return stages;
}

// run a shell command given some input and return the output
function runStage([cmd, ...args], input) {
    return new Promise(resolve => {
        if (!ALLOWED.has(cmd)) return resolve({ out: '', err: `Unsupported command: ${cmd}`, code: 127 });
        const p = spawn(cmd, args, { cwd: workDir, timeout: 5000 });
        let out = '', err = '';
        p.stdout.on('data', d => { if (out.length < 1e6) out += d; });
        p.stderr.on('data', d => { if (err.length < 1e4) err += d; });
        p.on('error', e => resolve({ out, err: e.message, code: 1 }));
        p.on('close', code => resolve({ out, err, code }));
        p.stdin.on('error', () => {});          // ignore EPIPE if the command exits early
        p.stdin.end(input);
    });
}

function runCD(stages) {
    let cwdError = null;
    let cwdPath = null;
    
    try {
        if (stages.length != 1 || stages[0].length != 2) {
            cwdError = "Invalid CD usage";
        } else {
            const target = stages[0][1];
            var newDir;
            if (target === '~') {
                newDir = HOMEDIR;
            } else if (target.startsWith('~/')) {
                newDir = path.resolve(HOMEDIR, target.slice(2));
            } else {
                newDir = path.resolve(workDir, stages[0][1]);
            }
            if (fs.existsSync(newDir)) {
                if (fs.statSync(newDir).isDirectory()) {
                    workDir = newDir;
                    cwdPath = newDir;
                } else {
                    cwdError = "Path is not a directory";
                }
            } else {
                cwdError = "Path does not exist";
            }
        }
    } catch (e) {
        cwdError = e.message;
    }
    return { cwdError, cwdPath };
}

async function runStagesAndLog(stages) {
    // run each stage separately and log the output
    const results = [];
    let input = '';
    for (const stage of stages) {
        const result = await runStage(stage, input);
        results.push({ cmd: stage.join(' '), ...result });
        if (result.code !== 0) break;
        input = result.out;
    }
    return {stages: results}
}

// Export functions
module.exports = {
    splitStages,
    runStage,
    runCD,
    runStagesAndLog,
    getWorkDir: () => workDir
};