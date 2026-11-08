#!/usr/bin/env node

const express = require('express');
const crypto = require('crypto');
const { platform } = require('node:process');
const open = require('open').default;
const path = require('path');
const TOKEN = crypto.randomBytes(16).toString('hex');

const {
    splitStages,
    runCD,
    runStagesAndLog,
    getWorkDir
} = require('./functions');

// launch app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// receive pipeline text
app.post('/run', async (req, res) => {
    if (req.get('x-token') !== TOKEN) return res.status(403).json({ error: 'bad token' });

    // split pipeline command into stages
    let stages;
    try { 
        stages = splitStages(req.body.pipeline || '');
    }
    catch (e) {
        return res.status(400).json({ error: e.message }); 
    }

    // if command is a cd
    if (stages.length != 0 && stages[0][0] === 'cd') {
        return res.json(runCD(stages));
    }
    
    // send output back to frontend
    const result = await runStagesAndLog(stages);
    return res.json(result);
});

// request platform the app is run on
app.get('/initial', (req, res) => {
    res.json({platform, workDir: getWorkDir()});
});

// launch app, print URL if app fails to launch automatically
const server = app.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/?token=${TOKEN}`;
    console.log(`PipeScope running in ${url}`);
    console.log("Platform is "+platform);
    console.log("CWD is "+getWorkDir());
    open(url);
});