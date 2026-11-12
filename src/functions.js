const { parse } = require('shell-quote');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { ALL } = require('dns');
const HOMEDIR = require('os').homedir()

const ALLOWED = new Set(['cat', 'grep', 'cut', 'sort', 'uniq', 'head', 'tail', 'wc', 'tr', 'ls', 'pwd', 'cowsay', 'sed', 'find', 'echo']);

let workDir = process.cwd(); // folder PipeScope was launched from

// parse the pipeline into stages using a built in shell parser
function splitStages(text) {
    const stages = [[]];
    let pipe = false;
    for (const tok of parse(text)) {
        if (typeof tok === 'string') {
            stages[stages.length - 1].push(tok);
            pipe = false;
        } else if (tok.op === '|') {
            stages.push([]);
            pipe = true;
        } else throw new Error(`Unsupported syntax: ${tok.op || 'expression'}`);
    }
    if (pipe) {
        throw new Error(`Unsupported syntax: last token is pipe`);
    }
    return stages;
}

// run a shell command given some input and return the output
function runStage([cmd, ...args], input) {
    return new Promise(resolve => {
        if (!ALLOWED.has(cmd)) return resolve({ out: '', err: `Unsupported command: ${cmd}`, code: 127 });

        if (cmd === 'find') {
            let hasExec = null;
            for (const arg of args) {
                if (arg === '-exec' || arg === '-execdir') {
                    hasExec = arg;
                } else if (hasExec) {
                    // rejects malicious find commands
                    if (!ALLOWED.has(arg)) return resolve({ out: '', err: `Unsupported ${hasExec} command: ${arg}`, code: 127 });
                    hasExec = null;
                }
            };
        }

        const p = spawn(cmd, args, { cwd: workDir, timeout: 5000 }); // execute command, do not use shell=True, execute directly instead of through a shell
        let out = '', err = '';

        // TODO: truncate output and error properly in case some huge file comes along and eats all the RAM
        p.stdout.on('data', d => { out += d; }); // listen to stdout
        p.stderr.on('data', d => { err += d; }); // listen to stderr

        p.on('error', e => resolve({ out, err: e.message, code: 1 })); // if error
        p.on('close', code => resolve({ out, err, code })); // if stdout closed

        p.stdin.on('error', e => { // if stdin error
            if (e.code !== 'EPIPE') { // Ignore EPIPE errors, some commands close stdin early and cause this (e.g. head, tail)
                return resolve({ out: '', err: e.message, code: -1 })
            }
        });
        p.stdin.end(input); // send input to stdin
    });
}

// check and run a CD command
function runCD(cmd) {
    let cwdError = null;
    let cwdPath = null;
    
    try {
        if (cmd.length != 2) {
            cwdError = "Invalid CD usage";
        } else {
            const target = cmd[1];
            var newDir;
            if (target === '~') {
                newDir = HOMEDIR;
            } else if (target.startsWith('~/')) {
                newDir = path.resolve(HOMEDIR, target.slice(2));
            } else {
                newDir = path.resolve(workDir, target);
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

// run each stage separately and log the output
async function runStagesAndLog(stages) {
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

// Unfiltered, only use for manually changing workdir for tests
function setWorkDir(newWorkDir) {
    workDir = newWorkDir;
}

// Export functions
module.exports = {
    splitStages,
    runStage,
    runCD,
    runStagesAndLog,
    getWorkDir: () => workDir,
    setWorkDir,
};