import json
import os
import re
import sys

body = os.environ["ISSUE_BODY"]

# Issue Forms の render: json は ```json ... ``` フェンスで囲まれた 1 ブロックのみを取り出す。
match = re.search(r"```json\n(.*?)\n```", body, re.DOTALL)
if not match:
    print("::error::Issue body に ```json ... ``` ブロックが見つかりません", file=sys.stderr)
    sys.exit(1)

try:
    data = json.loads(match.group(1))
except json.JSONDecodeError as exc:
    print(f"::error::JSON パースに失敗しました: {exc}", file=sys.stderr)
    sys.exit(1)

required = {
    "week": str,
    "period_start": str,
    "period_end": str,
    "total_items": int,
    "items": list,
}
for key, typ in required.items():
    if key not in data:
        print(f"::error::必須フィールド {key} がありません", file=sys.stderr)
        sys.exit(1)
    if not isinstance(data[key], typ):
        print(f"::error::{key} の型が不正です(期待: {typ.__name__})", file=sys.stderr)
        sys.exit(1)

if not data["items"]:
    print("::error::items が空です", file=sys.stderr)
    sys.exit(1)

for i, item in enumerate(data["items"]):
    for key in ("id", "version"):
        if key not in item or not isinstance(item[key], str):
            print(f"::error::items[{i}].{key} が不正です", file=sys.stderr)
            sys.exit(1)

input_path = os.environ["INPUT_FILE_PATH"]
with open(input_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)

# GITHUB_OUTPUT にはメタデータのみ載せ、生 JSON 本体は載せない。
with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
    out.write(f"week={data['week']}\n")
    out.write(f"period_start={data['period_start']}\n")
    out.write(f"period_end={data['period_end']}\n")
    out.write(f"selected_count={len(data['items'])}\n")
    out.write(f"total_items={data['total_items']}\n")

print(f"parsed week={data['week']} items={len(data['items'])}")
