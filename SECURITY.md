# Security policy

AgentVille runs coding agents on your computer with your Anthropic API key, so security reports are very welcome.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's [private vulnerability reporting](https://github.com/arvabranch/AgentVille/security/advisories/new) instead, with:

- what the problem is and its impact,
- steps to reproduce (a minimal project folder or message if relevant),
- the AgentVille version and your operating system.

We will acknowledge the report as soon as we can and keep you updated while we work on a fix.

## Scope

Especially interesting:

- ways for the UI process, a web page or an agent reply to reach Node.js, the IPC layer beyond its allow-list, or the stored API key,
- the API key appearing in logs, files or the renderer,
- tool calls that run without the user's approval when they should ask.

Out of scope: what an agent does after you approved it, and issues in Claude Code or the Agent SDK themselves (report those to Anthropic).
