function getSourceRecords(stage, results) {
    const [cmd, ...args] = stage;
    const input = results[results.length - 2]; // get input from previous stage
    switch (cmd) {
        case 'ls':
        case 'echo':
            results[results.length - 1].warn = "Warn: ignoring stdin";
            traceLinesInOrder(cmd, results);
            break;
        default:
            break;
    }
}

function getInitialSourceRecords(stage, results) {
    const [cmd, ...args] = stage;
    switch (cmd) {
        case 'ls':
        case 'echo':
            traceLinesInOrder(cmd, results);
            break;
        default:
            dummyRecords(results);
            break;
    }
}

function dummyRecords(results) {
    const latest = results[results.length - 1];
    let filenames = [];
    let lineNums = [];
    let lineNum = 1;
    for (const line of latest.out.split('\n')) {
        filenames.push("dummy");
        lineNums.push([lineNum++, line]);
    }
    if (lineNums[lineNums.length - 1][1] === '') {
        lineNums.pop();
    }
    latest.filenames = filenames;
    latest.lineNums = lineNums;
}

function traceLinesInOrder(cmd, results) {
    const latest = results[results.length - 1];
    let filenames = [];
    let lineNums = [];
    let lineNum = 1;
    for (const line of latest.out.split('\n')) {
        filenames.push(cmd);
        lineNums.push([lineNum++, line]);
    }
    if (lineNums[lineNums.length - 1][1] === '') {
        lineNums.pop();
    }
    latest.filenames = filenames;
    latest.lineNums = lineNums;
}

module.exports = {
    getSourceRecords,
    getInitialSourceRecords
}