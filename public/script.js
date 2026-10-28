const token = new URLSearchParams(location.search).get('token');

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

    // display response
    data.stages.forEach((s, i) => {
        const div = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = `Stage ${i + 1}: ${s.cmd}`;
        const pre = document.createElement('pre');
        pre.textContent = s.out + (s.err ? '\n[error] ' + s.err : '');
        div.append(title, pre);
        box.append(div);
    });
});

// fetch platform and enable/disable run button if linux/windows/other
fetch('/initial')
    .then(res => res.json())
    .then(data => {
        let text;
        if (data.platform === "win32") {
            text = "The current platform is Windows, PipeScope only works on Linux or WSL. The run button has been disabled.";
        } else {
            document.getElementById("run").disabled = false;
            if (data.platform !== "linux") {
                text = `The current platform is ${data.platform}, PipeScope has not been tested on this platform.`;
            } else {
                text = "Current platform: Linux or WSL."
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