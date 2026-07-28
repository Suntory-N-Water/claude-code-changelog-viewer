# Bot Management - ボット対策設定

# Bot Fight Mode を無効化
# Free ゾーンプランでは WAF カスタムルールで Bot Fight Mode をバイパスできないため OFF にしている
# Pro プランにアップグレードした場合は fight_mode = true + Super Bot Fight Mode の設定に切り替える
resource "cloudflare_bot_management" "main" {
  zone_id    = var.zone_id
  fight_mode = false

  # JavaScript Detections を無効化
  # 有効だと Cloudflare が HTML にスクリプトを挿入し、その副作用で HTML から ETag が剥がれる。
  # ETag が無いと 304 が成立せず、訪問のたびに全 HTML が再ダウンロードされる。
  # 判定結果 cf.bot_management.js_detection.passed は Enterprise Bot Management 前提で、
  # 下の WAF カスタムルールも参照していないため、有効にしていても防御の効果はない。
  enable_js = false
}

# WAF カスタムルール - 不審クローラーブロック
resource "cloudflare_ruleset" "block_suspicious_crawlers" {
  zone_id     = var.zone_id
  name        = "不審クローラーブロック"
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  description = "偽装UAおよびUAなしスキャナーのブロック"

  rules = [
    {
      action      = "block"
      expression  = "(ip.src in {45.86.200.0/24})"
      description = "F.N.S. Holdings Limited (NL) - 古いUA偽装クローラー"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(ip.src in {185.82.72.0/24})"
      description = "Pulsant (NL) - 古いUA偽装クローラー"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(ip.src in {74.249.238.26 98.159.37.132})"
      description = "UAなしスキャナー - 404多数"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(http.request.uri.path contains \".php\" or http.request.uri.path contains \"/wp-admin\" or http.request.uri.path contains \"/wp-login\")"
      description = "PHPシェル・WordPressスキャナー - 非PHPサイトへのプローブ"
      enabled     = true
    },
    {
      action      = "block"
      expression  = "(ip.src in {216.73.162.14 136.144.17.4})"
      description = "UA偽装PHPウェブシェルスキャナー"
      enabled     = true
    }
  ]
}
