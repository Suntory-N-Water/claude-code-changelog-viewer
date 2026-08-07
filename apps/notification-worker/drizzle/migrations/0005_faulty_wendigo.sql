CREATE TABLE `changelog_item_feature_areas` (
	`version` text NOT NULL,
	`item_id` text NOT NULL,
	`feature_area` text NOT NULL,
	PRIMARY KEY(`version`, `item_id`, `feature_area`)
);
--> statement-breakpoint
CREATE TABLE `changelog_items` (
	`version` text NOT NULL,
	`item_id` text NOT NULL,
	`content` text NOT NULL,
	`content_ja` text,
	`prefix` text NOT NULL,
	`inference_before` text,
	`inference_after` text,
	`inference_benefit` text,
	`search_text` text NOT NULL,
	PRIMARY KEY(`version`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `changelog_versions` (
	`version` text PRIMARY KEY NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE TABLE `settings_reference` (
	`key` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`source` text NOT NULL,
	`description_en` text NOT NULL,
	`description_ja` text NOT NULL,
	`use_case_ja` text,
	`official_doc_urls` text
);
