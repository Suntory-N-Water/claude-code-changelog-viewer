// #906 の切り替え前は、未使用の Workflow 用 secret を deploy 必須にしない。
interface CloudflareBindings {
  DEPLOY_HOOK_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  D1_REST_API_TOKEN?: string;
}
