const token = new URLSearchParams(location.search).get('token');

// run pipeline
document.getElementById('run').onclick = async () => {
    // run pipeline on local server
    const res = await fetch('/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ pipeline: document.getElementById('pipeline').value })
    });

    // get response
    const data = await res.json();
    const box = document.getElementById('stages');
    box.innerHTML = '';
    if (data.error) { box.textContent = data.error; return; }

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
};

// run pipeline when enter key is pressed when entering text in the textbox
document.querySelector("#pipeline").addEventListener("keyup", event => {
    if(event.key !== "Enter") return;
    document.querySelector("#run").click();
    event.preventDefault();
})

// fetch platform and enable/disable run button if linux/windows/other
fetch('/platform')
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
    })
    .catch(err => {
        console.log(err);
    });