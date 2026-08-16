# 正データ用 D1 の定期 export の保存先。通知購読者を含むため公開しない
resource "cloudflare_r2_bucket" "d1_backup" {
  account_id = var.account_id
  name       = "changelog-viewer-d1-backup"
}

resource "cloudflare_r2_bucket_lifecycle" "d1_backup" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.d1_backup.name
  rules = [{
    id      = "1年経過した export を削除する"
    enabled = true
    conditions = {
      prefix = "notification-db/"
    }
    delete_objects_transition = {
      condition = {
        max_age = 31536000
        type    = "Age"
      }
    }
  }]
}

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
