import { McpServer } from '@modelcontextprotocol/server';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { registerGetChangelogTool } from './tools/get-changelog';
import { registerGetSettingsReferenceTool } from './tools/get-settings-reference';
import { registerSearchChangelogTool } from './tools/search-changelog';

export function createChangelogMcpServer(db: DrizzleD1Database): McpServer {
  const server = new McpServer({
    name: 'claude-code-changelog',
    version: '1.0.0',
  });
  registerSearchChangelogTool(server, db);
  registerGetChangelogTool(server, db);
  registerGetSettingsReferenceTool(server, db);
  return server;
}
