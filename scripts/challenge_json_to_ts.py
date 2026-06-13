#!/usr/bin/env python3
"""Validate and convert challenge chapter JSON to a TypeScript module."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


REQUIRED_LEVEL_FIELDS = {
    "key",
    "title",
    "summary",
    "description",
    "points",
    "initialCode",
    "judge",
}


def load_json(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError("chapter JSON root must be an object")
    return data


def camel_case_key(key: str) -> str:
    parts = key.split("-")
    return parts[0] + "".join(part.capitalize() for part in parts[1:]) + "Chapter"


def assert_kebab_case(value: str, field: str) -> None:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError(f"{field} must be lowercase kebab-case: {value}")


def assert_json_value(value: Any, field: str) -> None:
    if value is None or isinstance(value, (str, int, float, bool)):
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            assert_json_value(item, f"{field}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError(f"{field} has a non-string key: {key!r}")
            assert_json_value(item, f"{field}.{key}")
        return
    raise ValueError(f"{field} is not JSON-compatible: {type(value).__name__}")


def validate_chapter(chapter: dict[str, Any]) -> None:
    for field in ["key", "title", "description", "theme", "helpDoc", "levels"]:
        if field not in chapter:
            raise ValueError(f"missing chapter field: {field}")

    assert_kebab_case(chapter["key"], "chapter.key")

    help_doc = chapter["helpDoc"]
    if not isinstance(help_doc, dict):
        raise ValueError("helpDoc must be an object")
    for field in ["title", "intro", "sections"]:
        if field not in help_doc:
            raise ValueError(f"missing helpDoc field: {field}")
    if not isinstance(help_doc["sections"], list) or not help_doc["sections"]:
        raise ValueError("helpDoc.sections must be a non-empty array")
    for index, section in enumerate(help_doc["sections"]):
        if not isinstance(section, dict):
            raise ValueError(f"helpDoc.sections[{index}] must be an object")
        if "title" not in section or "points" not in section:
            raise ValueError(f"helpDoc.sections[{index}] needs title and points")
        if not isinstance(section["points"], list) or not section["points"]:
            raise ValueError(f"helpDoc.sections[{index}].points must be non-empty")

    levels = chapter["levels"]
    if not isinstance(levels, list) or not levels:
        raise ValueError("levels must be a non-empty array")

    seen_keys: set[str] = set()
    for index, level in enumerate(levels):
        if not isinstance(level, dict):
            raise ValueError(f"levels[{index}] must be an object")
        missing = REQUIRED_LEVEL_FIELDS - set(level)
        if missing:
            raise ValueError(f"levels[{index}] missing fields: {sorted(missing)}")
        assert_kebab_case(level["key"], f"levels[{index}].key")
        if level["key"] in seen_keys:
            raise ValueError(f"duplicate level key: {level['key']}")
        seen_keys.add(level["key"])
        if not isinstance(level["points"], int) or level["points"] <= 0:
            raise ValueError(f"levels[{index}].points must be a positive integer")

        judge = level["judge"]
        if not isinstance(judge, dict):
            raise ValueError(f"levels[{index}].judge must be an object")
        mode = judge.get("mode")
        if mode == "VARIABLES":
            expected = judge.get("expectedVariables")
            if not isinstance(expected, dict) or not expected:
                raise ValueError(f"levels[{index}].judge.expectedVariables must be non-empty")
            assert_json_value(expected, f"levels[{index}].judge.expectedVariables")
        elif mode == "OUTPUT":
            if not isinstance(judge.get("expectedOutput"), str):
                raise ValueError(f"levels[{index}].judge.expectedOutput must be a string")
        else:
            raise ValueError(f"levels[{index}].judge.mode must be VARIABLES or OUTPUT")


def render_ts(chapter: dict[str, Any]) -> str:
    const_name = camel_case_key(chapter["key"])
    body = render_value(chapter, 0)
    return (
        "import { ChallengeChapterDefinition } from '@/lib/challenges/types'\n\n"
        f"export const {const_name}: ChallengeChapterDefinition = {body}\n"
    )


def render_key(key: str) -> str:
    if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", key):
        return key
    return render_string(key)


def render_string(value: str) -> str:
    if "\n" in value:
        escaped = (
            value.replace("\\", "\\\\")
            .replace("`", "\\`")
            .replace("${", "\\${")
        )
        return f"`{escaped}`"
    escaped = (
        value.replace("\\", "\\\\")
        .replace("'", "\\'")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
    )
    return f"'{escaped}'"


def render_value(value: Any, indent: int) -> str:
    spaces = " " * indent
    child_indent = indent + 2
    child_spaces = " " * child_indent

    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, str):
        return render_string(value)
    if isinstance(value, list):
        if not value:
            return "[]"
        lines = ["["]
        for item in value:
            lines.append(f"{child_spaces}{render_value(item, child_indent)},")
        lines.append(f"{spaces}]")
        return "\n".join(lines)
    if isinstance(value, dict):
        if not value:
            return "{}"
        lines = ["{"]
        for key, item in value.items():
            lines.append(f"{child_spaces}{render_key(key)}: {render_value(item, child_indent)},")
        lines.append(f"{spaces}}}")
        return "\n".join(lines)
    raise TypeError(f"unsupported value: {type(value).__name__}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate only")
    parser.add_argument("json_path")
    parser.add_argument("output_path", nargs="?")
    args = parser.parse_args()

    try:
        chapter = load_json(args.json_path)
        validate_chapter(chapter)
        if args.check:
            print(f"OK: {chapter['key']} ({len(chapter['levels'])} levels)")
            return 0
        if not args.output_path:
            raise ValueError("output_path is required unless --check is used")
        output_path = Path(args.output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(render_ts(chapter), encoding="utf-8")
        print(f"Wrote {output_path}")
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
