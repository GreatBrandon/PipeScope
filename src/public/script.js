const token = new URLSearchParams(location.search).get('token');
const traceToggle = document.getElementById('traceToggle');
let lastStages = null; // most recent stage results, so the toggle can re-render without re-running

// restore saved trace preference
try { traceToggle.checked = localStorage.getItem('showTrace') === '1'; } catch (e) {}

// render the stage list, with or without source tracing
function renderStages() {
    const box = document.getElementById('stages');
    box.innerHTML = '';
    if (!lastStages) return;
    const showTrace = traceToggle.checked;

    lastStages.forEach((s, i) => {
        const div = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = `Stage ${i + 1}: ${s.cmd}`;
        const pre = document.createElement('pre');
        div.append(title, pre);

        const hasTrace = showTrace && Array.isArray(s.lineNums) && Array.isArray(s.filenames);
        if (hasTrace) {
            const lines = s.out.split('\n');
            if (lines[lines.length - 1] === '') lines.pop(); // drop trailing newline artifact
            lines.forEach((text, n) => {
                const row = document.createElement('div');
                row.className = 'traceLine';
                const src = document.createElement('span');
                src.className = 'traceSrc';
                const file = s.filenames[n];
                const num = s.lineNums[n] ? s.lineNums[n][0] : '?';
                src.textContent = file !== undefined ? `${file}:${num}` : '';
                const txt = document.createElement('span');
                txt.textContent = text;
                row.append(src, txt);
                pre.append(row);
            });
            if (s.err) pre.append(document.createTextNode('[error] ' + s.err));
        } else {
            pre.textContent = s.out + (s.err ? '\n[error] ' + s.err : '');
        }

        if (showTrace && s.warn) {
            const warn = document.createElement('p');
            warn.className = 'traceWarn';
            warn.textContent = s.warn;
            div.append(warn);
        }
        box.append(div);
    });
}

traceToggle.addEventListener('change', () => {
    try { localStorage.setItem('showTrace', traceToggle.checked ? '1' : '0'); } catch (e) {}
    renderStages();
});

// run pipeline
document.getElementById('pipelineForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    // run pipeline on local server
    const res = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ pipeline: document.getElementById('pipelineInput').value })
    });
    
    // get response
    const data = await res.json();
    const box = document.getElementById('stages');
    box.innerHTML = '';
    lastStages = null;
    if (data.error) { box.textContent = data.error; return; }
    if (data.cwdError) {
        box.textContent = data.cwdError;
        return;
    }
    if (data.cwdPath) {
        box.textContent = "Current working directory changed successfully";
        document.getElementById("cwd").textContent = "Current working directory: " + data.cwdPath;
        return;
    }

    lastStages = data.stages;
    renderStages();
});

// fetch platform and enable/disable run button if linux/windows/other
fetch('/initial')
    .then(res => res.json())
    .then(data => {
        let text;
        if (data.platform === "win32") {
            text = "The current platform is Windows, PipeScope only works on Linux, WSL or MacOS. The run button has been disabled.";
        } else {
            document.getElementById("run").disabled = false;
            if (data.platform === "linux") {
                text = "Current platform: Linux or WSL"
            } else if (data.platform === "darwin") {
                text = "Current platform: MacOS or Darwin"
            } else {
                text = `The current platform is ${data.platform}, PipeScope has not been tested on this platform.`;
            }
        }
        document.getElementById("platform").textContent = text;
        document.getElementById("cwd").textContent = "Current working directory: " + data.workDir;
    })
    .catch(err => {
        console.log(err);
    });

// light/dark toggle
const root = document.documentElement;
const themeBtn = document.getElementById('themeToggle');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
 
function currentTheme() {
    return root.dataset.theme || (systemDark.matches ? 'dark' : 'light');
}
 
function updateThemeButton() {
    themeBtn.textContent = currentTheme() === 'dark' ? 'Switch to light' : 'Switch to dark';
}
 
themeBtn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    updateThemeButton();
});
 
updateThemeButton();