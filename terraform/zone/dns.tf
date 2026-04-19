# =============================================================================
# DNSSEC - DNS レスポンスに暗号署名を付与し、DNS 応答の偽造を防ぐ
# =============================================================================

resource "cloudflare_zone_dnssec" "this" {
  zone_id = var.zone_id
  status  = "active"
}

# =============================================================================
# Email Security - メールのなりすまし対策
# =============================================================================

# DMARC レコード: SPF/DKIM に失敗したメールを全て拒否する
# p=reject = 認証に失敗したメールを受信サーバーが拒否する
resource "cloudflare_dns_record" "dmarc" {
  zone_id = var.zone_id
  type    = "TXT"
  name    = "_dmarc.${var.domain}"
  content = "v=DMARC1; p=reject"
  ttl     = 1
  comment = "DMARC: 認証失敗メールを全て拒否"
}
