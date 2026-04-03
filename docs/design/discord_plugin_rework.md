# Discord Plugin Rework Plan

## Overview
This document outlines the step-by-step plan to redesign the `discord-message-embed` Obsidian plugin to support manual message creation, local profile management, improved newline/character handling, and rich in-editor rendering, while ensuring Quartz remains compatible.

## Phase 1: Profile & Data Management
1. **Plugin Settings (`data.json`)**
   - Update the plugin to store a dictionary of "Profiles" in its internal settings data.
   - A Profile will consist of: `id`, `display_name`, `username`, `color`, and `avatar_url`.
2. **Accessing Data from Quartz**
   - *Important Consideration:* Since Quartz builds the static site entirely separately from the Obsidian app runtime, it needs access to these profiles. 
   - We will configure the Quartz transformer plugin (`quartz-site/quartz/plugins/transformers/discordmessages.ts`) to read the `.obsidian/plugins/discord-message-embed/data.json` file directly during the build step, ensuring it has the latest profiles without you needing to duplicate them manually.

## Phase 2: The "Manual Embed" GUI Modal
1. **Modal UI (`Obsidian Modal` API)**
   - Create a dynamic Obsidian modal that launches when executing a new command: "Insert Manual Discord Messages".
2. **Message Flow**
   - The modal will contain a list of message blocks.
   - Each block will have:
     - A dropdown to select a Profile.
     - A `<textarea>` for the message content (handling newlines, escaping, and unicode natively).
     - A timestamp picker (or auto-populating field).
   - An "Add Message" button to append another message to the same block, allowing rapid transcription of a DM conversation.
3. **Profile Management within Modal**
   - Next to the profile dropdown, add an "Edit/Add Profiles" button.
   - This will swap the modal view to a simple CRUD (Create, Read, Update, Delete) interface to update the plugin settings without digging through the standard Obsidian settings menu.
4. **Insertion**
   - On submit, insert a highly optimized JSON block using ` ```discord ` (omitting bulky URLs and IDs) mapped to the selected profiles.

## Phase 3: Obsidian In-Editor Rendering (Live Preview / Read Mode)
1. **Register Code Block Processor**
   - Use Obsidian's `registerMarkdownCodeBlockProcessor("discord", ...)` API.
   - When Obsidian sees a ` ```discord ` block, it will intercept the JSON.
2. **UI Construction**
   - Replicate the HTML/DOM structure currently used by Quartz.
   - Inject the appropriate CSS into the plugin so it mirrors the web experience.
   - Ensure the "compacted" consecutive message mode (hiding the avatar/name for immediate follow-up messages by the same user) is replicated in this logic.

## Phase 4: Quartz Publisher Adjustments
1. **Update `discordmessages.ts`**
   - Modify the Quartz transformer to look for the new `profile` attribute in the JSON blocks.
   - If `profile` is found: dynamically look up the author details from Obsidian's `data.json`.
   - Maintain the existing rendering logic so the frontend display remains unchanged.

## Phase 5: Bulk Migration Script
1. **Python Migration Script (`scripts/migrate_discord_blocks.py`)**
   - Write a script to iterate through all `.md` files in the vault.
   - Find all ` ```discord ` and `> [!discord-cite]-` blocks.
   - Extract the unique authors from the bulky JSON payloads and compile them into the new `.obsidian/.../data.json` file as profiles.
   - Replace the bulky JSON with the new, slimline format utilizing the profile IDs.
