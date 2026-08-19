# Vestigo

*Follow the footprints of every decision in your codebase.*

## Problem statement

Every codebase accumulates decisions that made sense at the time.
Refresh tokens moved to cookies. Retry count hardcoded to 3. A weird middleware order
that nobody touches. A `// temporary fix` from 2021 that is load-bearing.

Git stores the what. Stack Overflow threads get closed. The developer who knew why
left the company. The AI session that explained it expired.

Vestigo stores the why — automatically, passively, attached to the exact line of code
it describes — so the next developer who opens that file finds the context immediately,
whether they are a new hire, an AI agent, or you coming back after three months away.

## What this is

Vestigo is a VS Code extension that gives codebases persistent memory.

Not memory of *what* changed — git already does that.
Memory of *why* it changed, *who* understood it, and *where* the relevant code lives
when you only know what it does, not what it is called.

## MVP features

- **Passive memory capture** from merged GitHub PR descriptions and git commit message bodies.
- **Memory sidebar** that automatically shows memories for the currently open file.
- **Manual notes** with `Ctrl+Shift+M` (`Cmd+Shift+M` on macOS).
- **Local-only storage** in `{workspaceRoot}/.vestigo/memory.db`.
- **Automatic `.gitignore`** entry so memories are never committed accidentally.

## Build

```bash
npm install
npm run build
```

Press `F5` in VS Code to launch the extension in a new Extension Development Host window.

## Configure GitHub PR harvesting

1. Create a GitHub personal access token with `repo:read` scope.
2. Open the Command Palette and run **Vestigo: Set GitHub personal access token**.
   The token is stored in your OS keychain via VS Code SecretStorage — never on disk.
3. Vestigo will harvest closed merged PR descriptions on activation and after each `git pull`.

## Security and privacy

- All memory data stays in `.vestigo/memory.db` inside your workspace.
- No telemetry. No analytics. No external servers in V1.
- GitHub PAT is stored in VS Code SecretStorage (OS keychain).

## License

MIT
