#!/usr/bin/env python3
import re
import hashlib
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone


def parse_changelog(changelog_content):
    """CHANGELOGをバージョンごとに分割"""
    versions = {}
    current_version = None
    current_content = []

    for line in changelog_content.split("\n"):
        # バージョンヘッダーを検出
        match = re.match(r"^## (\d+\.\d+\.\d+)", line)
        if match:
            # 前のバージョンを保存
            if current_version:
                versions[current_version] = "\n".join(current_content).strip()

            # 新しいバージョンを開始
            current_version = match.group(1)
            current_content = []
        elif current_version:
            current_content.append(line)

    # 最後のバージョンを保存
    if current_version:
        versions[current_version] = "\n".join(current_content).strip()

    return versions


def calculate_hash(content):
    """コンテンツのSHA256ハッシュを計算"""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def fetch_changelog(repo):
    """GitHubからCHANGELOG.mdを取得"""
    print(f"Fetching CHANGELOG.md from {repo}...")

    # ダウンロードURLを取得
    result = subprocess.run(
        ["gh", "api", f"repos/{repo}/contents/CHANGELOG.md", "--jq", ".download_url"],
        capture_output=True,
        text=True,
        check=True,
    )
    download_url = result.stdout.strip()

    # ダウンロード
    result = subprocess.run(
        ["curl", "-sL", download_url], capture_output=True, text=True, check=True
    )

    return result.stdout


def main():
    # スクリプトのディレクトリを取得
    script_dir = Path(__file__).parent
    app_dir = script_dir.parent
    output_dir = app_dir / "changelogs"
    metadata_file = app_dir / "metadata" / "last_fetch.json"

    # ディレクトリ作成
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_file.parent.mkdir(parents=True, exist_ok=True)

    # CHANGELOGを取得
    repo = "anthropics/claude-code"
    changelog_content = fetch_changelog(repo)

    print("Processing changelog entries...")

    # パース
    versions = parse_changelog(changelog_content)

    # 既存のメタデータを読み込み
    existing_metadata = {}
    if metadata_file.exists():
        with open(metadata_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            existing_metadata = data.get("versions", {})

    # 統計
    new_count = 0
    updated_count = 0
    unchanged_count = 0

    # 新しいメタデータ
    new_metadata = {}

    # 各バージョンを処理
    for version, content in versions.items():
        version_key = f"v{version}"
        content_hash = calculate_hash(content)

        version_file = output_dir / f"{version_key}.md"
        existing_hash = existing_metadata.get(version_key, "")

        # ハッシュが変わっていない場合はスキップ
        if content_hash == existing_hash and version_file.exists():
            print(f"  → {version_key}: Unchanged")
            unchanged_count += 1
        else:
            # ファイルに保存
            full_content = f"## {version}\n\n{content}\n"
            with open(version_file, "w", encoding="utf-8") as f:
                f.write(full_content)

            if existing_hash:
                print(f"  ✓ {version_key}: Updated")
                updated_count += 1
            else:
                print(f"  ✓ {version_key}: New")
                new_count += 1

        # メタデータに記録
        new_metadata[version_key] = content_hash

    # メタデータを保存
    timestamp = datetime.now(timezone.utc).astimezone().isoformat()
    metadata = {
        "lastFetchTime": timestamp,
        "versions": new_metadata,
        "stats": {
            "new": new_count,
            "updated": updated_count,
            "unchanged": unchanged_count,
        },
    }

    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    # 統計を出力
    print()
    print("✓ Fetch completed:")
    print(f"  - New: {new_count}")
    print(f"  - Updated: {updated_count}")
    print(f"  - Unchanged: {unchanged_count}")


if __name__ == "__main__":
    main()
