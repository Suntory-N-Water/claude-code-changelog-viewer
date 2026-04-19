-- email_channels テーブル再作成
-- SQLite は ADD COLUMN NOT NULL(DEFAULTなし)不可のため、テーブル再作成で対応
CREATE TABLE `email_channels_new` (
  `channel_id` text NOT NULL PRIMARY KEY REFERENCES `channels`(`id`),
  `email_hash` text NOT NULL,
  `email_encrypted` text NOT NULL
);--> statement-breakpoint
INSERT INTO `email_channels_new` (`channel_id`, `email_hash`, `email_encrypted`)
  SELECT `channel_id`, `email_address`, '' FROM `email_channels`;--> statement-breakpoint
DROP TABLE `email_channels`;--> statement-breakpoint
ALTER TABLE `email_channels_new` RENAME TO `email_channels`;--> statement-breakpoint
CREATE UNIQUE INDEX `email_channels_email_hash_unique` ON `email_channels` (`email_hash`);
