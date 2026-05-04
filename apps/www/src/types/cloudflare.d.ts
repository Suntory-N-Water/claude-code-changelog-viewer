// Cloudflare Workers が CacheStorage に追加する拡張
interface CacheStorage {
  default: Cache;
}
