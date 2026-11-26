const fs = require('fs');
const path = require('path');
const yargsParser = require('yargs-parser');
const { getWorkDir } = require('./functions');

const parserArgs = {
    configuration: {
        // 'parse-numbers': false,
        'boolean-negation': false,
        'dot-notation': false,
        'camel-case-expansion': false,
    }
};

const headParserArgs = {
    ...parserArgs, 
    boolean: ['q', 'v', 'z', 'h', 'V'],
    alias: {
        q: ['quiet', 'silent'],
        v: ['verbose'],
        z: ['zero-terminated'],
        h: ['help'],
        V: ['version'],
        c: ['bytes'],
        n: ['lines'],
    },
}


// count newlines in the first `limit` bytes of a file
function scanFile(file, workDir, limit = Infinity) {
    const p = path.resolve(workDir, file);
    const st = fs.statSync(p);
    if (!st.isFile()) return null;            // FIFO, /dev/zero, etc.
    const fd = fs.openSync(p, 'r');
    try {
        const buf = Buffer.alloc(1 << 16);
        const end = Math.min(st.size, limit);
        let pos = 0, newlines = 0, last = 10;
        while (pos < end) {
            const n = fs.readSync(fd, buf, 0, Math.min(buf.length, end - pos), pos);
            if (n === 0) break;
            for (let i = 0; i < n; i++) if (buf[i] === 10) newlines++;
            last = buf[n - 1];
            pos += n;
        }
        return { newlines, size: st.size, lastByte: last };
    } finally {
        fs.closeSync(fd);
    }
}

function getTotalLines(file, workDir) {
    const s = scanFile(file, workDir);
    if (!s) return null;
    return s.newlines + (s.size > 0 && s.lastByte !== 10 ? 1 : 0); // unterminated last line counts
}

function checkAndWarn(input, results) {
    if (input) {
        results[results.length - 1].warn = "Warn: ignoring stdin";
        return true;
    }
    return false;
}

// Normalizes args such as -1 into -n 1 (head and tail)
function normalizeArgs(args) {
    return args.map(arg => {
        if (/^-\d+$/.test(arg)) {
            return ['-n', arg.slice(1)];
        }
        return arg;
    }).flat();
}

function getSourceRecords(stage, results) {
    const [cmd, ...args] = stage;
    let input = null;
    if (results.length !== 1) {
        input = results[results.length - 2]; // get input from previous stage
    }
    switch (cmd) {
        case 'ls':
        case 'echo':
            checkAndWarn(input, results);
            traceLinesInOrder(cmd, results);
            break;
        case 'head':
            traceHead(args, results, input);
            break;
        case 'tail':
            traceTail(args, results, input);
            break;
        default:
            dummyRecords(results);
            break;
    }
}

// TODO remove after everything is done
function dummyRecords(results) {
    const latest = results[results.length - 1];
    let filenames = [];
    let lineNums = [];
    let lineNum = 1;
    const lines = latest.out.split('\n');
    for (const line of lines) {
        filenames.push('dummy');
        lineNums.push([lineNum++, line]);
    }
    latest.filenames = filenames;
    latest.lineNums = lineNums;
}

function traceLinesInOrder(cmd, results) {
    const latest = results[results.length - 1];
    let filenames = [];
    let lineNums = [];
    let lineNum = 1;
    const lines = latest.out.split('\n');
    for (const line of lines) {
        filenames.push(cmd);
        lineNums.push([lineNum++, line]);
    }
    latest.filenames = filenames;
    latest.lineNums = lineNums;
}

function traceHeadStdIn(results, input) {
    const latest = results[results.length - 1]
    const lines = latest.out.split('\n');
    latest.lineNums = input.lineNums.slice(0, lines.length);
    latest.filenames = input.filenames.slice(0, lines.length);
}

function traceHead(args, results, input) {
    const parsedArgs = yargsParser(normalizeArgs(args), headParserArgs);
    const inputs = parsedArgs._;

    if (inputs.length === 0) {
        if (input) {
            traceHeadStdIn(results, input);
        } else {
            throw new Error("Unsupported, empty input from stdin");
        }
        return;
    }
    if (inputs.length === 1) {
        if (inputs[0] !== '-') {
            checkAndWarn(input, results);
            traceLinesInOrder(inputs[0], results);
        } else {
            traceHeadStdIn(results, input);
        }
        return;
    }

    let quietMode = parsedArgs.q;
    let currentInputLine = 0;
    let currentHeadLine = 1;
    let currentTracedLine = 1; // 1 indexed
    let lineNums = [];
    let filenames = [];
    let ignoredStdIn = true;

    const latest = results[results.length - 1]
    const lines = latest.out.split('\n');

    for (let i = 0; i < inputs.length; i++) {
        if (quietMode) {
            latest.warn = 'Dummy results used'; // TODO
            dummyRecords(results);
            return;
        } else {
            const stdIn = inputs[i] === '-';
            if (stdIn) ignoredStdIn = false;
            const banner = stdIn ? '==> standard input <==' : '==> ' + inputs[i] + ' <==';
            const nextBanner = i+1 === inputs.length ? null : inputs[i+1] === '-' ? '==> standard input <==' : '==> ' + inputs[i+1] + ' <==';

            while (currentInputLine < lines.length) {
                if (lines[currentInputLine] === banner) {
                    lineNums.push([currentHeadLine++, banner]);
                    filenames.push('head');
                    currentTracedLine = 1;
                } else if (lines[currentInputLine] === nextBanner) {
                    // when running e.g. (head app.log app2.log) and app.log contains ==> app2.log <== ,
                    // it will get incorrectly flagged, that is a work in progress if it's even possible to detect
                    currentTracedLine = 1;
                    break;
                } else {
                    if (stdIn) {
                        lineNums.push(input.lineNums[currentTracedLine-1]);
                        filenames.push(input.filenames[currentTracedLine-1]);
                    } else {
                        lineNums.push([currentTracedLine, lines[currentInputLine]]);
                        filenames.push(inputs[i]);
                    }
                    currentTracedLine++;
                }
                currentInputLine++;
            }
        }
    };
    latest.lineNums = lineNums;
    latest.filenames = filenames;
    if (ignoredStdIn) latest.warn = 'Warn: ignoring stdin';
}

function traceTail(args, results, input) {

    // if (results == )
    traceFromBack(args, results);
}

function traceFromBack(args, results) {
    const latest = results[results.length - 1];
    let filenames = [];
    let lineNums = [];
    const parsedArgs = yargsParser(args, parserArgs);
    const f = parsedArgs._[0];
    const totalLines = getTotalLines(f, getWorkDir());
    const lines = latest.out.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    let lineNum = 1 - lines.length;

    for (const line of lines) {
        filenames.push(f);
        lineNums.push([totalLines+lineNum++, line]);
    }
    latest.lineNums = lineNums;
    latest.filenames = filenames;
}

module.exports = {
    getSourceRecords
}