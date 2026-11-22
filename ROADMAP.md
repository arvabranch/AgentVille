# Roadmap

## Version 1 (current)

- Pixel-art town with movement, collisions and 10 desks
- One agent per project folder, created with a native folder picker
- Chat panel with streaming Markdown, tool activity, Stop and Markdown export
- Claude Agent SDK with user and project settings (CLAUDE.md, skills, plugins, hooks, MCP) and session resume
- Approval cards (Allow / Always allow for this agent / Deny) and clarifying questions
- Character states: sleeping, working, needs attention, error, reply ready
- Costs per reply, per agent and in total
- Local persistence, bring-your-own API key stored with safeStorage, English and Spanish UI

## Next (planned, not built yet)

### Multiplayer rooms

A shared room where another person joins your town.

- Only avatars, positions and agent status (sleeping, working, needs attention…) are synced.
- **API keys, chats and project files are never shared.** Each person's agents keep running on their own machine with their own key.
- Open questions: hosting (peer-to-peer or a small relay), room invites, presence and moderation.

### Browser MCP server

Give agents a real browser through an MCP server based on Playwright, using Brave or Chromium.

- Per-agent opt-in from the chat panel.
- Browser actions go through the same approval cards.

### Agent templates

Pre-configured agents, for example:

- **VPS agent**: works on a remote server over SSH, with its own instructions and allowed tools.
- Reviewer, test writer, docs writer…

Templates would set the system prompt addition, remembered permissions and MCP servers when the agent is created.

### Map editor and character customization

- Edit the office and the town (furniture, rooms, more desks).
- Choose your character's look and your agents' looks.

## Ideas

- Model and effort picker per agent, and an optional spending cap per agent (`maxBudgetUsd`)
- Signed and notarized builds, auto-update
- Migrate the world to Phaser 4
- Show subagents as little helpers walking around the office
- Git status on each desk (branch, uncommitted changes)
- Sound effects and music (CC0)
- More languages
- Remember window size and position

Want to work on one of these? Open an issue first so we can agree on the approach.
