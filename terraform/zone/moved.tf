# スタイルガイドに合わせてリソース名を変えたため、state 上の旧名を新名へ付け替える
# 無いと旧名の destroy と新名の create が計画され、DNSSEC やバケットが作り直しになる
# 全環境で apply し終えたら、このファイルは消してよい

moved {
  from = cloudflare_zone_dnssec.this
  to   = cloudflare_zone_dnssec.main
}

moved {
  from = cloudflare_email_routing_dns.this
  to   = cloudflare_email_routing_dns.main
}

moved {
  from = cloudflare_email_routing_catch_all.this
  to   = cloudflare_email_routing_catch_all.main
}

moved {
  from = cloudflare_ruleset.block_suspicious_crawlers
  to   = cloudflare_ruleset.suspicious_crawler_block
}

moved {
  from = cloudflare_r2_bucket.weekly_assets
  to   = cloudflare_r2_bucket.assets
}

moved {
  from = cloudflare_r2_custom_domain.weekly_assets
  to   = cloudflare_r2_custom_domain.assets
}
