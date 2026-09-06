import { workerLogger } from '../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { createChangelogMcpServer } from '../mcp/server';
import { rateLimit } from './rate-limit';

const logger = workerLogger('routes.mcp');

export const mcpRoute = new Hono<{ Bindings: CloudflareBindings }>().all(
  '/',
  rateLimit((env) => env.MCP_RATE_LIMITER, 'mcp', 'リクエストが多すぎます'),
  async (c) => {
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
