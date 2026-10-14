const express = require('express');
const { parse } = require('shell-quote');
const { spawn } = require('child_process');
const crypto = require('crypto');

const WORKDIR = process.cwd();              // folder PipeScope was launched from
const TOKEN = crypto.randomBytes(16).toString('hex');
const ALLOWED = new Set(['cat', 'grep', 'cut', 'sort', 'uniq', 'head', 'tail', 'wc', 'tr']);

function splitStages(text) {
    const stages = [[]];
    for (const tok of parse(text)) {
        if (typeof tok === 'string') stages[stages.length - 1].push(tok);
        else if (tok.op === '|') stages.push([]);
        else throw new Error(`Unsupported syntax: ${tok.op || 'expression'}`);
    }
    return stages;
}

function runStage([cmd, ...args], input) {
    return new Promise(resolve => {
        if (!ALLOWED.has(cmd)) return resolve({ out: '', err: `Unsupported command: ${cmd}`, code: 127 });
        const p = spawn(cmd, args, { cwd: WORKDIR, timeout: 5000 });
        let out = '', err = '';
        p.stdout.on('data', d => { if (out.length < 1e6) out += d; });
        p.stderr.on('data', d => { if (err.length < 1e4) err += d; });
        p.on('error', e => resolve({ out, err: e.message, code: 1 }));
        p.on('close', code => resolve({ out, err, code }));
        p.stdin.on('error', () => {});          // ignore EPIPE if the command exits early
        p.stdin.end(input);
    });
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/run', async (req, res) => {
    if (req.get('x-token') !== TOKEN) return res.status(403).json({ error: 'bad token' });
    let stages;
    try { 
        stages = splitStages(req.body.pipeline || '');
    }
    catch (e) {
        return res.status(400).json({ error: e.message }); 
    }

    const results = [];
    let input = '';
    for (const stage of stages) {
        const r = await runStage(stage, input);
        results.push({ cmd: stage.join(' '), ...r });
        if (r.code !== 0) break;                // keep earlier stages visible
        input = r.out;
    }
    res.json({ stages: results });
});

app.listen(3000, '127.0.0.1', () =>
  console.log(`PipeScope running in ${WORKDIR}\nOpen http://127.0.0.1:3000/?token=${TOKEN}`));