terraform {
  required_version = ">= 1.14"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  # bucket と endpoints は backend.hcl から init 時に渡す(アカウント ID を含むため commit しない)
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
