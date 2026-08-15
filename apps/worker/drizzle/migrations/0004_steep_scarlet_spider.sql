CREATE TABLE `notification_deliveries` (
	`version` text NOT NULL,
	`channel_id` text NOT NULL,
	`delivered_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`version`, `channel_id`),
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
