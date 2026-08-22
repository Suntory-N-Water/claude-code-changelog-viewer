import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { createChangelogMcpServer } from '../mcp/server';

const logger = getLogger({
  name: 'routes.mcp',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

export const mcpRoute = new Hono<{ Bindings: CloudflareBindings }>().all(
  '/',
  async (c) => {
    const clientKey = c.req.header('CF-Connecting-IP') ?? 'unknown-client';
    const rateLimit = await c.env.MCP_RATE_LIMITER.limit({
      key: `mcp:${clientKey}`,
    });
    if (!rateLimit.success) {
      c.header('Retry-After', '60');
      logger.warn('レート制限を超過しました', {
        route: 'mcp',
        'client.address': clientKey,
      });
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
    try {
      const response = await handler.fetch(c.req.raw);
      logger.info('MCP リクエストが完了しました', {
        route: 'mcp',
        'http.response.status_code': response.status,
      });
      return response;
    } catch (error) {
      logger.error('MCP リクエストに失敗しました', {
        route: 'mcp',
        error: toError(error),
      });
      throw error;
    }
  },
);
