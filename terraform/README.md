## Terraform コマンド

```bash
# プロジェクトルートから実行
source .env && terraform -chdir=terraform/zone init
source .env && terraform -chdir=terraform/zone plan
source .env && terraform -chdir=terraform/zone apply
```
