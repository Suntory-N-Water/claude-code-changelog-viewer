# =============================================================================
# Edge Certificates - SSL/TLS 証明書と HTTPS 通信に関する設定
# =============================================================================

# HTTP アクセスを自動的に HTTPS へ 301 リダイレクトする
resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = var.zone_id
  setting_id = "always_use_https"
  value      = "on"
}

# HSTS（HTTP Strict Transport Security）を有効化
# ブラウザレベルで HTTPS を強制する
# X-Content-Type-Options: nosniff はアプリ側の _headers で管理するため、ここでは無効にする
resource "cloudflare_zone_setting" "security_header" {
  zone_id    = var.zone_id
  setting_id = "security_header"
  value = {
    strict_transport_security = {
      enabled            = true
      max_age            = 31536000
      include_subdomains = true
      preload            = true
      nosniff            = false
    }
  }
}

# 許可する TLS プロトコルの最低バージョンを 1.2 に設定
# TLS 1.0 / 1.1 は既知の脆弱性があるためブロックする
resource "cloudflare_zone_setting" "min_tls_version" {
  zone_id    = var.zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}

# TLS 1.3 を有効化
# min_tls_version=1.2 と組み合わせて「最低 1.2、対応していれば 1.3」の構成にする
resource "cloudflare_zone_setting" "tls_1_3" {
  zone_id    = var.zone_id
  setting_id = "tls_1_3"
  value      = "on"
}

# Opportunistic Encryption を有効化
# HTTP でアクセスしてきたブラウザに暗号化接続が利用可能であることを通知する
resource "cloudflare_zone_setting" "opportunistic_encryption" {
  zone_id    = var.zone_id
  setting_id = "opportunistic_encryption"
  value      = "on"
}

# Automatic HTTPS Rewrites を有効化
# ページ内の http:// リンクを自動的に https:// に書き換え、混在コンテンツ問題を防止する
resource "cloudflare_zone_setting" "automatic_https_rewrites" {
  zone_id    = var.zone_id
  setting_id = "automatic_https_rewrites"
  value      = "on"
}

# =============================================================================
# Security - セキュリティ設定
# =============================================================================

# Browser Integrity Check を有効化
# 訪問者の HTTP ヘッダーを検査し、不正な User-Agent やスパムボットの異常なヘッダーパターンを検出する
resource "cloudflare_zone_setting" "browser_check" {
  zone_id    = var.zone_id
  setting_id = "browser_check"
  value      = "on"
}

# チャレンジ（CAPTCHA 等）クリア後の有効時間を 30 分に設定
resource "cloudflare_zone_setting" "challenge_ttl" {
  zone_id    = var.zone_id
  setting_id = "challenge_ttl"
  value      = "1800"
}

# =============================================================================
# Speed - パフォーマンス設定
# =============================================================================

# NOTE: HTTP/2 は Cloudflare で常時有効のため Terraform 管理対象外

# HTTP/3（QUIC）を有効化
# TCP の代わりに QUIC プロトコルを使い、接続確立が高速でパケットロス時の劣化も少ない
resource "cloudflare_zone_setting" "http3" {
  zone_id    = var.zone_id
  setting_id = "http3"
  value      = "on"
}

# 0-RTT Connection Resumption を有効化
# TLS 1.3 で接続済みのクライアントが再訪問時にハンドシェイクの往復を省略できる
resource "cloudflare_zone_setting" "zero_rtt" {
  zone_id    = var.zone_id
  setting_id = "0rtt"
  value      = "on"
}
