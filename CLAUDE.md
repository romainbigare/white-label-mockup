# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this repo is
- This is a mockup for a white label AI farm management app.
- We mock the user interface and user experience only. No data, backend, real authentication, etc.
- Whatever cannot be mocked without a server can be pretend.

## Architecture & code quality

- Always think carefully about the architecture and separation of concerns before making changes: which module/component owns what, where the hard/tricky bits of the code live, what to be aware of, and what could go wrong. Don't just patch the nearest file.

## Agents

- Never spawn Claude Opus or Claude Fable agents for discovery, tracking, or web-search tasks. Use Haiku agents for data context, web search, and parsing and reading documents. Use Opus agents for coding. Do not allow sub-agents.

## Backward compatibility

- Never implement backward compatibility unless explicitly requested. Break things if it makes the code simpler or the design cleaner.
