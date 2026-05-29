DROP INDEX `idx_channels_is_active`;--> statement-breakpoint
ALTER TABLE `channels` ADD `deactivated_at` text DEFAULT '9999-12-31' NOT NULL;--> statement-breakpoint
ALTER TABLE `channels` ADD `deactivated_reason` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_channels_deactivated_at` ON `channels` (`deactivated_at`);--> statement-breakpoint
ALTER TABLE `channels` DROP COLUMN `is_active`;
