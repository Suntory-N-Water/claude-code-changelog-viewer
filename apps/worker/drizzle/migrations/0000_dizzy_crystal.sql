CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_type` text(3) NOT NULL,
	`token` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_token_unique` ON `channels` (`token`);--> statement-breakpoint
CREATE INDEX `idx_channels_is_active` ON `channels` (`is_active`);--> statement-breakpoint
CREATE TABLE `discord_channels` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`webhook_url` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_channels_webhook_url_unique` ON `discord_channels` (`webhook_url`);--> statement-breakpoint
CREATE TABLE `email_channels` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`email_address` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_channels_email_address_unique` ON `email_channels` (`email_address`);--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`frequency` text(3) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notification_settings_channel_id` ON `notification_settings` (`channel_id`);--> statement-breakpoint
CREATE TABLE `slack_channels` (
	`channel_id` text PRIMARY KEY NOT NULL,
	`webhook_url` text NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slack_channels_webhook_url_unique` ON `slack_channels` (`webhook_url`);
