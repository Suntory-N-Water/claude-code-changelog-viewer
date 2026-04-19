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
