"""
Bulk migration script: Convert existing verbose discord blocks to the
slim profile-based format.

This script:
1. Scans all .md files under Content/ for ```discord blocks and
   > [!discord-cite] callout blocks.
2. Extracts all unique authors and compiles them into profiles.
3. Rewrites the JSON payloads to use "profile" keys instead of
   inline author/avatar data.
4. Writes the profiles into the Obsidian plugin's data.json.

Usage:
  python scripts/migrate_discord_blocks.py [--dry-run]

With --dry-run, it prints what it would do without writing any files.
"""

import json
import re
import sys
import os
from pathlib import Path
from typing import Any

VAULT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = VAULT_ROOT / "Content"
PLUGIN_DATA_PATH = (
    VAULT_ROOT
    / ".obsidian"
    / "plugins"
    / "discord-message-embed"
    / "data.json"
)

DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"


def make_profile_id(username: str, display_name: str) -> str:
    """Generate a clean profile ID from username or display_name."""
    candidate = username or display_name or "unknown"
    # Lowercase, strip non-alphanumeric except dash/underscore
    cleaned = re.sub(r"[^a-z0-9_-]", "", candidate.lower().replace(" ", "-"))
    return cleaned or "unknown"


def extract_author_key(msg: dict) -> str | None:
    """Get a unique key for this author."""
    author = msg.get("author", {})
    if not author and not msg.get("avatar_url"):
        return None
    username = (author.get("username") or "").strip()
    display_name = (author.get("display_name") or "").strip()
    avatar = (msg.get("avatar_url") or "").strip()
    if not username and not display_name:
        return None
    return f"{username}|{display_name}|{avatar}"


def author_to_profile(msg: dict) -> dict:
    """Extract profile data from a legacy message."""
    author = msg.get("author", {})
    username = (author.get("username") or "").strip()
    display_name = (author.get("display_name") or "").strip()
    color = (author.get("color") or author.get("colour") or "").strip() or None
    avatar = (msg.get("avatar_url") or "").strip() or None
    pid = make_profile_id(username, display_name)

    return {
        "id": pid,
        "display_name": display_name or username or pid,
        "username": username or display_name or pid,
        "color": color,
        "avatar_url": avatar if avatar != DEFAULT_AVATAR else None,
    }


def slim_message(msg: dict, profile_id: str) -> dict:
    """Convert a verbose message to the slim format."""
    result: dict[str, Any] = {"profile": profile_id}

    # Keep content (the most important field)
    content = msg.get("content", "")
    if content:
        result["content"] = content
    else:
        result["content"] = ""

    # Keep timestamp
    ts = msg.get("timestamp")
    if ts:
        result["timestamp"] = ts

    # Keep URL only if it's a real discord link
    url = msg.get("url") or msg.get("jump_url")
    if url and "discord.com/channels/" in url:
        result["url"] = url

    # Keep attachments if present
    attachments = msg.get("attachments")
    if attachments:
        result["attachments"] = attachments

    attachment = msg.get("attachment")
    if attachment:
        result["attachment"] = attachment

    image = msg.get("image")
    if image:
        result["image"] = image

    images = msg.get("images")
    if images:
        result["images"] = images

    return result


# Regex to find ```discord ... ``` blocks
DISCORD_FENCE_RE = re.compile(
    r"(```discord\s*\n)(.*?)(```)",
    re.DOTALL,
)

# Regex to find citation callout JSON blocks (> ```json ... > ```)
CITATION_JSON_RE = re.compile(
    r"(>\s*```json\s*\n)((?:>\s*.*\n)*?)(>\s*```)",
)


def process_json_payload(
    raw_json: str,
    profiles: dict[str, dict],
    author_key_to_id: dict[str, str],
) -> str | None:
    """Process a JSON payload, returning the slimmed version or None if no changes."""
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        return None

    messages: list[dict]
    is_citation_wrapper = False
    citation_id = None

    if isinstance(data, list):
        messages = data
    elif isinstance(data, dict) and "messages" in data:
        messages = data["messages"]
        is_citation_wrapper = True
        citation_id = data.get("id")
    elif isinstance(data, dict):
        messages = [data]
    else:
        return None

    if not messages:
        return None

    changed = False
    new_messages = []

    for msg in messages:
        if not isinstance(msg, dict):
            new_messages.append(msg)
            continue

        # Already migrated?
        if "profile" in msg:
            new_messages.append(msg)
            continue

        key = extract_author_key(msg)
        if key is None:
            new_messages.append(msg)
            continue

        pid = author_key_to_id.get(key)
        if pid is None:
            # Build a profile for this author
            profile_data = author_to_profile(msg)
            pid = profile_data["id"]

            # Handle ID collisions
            base_pid = pid
            counter = 2
            while pid in profiles and profiles[pid] != profile_data:
                pid = f"{base_pid}-{counter}"
                profile_data["id"] = pid
                counter += 1

            profiles[pid] = profile_data
            author_key_to_id[key] = pid

        new_messages.append(slim_message(msg, pid))
        changed = True

    if not changed:
        return None

    if is_citation_wrapper:
        output = {"id": citation_id, "messages": new_messages}
    else:
        output = new_messages

    return json.dumps(output, indent=2, ensure_ascii=False)


def process_discord_fence(
    match: re.Match,
    profiles: dict[str, dict],
    author_key_to_id: dict[str, str],
) -> str:
    """Process a ```discord ... ``` match."""
    prefix = match.group(1)
    raw_json = match.group(2)
    suffix = match.group(3)

    result = process_json_payload(raw_json, profiles, author_key_to_id)
    if result is None:
        return match.group(0)

    return f"{prefix}{result}\n{suffix}"


def process_citation_json(
    match: re.Match,
    profiles: dict[str, dict],
    author_key_to_id: dict[str, str],
) -> str:
    """Process a > ```json ... > ``` citation match."""
    prefix = match.group(1)
    raw_lines = match.group(2)
    suffix = match.group(3)

    # Strip leading "> " from each line to get raw JSON
    lines = raw_lines.split("\n")
    json_lines = []
    for line in lines:
        stripped = re.sub(r"^>\s?", "", line)
        json_lines.append(stripped)
    raw_json = "\n".join(json_lines)

    result = process_json_payload(raw_json, profiles, author_key_to_id)
    if result is None:
        return match.group(0)

    # Re-add "> " prefix to each line
    new_lines = result.split("\n")
    quoted = "\n".join(f"> {line}" for line in new_lines)

    return f"{prefix}{quoted}\n{suffix}"


def migrate(dry_run: bool = False) -> None:
    profiles: dict[str, dict] = {}
    author_key_to_id: dict[str, str] = {}

    # Load existing profiles if any
    if PLUGIN_DATA_PATH.exists():
        try:
            existing = json.loads(PLUGIN_DATA_PATH.read_text("utf-8"))
            existing_profiles = existing.get("profiles", {})
            profiles.update(existing_profiles)

            # Build reverse mapping
            for pid, pdata in existing_profiles.items():
                key = f"{pdata.get('username', '')}|{pdata.get('display_name', '')}|{pdata.get('avatar_url', '')}"
                author_key_to_id[key] = pid
        except Exception as e:
            print(f"Warning: couldn't load existing data.json: {e}")

    # Find all .md files
    md_files = sorted(CONTENT_DIR.rglob("*.md"))
    modified_files: list[Path] = []

    for md_file in md_files:
        original = md_file.read_text("utf-8")
        content = original

        # Process ```discord blocks
        content = DISCORD_FENCE_RE.sub(
            lambda m: process_discord_fence(m, profiles, author_key_to_id),
            content,
        )

        # Process citation JSON blocks
        content = CITATION_JSON_RE.sub(
            lambda m: process_citation_json(m, profiles, author_key_to_id),
            content,
        )

        if content != original:
            modified_files.append(md_file)
            if not dry_run:
                md_file.write_text(content, "utf-8")

    # Summary
    print(f"\nFound {len(profiles)} unique profiles:")
    for pid, pdata in sorted(profiles.items()):
        color = pdata.get("color") or "none"
        print(f"  {pid}: {pdata['display_name']} (@{pdata['username']}) [{color}]")

    print(f"\n{'Would modify' if dry_run else 'Modified'} {len(modified_files)} files:")
    for f in modified_files:
        print(f"  {f.relative_to(VAULT_ROOT)}")

    if not dry_run:
        # Write profiles to data.json
        data: dict[str, Any] = {}
        if PLUGIN_DATA_PATH.exists():
            try:
                data = json.loads(PLUGIN_DATA_PATH.read_text("utf-8"))
            except Exception:
                pass

        data["profiles"] = profiles
        # Preserve other settings
        if "apiEndpoint" not in data:
            data["apiEndpoint"] = (
                "https://discord-system-firebase-bot-production.up.railway.app/api/message?url="
            )

        PLUGIN_DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
        PLUGIN_DATA_PATH.write_text(
            json.dumps(data, indent=2, ensure_ascii=False), "utf-8"
        )
        print(f"\nProfiles written to {PLUGIN_DATA_PATH.relative_to(VAULT_ROOT)}")
    else:
        print("\n(dry run — no files were changed)")


if __name__ == "__main__":
    dry = "--dry-run" in sys.argv
    migrate(dry_run=dry)
