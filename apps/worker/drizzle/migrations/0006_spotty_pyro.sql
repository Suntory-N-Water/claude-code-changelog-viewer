CREATE TABLE `changelog_diff_event_items` (
	`version` text NOT NULL,
	`detected_at` text NOT NULL,
	`direction` text NOT NULL,
	`seq` integer NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`version`, `detected_at`, `direction`, `seq`)
);
--> statement-breakpoint
CREATE TABLE `changelog_diff_events` (
	`version` text NOT NULL,
	`detected_at` text NOT NULL,
	`type` text NOT NULL,
	PRIMARY KEY(`version`, `detected_at`)
);
--> statement-breakpoint
CREATE TABLE `changelog_item_related_docs` (
	`version` text NOT NULL,
	`item_id` text NOT NULL,
	`doc_path` text NOT NULL,
	PRIMARY KEY(`version`, `item_id`, `doc_path`)
);
--> statement-breakpoint
CREATE TABLE `settings_official_docs` (
	`setting_key` text NOT NULL,
	`doc_path` text NOT NULL,
	PRIMARY KEY(`setting_key`, `doc_path`)
);
--> statement-breakpoint
ALTER TABLE `settings_reference` ADD `leaf_name` text;--> statement-breakpoint
ALTER TABLE `settings_reference` ADD `fetched_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings_reference` DROP COLUMN `official_doc_urls`;