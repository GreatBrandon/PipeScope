#!/usr/bin/env node

const express = require('express');
const { parse } = require('shell-quote');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { platform } = require('node:process');
const open = require('open').default;
const path = require('path');

const WORKDIR = process.cwd();              // folder PipeScope was launched from
const TOKEN = crypto.randomBytes(16).toString('hex');
const ALLOWED = new Set(['cat', 'grep', 'cut', 'sort', 'uniq', 'head', 'tail', 'wc', 'tr', 'cd', 'ls', 'pwd', 'cowsay', 'sed']);

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

// launch app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// receive pipeline text
app.post('/run', async (req, res) => {
    // TODO remove tokens unneccessary slop
    if (req.get('x-token') !== TOKEN) return res.status(403).json({ error: 'bad token' });
    // split pipeline command into stages
    let stages;
    try { 
        stages = splitStages(req.body.pipeline || '');
    }
    catch (e) {
        return res.status(400).json({ error: e.message }); 
    }

    // run each stage separately and log the output
    const results = [];
    let input = '';
    for (const stage of stages) {
        const r = await runStage(stage, input);
        results.push({ cmd: stage.join(' '), ...r });
        if (r.code !== 0) break;
        input = r.out;
    }
    // send output back to frontend
    res.json({ stages: results });
});

// launch app, print URL if app fails to launch automatically
const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/?token=${TOKEN}`;
    console.log(`PipeScope running in ${url}`);
    console.log("Platform is "+platform);
    console.log("CWD is "+WORKDIR);
    open(url);
});

// request platform the app is run on
app.get('/platform', (req, res) => {
    res.json({platform});
});