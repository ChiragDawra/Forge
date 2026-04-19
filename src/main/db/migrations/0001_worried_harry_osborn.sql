CREATE INDEX `idx_model_usage_called_at` ON `model_usage` (`called_at`);--> statement-breakpoint
CREATE INDEX `idx_model_usage_project_called_at` ON `model_usage` (`project_id`,`called_at`);