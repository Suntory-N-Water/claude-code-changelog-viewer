# Cloudflare Access - 管理画面のアクセス制御

# /admin/weekly と画像アップロード API をメールアドレスで限定する
resource "cloudflare_zero_trust_access_application" "weekly_admin" {
  zone_id              = var.zone_id
  name                 = "週次アップデート記事の選定"
  type                 = "self_hosted"
  session_duration     = "168h"
  app_launcher_visible = false

  destinations = [
    {
      type = "public"
      uri  = "${var.domain}/admin/weekly"
    },
    {
      type = "public"
      uri  = "${var.domain}/api/uploads"
    },
  ]

  policies = [
    {
      name       = "許可メールアドレス"
      decision   = "allow"
      precedence = 1
      include = [
        for email in var.weekly_admin_allowed_emails : {
          email = {
            email = email
          }
        }
      ]
    },
  ]
}

output "weekly_admin_aud" {
  description = "notification-worker の CF_ACCESS_AUD に設定する Access Application AUD"
  value       = cloudflare_zero_trust_access_application.weekly_admin.aud
}
