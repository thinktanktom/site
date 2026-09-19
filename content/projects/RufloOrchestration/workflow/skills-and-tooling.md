# Client Workflow — Skills & Workflow Tooling

## Skill Files

The client's project is a complex multi-component system. To give Claude agents the right context for each kind of work rather than one undifferentiated context window, 12 specialist skill files were set up under `.claude/skills/`, each scoped to a distinct engineering domain the client's product touches — cryptography, the gRPC API, the EVM bridge, DAG persistence, admin auth, and other areas of the codebase. Each skill loads only when the work at hand matches its domain.

---

## The Workflow Runner

A bash script, `run-lockbox-workflow.sh`, orchestrates Claude Code in headless mode across 12 sequential development passes. Each pass targets a specific area of the codebase, loads the relevant skill files as context, and writes a timestamped log.

```bash
# Run all 12 passes
bash run-lockbox-workflow.sh

# Resume from a specific pass
bash run-lockbox-workflow.sh 3 6
```

Documented execution features:

- **PID file locking** — prevents two runs from executing concurrently against the same workspace
- **Environment validation** — checks for the API key, the `claude` CLI, and the project directory before starting a pass
- **Auto-resume on max-turns limit** — if a pass hits Claude Code's turn limit before finishing, the runner resumes it rather than treating it as a failure
- **Status JSON** — written to `/tmp/workflow-status.json`, giving external tooling a way to check progress without tailing logs

---

## Custom MCP Tools

Two tools were added to `BUILTIN_TOOLS` in `mcp-bridge/index.js` to expose the workflow runner to any connected Claude agent — including the client's own remote Claude Code session over the MCP bridge:

```js
case "run_lockbox_workflow": {
  const startPass = params.start_pass || 1;
  const endPass = params.end_pass || 12;
  const scriptPath = "/home/deploy/ruflo/ruflo/run-lockbox-workflow.sh";
  spawn("bash", [scriptPath, String(startPass), String(endPass)], {
    detached: true,
    stdio: ["ignore", fs.openSync("/tmp/lockbox-nohup.log", "a"), "ignore"],
  }).unref();
  return { content: [{ type: "text", text: `Workflow started (passes ${startPass}–${endPass})` }] };
}

case "get_workflow_status": {
  const statusFile = "/tmp/lockbox-workflow-status.json";
  const logFile = "/tmp/lockbox-workflow.log";
  try {
    const status = JSON.parse(fs.readFileSync(statusFile, "utf8"));
    const logLines = fs.readFileSync(logFile, "utf8").split("\n").slice(-10).join("\n");
    return { content: [{ type: "text", text: JSON.stringify({ ...status, recentLog: logLines }) }] };
  } catch {
    return { content: [{ type: "text", text: "No workflow status found. Has a run been started?" }] };
  }
}
```

Both tools are registered in the bridge's `core` group, so they're always active for a connected agent. One known limitation: status files live under `/tmp/` and don't survive a container restart — a more robust version of this would write them to a mounted volume instead.

---

## The Workspace Mount

The client's project directory is mounted into the `mcp-bridge` container at `/workspace/project`, without `:ro` — agents need write access to actually make changes. Before enabling that, git tracking was confirmed active inside the workspace, on purpose: any AI-made file change shows up as an uncommitted diff, giving the client a visible audit trail and a trivial rollback path (`git diff`, `git checkout --`) for anything an agent touches.

Write access to a codebase without version control underneath it isn't something this setup does. Git tracking is the floor, not an enhancement.
