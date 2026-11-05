# Vestigo

*Pick up where you left off.*

Vestigo gives developers and AI assistants a small, persistent memory of a project:
what changed, why it changed, what was checked, and what needs to happen next.
It helps people building through conversation resume work without explaining the
project again or asking an agent to reread every file.

## Start using it

Requires VS Code 1.102+; external MCP clients need Node.js 20+.

```bash
npm install
npm run build
```

Launch the extension in an Extension Development Host, or install a packaged VSIX.
Open the **Vestigo** activity-bar view in a trusted project.

- **Connect AI** explains how to enable the local memory tools. In supported VS Code
  versions the extension provides its MCP server automatically; enable it in your
  assistant's tools. Your editor may ask you to trust the server.
- **Copy context for AI** copies a bounded brief and recent checkpoints for assistants
  without MCP support. No saved memories or AI account are required to generate the brief.
- **Save a checkpoint** records a short summary and optional next step yourself.
- **Recent work** shows decisions and progress; **This file** also shows imported Git/PR history.
- **Export project memory** creates `vestigo.context.json` from project-visible agent
  records. Review and commit that file to carry context to another clone. Private records
  are excluded; exporting does not commit or upload anything.

The project brief uses package metadata, a short README excerpt when needed, and a
bounded directory map. It is a starting map, not a generated explanation of every module.
Fresh clones automatically read `vestigo.context.json` when it is present. An exported
pack contains only explicitly project-visible agent records, not the legacy SQLite history.

## Agent memory tools

The local MCP server exposes four tools:

- `get_project_brief`: project identity, scripts, a small file map, and recent work.
- `get_task_context`: keyword-ranked memories, optionally filtered to an exact file.
- `record_work`: compact work, decision, constraint, or issue records.
- `get_memory`: one record and its file fingerprints.

For an external assistant, run:

```bash
node /absolute/path/to/Vestigo/out/agent/server.js --workspace /absolute/path/to/your/project
```

Example MCP configuration (the wrapper varies by assistant):

```json
{
  "mcpServers": {
    "vestigo": {
      "command": "node",
      "args": ["/absolute/path/to/Vestigo/out/agent/server.js", "--workspace", "/absolute/path/to/your/project"]
    }
  }
}
```

The server supplies agents with instructions to retrieve context at the start and
record meaningful checkpoints. The assistant decides when to invoke tools; Vestigo
does not intercept every conversation or automatically install hooks in other assistants.

Example `record_work` arguments:

```json
{
  "kind": "work",
  "summary": "Added password reset using the existing email service.",
  "reason": "Reused the established email delivery path.",
  "files": ["src/auth/reset.ts"],
  "verification": { "status": "passed", "command": "npm test" },
  "next": "Verify delivery against the live email provider.",
  "visibility": "project"
}
```

Private visibility is the default. Use `supersedes` with an earlier memory ID to correct
a record; the earlier version remains available in work history.

## Keeping AI usage small

Vestigo makes **no AI API calls** to write, validate, deduplicate, search, or export memory.
The working agent records what it already knows; no second model summarizes its conversation.

- Aim for 150–300 tokens per useful checkpoint. Writes have a hard cap of 2,400 UTF-8
  bytes and individual field limits. Oversized writes are rejected, not silently truncated.
- Duplicate content with the same file evidence returns a small acknowledgement without another record.
- Retrieval defaults to a 1,200 estimated-token budget; request 256–3,000. Whole records
  that do not fit are omitted and counted. Search considers at most 20 candidates.
- Size estimates use UTF-8 bytes divided by four. They are **not exact tokenizer counts,
  provider credit counts, or measured savings**. Tool schemas and the assistant's own
  processing also consume context. Provider billing still applies.

## Evidence and privacy

Agent records are immutable JSON files in `.vestigo/agent-memory/`, separate from the
legacy `.vestigo/memory.db`. Separate files allow the extension and multiple agent
processes to write without replacing one another's in-memory SQLite snapshots.

Vestigo records file fingerprints, Git revision, and working-tree status when possible.
It marks referenced files unchanged, changed, missing, or unavailable when retrieving them.
An unchanged fingerprint does not prove the recorded explanation is correct. Test results
are always labelled **agent-reported**; Vestigo does not execute arbitrary commands to
independently certify them.

Local records stay ignored by Git. The MCP writer also creates `.vestigo/.gitignore` so
this protection works without the extension. Only an explicit export creates a shareable
file outside that directory. Review it before sharing. Recognizable credential patterns
and sensitive file paths are rejected; this is not a comprehensive secret scanner.

There is no telemetry, cloud memory service, or model key requirement. GitHub harvesting
uses GitHub's API only when a token is configured.

## Git and GitHub history

The extension also imports commit messages and merged GitHub PR descriptions into its
existing local SQLite store. Run **Vestigo: Set GitHub personal access token** to configure
GitHub access; choose a token with read access to the required repository. The token is
stored through VS Code SecretStorage. PR harvesting runs at activation and on supported
fetch/pull events. These raw imports are displayed under **This file**; they are not yet
structured agent records or exposed by the MCP tools.

Manual file notes use `Ctrl+Alt+M` (`Cmd+Alt+M` on macOS). Search saved agent context with
`Ctrl+Alt+F` (`Cmd+Alt+F` on macOS), or use **Vestigo: Find project context**.

## Development and tests

```bash
npm run lint
npm run build
npm run test:core
npm run test:extension
```

`npm test` builds and runs both suites. Linux extension tests need a display; use
`xvfb-run -a npm run test:extension` on headless systems. `npm run watch` rebuilds the
extension, agent server, and browser-targeted webviews.

This release supports the first workspace folder. Search is lexical, not semantic.
Symbol relocation, independent test attestation, automatic source-based decision
extraction, and provider billing integrations are future work.

## License

MIT
