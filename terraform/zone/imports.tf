# D1 バックアップ用バケットは Terraform 外で先に作られていて state に無く、そのままだと apply が同名バケットの作成で失敗する
# 一度 apply して state に取り込んだら、このファイルは消してよい
import {
  to = cloudflare_r2_bucket.d1_backup
  id = "${var.account_id}/changelog-viewer-d1-backup/default"
}
