variable "zone_id" {
  description = "Cloudflare Zone ID"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "ドメイン名"
  type        = string
  default     = "claude-code-log.com"
}

variable "forwarding_email" {
  description = "メール転送先アドレス"
  type        = string
  sensitive   = true
}

variable "weekly_admin_allowed_emails" {
  description = "週次アップデート記事の選定画面へのアクセスを許可するメールアドレス"
  type        = set(string)

  validation {
    condition     = length(var.weekly_admin_allowed_emails) > 0
    error_message = "少なくとも1つのメールアドレスを指定してください。"
  }
}
