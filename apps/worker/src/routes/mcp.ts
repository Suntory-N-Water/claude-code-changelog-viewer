import { createMcpHandler } from '@modelcontextprotocol/server';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { createChangelogMcpServer } from '../mcp/server';

export const mcpRoute = new Hono<{ Bindings: CloudflareBindings }>().all(
  '/',
  async (c) => {
    const clientKey = c.req.header('CF-Connecting-IP') ?? 'unknown-client';
    const rateLimit = await c.env.MCP_RATE_LIMITER.limit({
      key: `mcp:${clientKey}`,
    });
    if (!rateLimit.success) {
      c.header('Retry-After', '60');
      return c.json({ error: 'リクエストが多すぎます' }, 429);
    }

    // 2026-07-28 (modern era) を有効化できる公開 API は createMcpHandler だけ。
    // McpServer を手動で WebStandardStreamableHTTPServerTransport に connect する構成では
    // server/discover ハンドラが登録されず 2025 era 止まりになる。
    // legacy: 'stateless' により 2025 era のクライアントもステートレスで処理される
    const handler = createMcpHandler(
      () => createChangelogMcpServer(drizzle(c.env.DB)),
      { legacy: 'stateless' },
    );
    return handler.fetch(c.req.raw);
  },
);
