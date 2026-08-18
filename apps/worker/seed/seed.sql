-- ローカル画面確認用の最小シード。
-- apps/worker/scripts/generate-seed.ts で本番 D1 から再生成できる。

DELETE FROM settings_official_docs;
DELETE FROM settings_reference;
DELETE FROM changelog_item_related_docs;
DELETE FROM changelog_item_feature_areas;
DELETE FROM changelog_items;
DELETE FROM changelog_versions;
DELETE FROM changelog_diff_event_items;
DELETE FROM changelog_diff_events;

INSERT INTO changelog_versions (version, summary) VALUES
  ('2.1.234', '権限設定と複数の連携機能が改善されました。'),
  ('2.1.233', NULL),
  ('2.1.232', '開発体験に関する変更が追加されました。');

INSERT INTO changelog_items (
  version, item_id, content, content_ja, prefix,
  inference_before, inference_after, inference_benefit, search_text
) VALUES
  (
    '2.1.234', 'aaaaaaaaaaaa',
    '- Changed permissions.allow so permission rules can be scoped to a project.',
    '- permissions.allow でプロジェクト単位の権限ルールを指定できるようになりました。',
    'Breaking',
    '権限ルールをプロジェクト単位で細かく指定できませんでした。',
    'permissions.allow でプロジェクト単位のルールを設定できます。',
    '必要な操作だけを許可しやすくなり、安全に自動化できます。',
    'changed permissions.allow so permission rules can be scoped to a project.\n- permissions.allow でプロジェクト単位の権限ルールを指定できるようになりました。\n権限設定と複数の連携機能が改善されました。'
  ),
  (
    '2.1.234', 'bbbbbbbbbbbb',
    '- Added MCP server connection diagnostics to show failed tool calls.',
    NULL,
    'Added',
    NULL, NULL, NULL,
    'added mcp server connection diagnostics to show failed tool calls.'
  ),
  (
    '2.1.234', 'cccccccccccc',
    '- Deprecated the legacy Plugins discovery command.',
    '- 旧 Plugins 検索コマンドを非推奨にしました。',
    'Deprecated',
    NULL, NULL, NULL,
    'deprecated the legacy plugins discovery command.\n- 旧 plugins 検索コマンドを非推奨にしました。'
  ),
  (
    '2.1.234', 'dddddddddddd',
    '- Changed settings validation to report the exact invalid key.',
    NULL,
    'Changed',
    NULL, NULL, NULL,
    'changed settings validation to report the exact invalid key.'
  ),
  (
    '2.1.234', 'eeeeeeeeeeee',
    '- Improved IDE connection status messages.',
    '- IDE 接続状態のメッセージを改善しました。',
    'Improved',
    NULL, NULL, NULL,
    'improved ide connection status messages.\n- ide 接続状態のメッセージを改善しました。'
  ),
  (
    '2.1.234', 'ffffffffffff',
    '- Fixed a typo in the command help output.',
    NULL,
    'Fixed',
    NULL, NULL, NULL,
    'fixed a typo in the command help output.'
  ),
  (
    '2.1.233', 'gggggggggggg',
    '- Updated Skills loading to report the source file.',
    NULL,
    'Updated',
    NULL, NULL, NULL,
    'updated skills loading to report the source file.'
  ),
  (
    '2.1.233', 'hhhhhhhhhhhh',
    '- Removed the obsolete Hooks example from generated help.',
    '- 生成されるヘルプから古い Hooks の例を削除しました。',
    'Removed',
    '古い Hooks の例が生成されるヘルプに残っていました。',
    '不要になった Hooks の例を生成対象から除外します。',
    'ヘルプの内容が現在の使い方と一致し、迷いにくくなります。',
    'removed the obsolete hooks example from generated help.\n- 生成されるヘルプから古い hooks の例を削除しました。'
  ),
  (
    '2.1.233', 'iiiiiiiiiiii',
    '- Enabled background Sub-agents by default for long-running tasks.',
    NULL,
    'Enabled',
    NULL, NULL, NULL,
    'enabled background sub-agents by default for long-running tasks.'
  ),
  (
    '2.1.232', 'jjjjjjjjjjjj',
    '- Fixed Skills and MCP documentation links in the status screen.',
    NULL,
    'Fixed',
    NULL, NULL, NULL,
    'fixed skills and mcp documentation links in the status screen.'
  );

INSERT INTO changelog_item_feature_areas (version, item_id, feature_area) VALUES
  ('2.1.234', 'aaaaaaaaaaaa', 'Permissions'),
  ('2.1.234', 'aaaaaaaaaaaa', 'MCP'),
  ('2.1.234', 'bbbbbbbbbbbb', 'MCP'),
  ('2.1.234', 'cccccccccccc', 'Plugins'),
  ('2.1.234', 'dddddddddddd', 'Settings'),
  ('2.1.234', 'eeeeeeeeeeee', 'IDE'),
  ('2.1.233', 'gggggggggggg', 'Skills'),
  ('2.1.233', 'hhhhhhhhhhhh', 'Hooks'),
  ('2.1.233', 'iiiiiiiiiiii', 'Sub-agents'),
  ('2.1.232', 'jjjjjjjjjjjj', 'MCP');

INSERT INTO changelog_item_related_docs (version, item_id, doc_path) VALUES
  ('2.1.234', 'aaaaaaaaaaaa', 'permissions.md'),
  ('2.1.234', 'bbbbbbbbbbbb', 'mcp.md'),
  ('2.1.234', 'eeeeeeeeeeee', 'ide.md'),
  ('2.1.233', 'gggggggggggg', 'skills.md'),
  ('2.1.233', 'hhhhhhhhhhhh', 'hooks.md');

INSERT INTO changelog_diff_events (version, detected_at, type) VALUES
  ('v2.1.234', '2026-08-18T00:00:00.000Z', 'items_changed'),
  ('v2.1.200', '2026-08-17T00:00:00.000Z', 'version_removed');

INSERT INTO changelog_diff_event_items (
  version, detected_at, direction, seq, content
) VALUES
  (
    'v2.1.234', '2026-08-18T00:00:00.000Z',
    'added', 0,
    '- Added a diagnostic message when permissions.allow cannot be parsed.'
  ),
  (
    'v2.1.234', '2026-08-18T00:00:00.000Z',
    'removed', 0,
    '- Permission errors did not identify the permissions.allow setting.'
  );

INSERT INTO settings_reference (
  key, leaf_name, slug, source, description_en, description_ja,
  use_case_ja, fetched_at
) VALUES
  (
    'permissions.allow', 'allow', 'permissions-allow', 'settings',
    'Controls allowed permission rules. See [permission settings](/en/permissions).',
    '許可する権限ルールを設定します。',
    'プロジェクトで許可する操作を限定するときに使います。',
    '2026-08-18'
  ),
  (
    'CLAUDE_CODE_ENABLE_TASKS', NULL, 'claude-code-enable-tasks', 'env',
    'Enables background task execution.',
    'バックグラウンドタスクを有効にします。',
    NULL,
    '2026-08-18'
  ),
  (
    'model', 'model', 'model', 'settings',
    'Selects the default model.',
    '既定のモデルを選択します。',
    '常に使うモデルを固定するときに使います。',
    '2026-08-18'
  ),
  (
    'mcp.server', 'server', 'mcp-server', 'settings',
    'Configures an MCP server.',
    'MCP サーバーを設定します。',
    NULL,
    '2026-08-18'
  ),
  (
    'plugins.enabled', 'enabled', 'plugins-enabled', 'settings',
    'Enables plugin loading.',
    'プラグインの読み込みを有効にします。',
    'プラグインを使う環境だけで有効にするときに使います。',
    '2026-08-18'
  ),
  (
    'skills.directory', 'directory', 'skills-directory', 'settings',
    'Sets the directory for Skills.',
    'Skills のディレクトリを設定します。',
    NULL,
    '2026-08-18'
  ),
  (
    'hooks.timeout', NULL, 'hooks-timeout', 'env',
    'Sets the Hooks timeout in seconds.',
    'Hooks のタイムアウトを秒単位で設定します。',
    '長い処理をフックから呼び出すときに使います。',
    '2026-08-18'
  ),
  (
    'ide', 'ide', 'ide', 'settings',
    'Configures IDE integration.',
    'IDE 連携を設定します。',
    NULL,
    '2026-08-18'
  ),
  (
    'permissions.mode', 'mode', 'permissions-mode', 'settings',
    'Selects the permission mode.',
    '権限モードを選択します。',
    '確認方法を切り替えるときに使います。',
    '2026-08-18'
  ),
  (
    'CLAUDE_CODE_MAX_OUTPUT_TOKENS', NULL, 'claude-code-max-output-tokens', 'env',
    'Sets the maximum output token count.',
    '最大出力トークン数を設定します。',
    NULL,
    '2026-08-18'
  );

INSERT INTO settings_official_docs (setting_key, doc_path) VALUES
  ('permissions.allow', 'permissions.md'),
  ('model', 'model-config.md'),
  ('mcp.server', 'mcp.md'),
  ('skills.directory', 'skills.md');
