# =============================================================================
# Email Routing - 受信メールの転送設定
# SPF/MX/DKIM は Email Routing が自動管理するため手動定義不要
# =============================================================================

resource "cloudflare_email_routing_dns" "this" {
  zone_id = var.zone_id
  name    = var.domain
}

resource "cloudflare_email_routing_rule" "info" {
  zone_id  = var.zone_id
  name     = "info 転送"
  enabled  = true
  priority = 0

  matchers = [{
    type  = "literal"
    field = "to"
    value = "info@${var.domain}"
  }]

  actions = [{
    type  = "forward"
    value = [var.forwarding_email]
  }]
}

# catch-all は無効化（それ以外のアドレス宛は受け取らない）
resource "cloudflare_email_routing_catch_all" "this" {
  zone_id = var.zone_id
  name    = "その他は破棄"
  enabled = true

  matchers = [{
    type = "all"
  }]

  actions = [{
    type  = "drop"
    value = []
  }]
}
