// Cloudflare Workers が CacheStorage に追加する拡張
// biome-ignore lint/style/useConsistentTypeDefinitions: Interface merging is required for extending global types
interface CacheStorage {
  default: Cache;
}
