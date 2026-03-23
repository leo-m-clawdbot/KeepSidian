# KeepSidian (Leo fork): one-way Google Keep → Obsidian mirror

[![License](https://img.shields.io/github/license/lc0rp/KeepSidian?style=flat-square)](LICENSE)

This fork is adapted for a **one-way, read-only mirror** workflow:

- **Google Keep is the source of truth**
- **Obsidian is the local mirror**
- sync only goes **from Google Keep into your vault**
- upload / two-way sync behavior is intentionally removed from this fork

## What this fork is for

This version is meant for setups where you:
- keep writing and organizing notes in **Google Keep**
- want those notes mirrored into local Markdown for **reading, search, backup, and agent access**
- do **not** want local Obsidian edits to sync back to Google Keep

## Read-only mirror semantics

This fork treats imported Keep notes as a mirror.

That means:
- if a mirrored note already exists locally and the Keep version changes, the local mirror is **overwritten from Google Keep**
- local mirror edits are **not merged back**
- upload and two-way sync flows are not part of this fork
- attachments are still downloaded into the mirror

Practical rule:
> **Edit in Google Keep, read in Obsidian.**

## Sync behavior

### Manual sync
You can:
- **Sync now**
- **Open sync center**
- **Download notes from Google Keep**
- **Open sync log file**

### Auto sync
Auto sync runs **import-only** on the configured interval.

## Server dependency

This fork still uses the upstream KeepSidian server-based import flow for talking to Google Keep.
It is therefore not yet a fully standalone local-only sync tool.

## Installation

Clone this repository into your Obsidian plugins directory, then build/install as normal for an Obsidian community plugin-style repo.

## Configure

In plugin settings, provide:
- your Google Keep email
- your Google Keep token
- a save location in your vault
- optional auto-sync settings

## Frontmatter

Synced notes include metadata such as:
- `GoogleKeepUrl`
- `GoogleKeepCreatedDate`
- `GoogleKeepUpdatedDate`
- `KeepSidianLastSyncedDate`

## Activity log

Each sync activity is recorded under `_KeepSidianLogs/` inside the target folder.

## Current caveats

- this fork is **download-only**
- it still depends on the upstream server integration for fetching Keep notes
- local edits inside the mirror folder may be overwritten on the next sync

## Summary

This fork is optimized for:
- **Google Keep as capture/inbox/source**
- **Obsidian as local mirror and reading surface**
- **safe one-way sync for agent-readable notes**
