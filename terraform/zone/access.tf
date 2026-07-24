# Cloudflare Access - 管理画面のアクセス制御

# /admin/weekly をメールアドレスで限定する
resource "cloudflare_zero_trust_access_application" "weekly_admin" {
  zone_id              = var.zone_id
  name                 = "週次アップデート記事の選定"
  domain               = "${var.domain}/admin/weekly"
  type                 = "self_hosted"
  session_duration     = "168h"
  app_launcher_visible = false

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
