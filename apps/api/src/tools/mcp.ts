import { z } from 'zod'
import { tool, type ToolDef } from './registry.js'

/**
 * Model Context Protocol tool adapter.
 *
 * Wraps a remote MCP tool as a local ToolDef so it lives in the same registry
 * as built-in tools and is therefore subject to the same tool-call budget. The
 * transport is a thin JSON-RPC over HTTP call to an MCP server. The point here
 * is budget enforcement: an agent must not be able to dodge the tool cap by
 * calling tools through MCP rather than the built-in registry.
 */
export interface McpToolSpec {
  /** Local name the graph references. */
  name: string
  description: string
  /** Argument schema validated before the call leaves the box. */
  schema: z.ZodTypeAny
  /** MCP server base URL, JSON-RPC endpoint. */
  serverUrl: string
  /** Remote tool name on the MCP server (defaults to `name`). */
  remoteName?: string
}

export function registerMcpTool(spec: McpToolSpec): ToolDef {
  return tool(spec.name, {
    description: spec.description,
    schema: spec.schema,
    mcp: true,
    handler: async (args) => callMcp(spec.serverUrl, spec.remoteName ?? spec.name, args),
  })
}

async function callMcp(serverUrl: string, name: string, args: unknown): Promise<unknown> {
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  if (!res.ok) throw new Error(`MCP ${name} ${res.status}`)
  const json = (await res.json()) as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(`MCP ${name}: ${json.error.message}`)
  return json.result
}
