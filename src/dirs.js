let workDir = process.cwd(); // folder PipeScope was launched from

module.exports = {
    getWorkDir: () => workDir,
    setWorkDir: (newDir) => workDir = newDir
}