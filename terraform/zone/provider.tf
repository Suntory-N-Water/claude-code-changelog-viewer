terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 5"
    }
  }

  backend "s3" {
    bucket                      = ""
    key                         = "claude-code-log/zone/terraform.tfstate"
    region                      = "auto"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
    endpoints = {
      s3 = ""
    }
  }
}

# API トークンは環境変数 CLOUDFLARE_API_TOKEN から自動読み込み
provider "cloudflare" {}
