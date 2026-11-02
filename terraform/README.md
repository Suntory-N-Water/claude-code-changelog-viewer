# Terraform コマンド

初回は `zone/backend.hcl.example` と `zone/terraform.tfvars.example` をコピーして値を埋める。
state は R2 に置いているため、`backend.hcl` がないと init できない。

```bash
# このディレクトリから実行
source .env && terraform -chdir=zone init -backend-config=backend.hcl
source .env && terraform -chdir=zone plan
source .env && terraform -chdir=zone apply
```

commit 前に整形し、構文が正しいか確かめる。

```bash
terraform fmt -recursive
terraform -chdir=zone validate
```
