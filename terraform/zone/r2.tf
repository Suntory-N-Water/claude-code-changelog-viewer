# 週次アップデート記事に添付する画像の保存先
resource "cloudflare_r2_bucket" "weekly_assets" {
  account_id = var.account_id
  name       = "weekly-assets"
}

# R2 の画像を公開配信するカスタムドメイン
resource "cloudflare_r2_custom_domain" "weekly_assets" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.weekly_assets.name
  domain      = "assets.${var.domain}"
  enabled     = true
  zone_id     = var.zone_id
  min_tls     = "1.2"
}
