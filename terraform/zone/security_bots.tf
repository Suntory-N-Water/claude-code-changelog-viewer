# Bot Management - ボット対策設定

# Bot Fight Mode を無効化
# Free ゾーンプランでは WAF カスタムルールで Bot Fight Mode をバイパスできないため OFF にしている
# Pro プランにアップグレードした場合は fight_mode = true + Super Bot Fight Mode の設定に切り替える
resource "cloudflare_bot_management" "main" {
  zone_id    = var.zone_id
  fight_mode = false
}
