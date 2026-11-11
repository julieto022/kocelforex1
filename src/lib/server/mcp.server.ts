import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { logger } from "@/lib/api/logger";
import { hashSecretValue } from "@/lib/server/crypto.server";
import { recordAudit } from "@/lib/server/audit.server";
import { tradeExecutionRequestSchema } from "@/lib/server/trade.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

type McpApiKey = {
  id: string;
  user_id: string;
  connection_id: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function authenticateMcpApiKey(request: Request): Promise<McpApiKey | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!/^kocel_mcp_[A-Za-z0-9_-]{40,}$/.test(token)) return null;

  const db = await admin();
  const { data: key, error } = await db
    .from("mcp_api_keys")
    .select("id, user_id, connection_id")
    .eq("token_hash", await hashSecretValue(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!key) return null;

  await enforceRateLimit("mcp", key.id);
  const { data: activeKey, error: updateError } = await db
    .from("mcp_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  return activeKey ? key : null;
}

const mcpTradeProposalArgsSchema = z
  .object({
    operation: z.enum([
      "OPEN_MARKET",
      "CLOSE_POSITION",
      "MODIFY_POSITION",
      "PARTIAL_CLOSE",
      "MOVE_TO_BREAK_EVEN",
      "CANCEL_PENDING_ORDER",
    ]),
    symbol: z.string().trim().min(1).max(32).optional(),
    side: z.enum(["BUY", "SELL"]).optional(),
    volume: z.number().positive().optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
    positionTicket: z.number().int().positive().optional(),
    orderTicket: z.number().int().positive().optional(),
  })
  .strict();

export function prepareMcpTradeProposal(connectionId: string, args: unknown) {
  const validatedArgs = mcpTradeProposalArgsSchema.parse(args);
  return tradeExecutionRequestSchema.parse({
    ...validatedArgs,
    connectionId,
    clientRequestId: crypto.randomUUID(),
  });
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function safeTool<TArgs extends object>(
  name: string,
  handler: (args: TArgs) => Promise<ReturnType<typeof textResult>>,
) {
  return async (args: TArgs) => {
    try {
      return await handler(args);
    } catch (error) {
      logger.error("api", "MCP tool failed", { tool: name, error });
      return {
        content: [{ type: "text" as const, text: "The MCP request could not be completed." }],
        isError: true,
      };
    }
  };
}

async function connectionRow(userId: string, connectionId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("broker_connections")
    .select(
      "id, user_id, account_name, broker_id, server, environment, status, balance, equity, margin, free_margin, margin_level, currency, leverage, last_sync_at, last_seen_at",
    )
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The MT5 account connected to this MCP key is unavailable.");
  const { data: broker, error: brokerError } = await db
    .from("brokers")
    .select("name")
    .eq("id", data.broker_id)
    .maybeSingle();
  if (brokerError) throw brokerError;
  return { ...data, brokerName: broker?.name ?? null };
}

export function createKocelMcpServer(key: McpApiKey): McpServer {
  const server = new McpServer(
    { name: "kocel-forex-hub", version: "1.0.0" },
    {
      instructions:
        "Read MT5 account data and submit trade proposals. Never claim a trade was placed until the user approves the proposal in Kocel and the MT5 Bridge reports its result.",
    },
  );

  server.registerTool(
    "get_mt5_account",
    {
      title: "Get MT5 account status",
      description:
        "Read the status and latest financial snapshot for the single MT5 account scoped to this MCP key.",
      inputSchema: {},
    },
    safeTool("get_mt5_account", async () => {
      const account = await connectionRow(key.user_id, key.connection_id);
      return textResult({
        accountName: account.account_name,
        broker: account.brokerName,
        server: account.server,
        environment: account.environment,
        status: account.status,
        balance: account.balance,
        equity: account.equity,
        margin: account.margin,
        freeMargin: account.free_margin,
        marginLevel: account.margin_level,
        currency: account.currency,
        leverage: account.leverage,
        lastSyncAt: account.last_sync_at,
      });
    }),
  );

  server.registerTool(
    "list_open_positions",
    {
      title: "List open MT5 positions",
      description: "Read open positions from the MT5 account scoped to this MCP key.",
      inputSchema: {},
    },
    safeTool("list_open_positions", async () => {
      const db = await admin();
      const { data, error } = await db
        .from("mt5_open_positions")
        .select(
          "ticket, symbol, direction, volume, open_price, current_price, stop_loss, take_profit, current_profit, swap, opened_at",
        )
        .eq("user_id", key.user_id)
        .eq("broker_connection_id", key.connection_id)
        .order("opened_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return textResult(data ?? []);
    }),
  );

  server.registerTool(
    "list_pending_orders",
    {
      title: "List pending MT5 orders",
      description: "Read pending orders from the MT5 account scoped to this MCP key.",
      inputSchema: {},
    },
    safeTool("list_pending_orders", async () => {
      const db = await admin();
      const { data, error } = await db
        .from("mt5_pending_orders")
        .select(
          "ticket, symbol, order_type, volume, price, stop_loss, take_profit, state, created_at",
        )
        .eq("user_id", key.user_id)
        .eq("broker_connection_id", key.connection_id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return textResult(data ?? []);
    }),
  );

  server.registerTool(
    "propose_trade",
    {
      title: "Propose an MT5 trade",
      description:
        "Create a trade proposal for the user to review in Kocel. This tool never sends orders to MT5. The user must approve each proposal in the Kocel MCP page; configured risk limits are checked when the approved command is submitted.",
      inputSchema: { ...mcpTradeProposalArgsSchema.shape },
    },
    safeTool("propose_trade", async (args) => {
      const payload = prepareMcpTradeProposal(key.connection_id, args);
      await connectionRow(key.user_id, key.connection_id);

      const db = await admin();
      const { data: proposal, error } = await db
        .from("mcp_trade_requests")
        .insert({
          user_id: key.user_id,
          connection_id: key.connection_id,
          api_key_id: key.id,
          payload,
          status: "PENDING_APPROVAL",
        })
        .select("id, status, created_at")
        .single();
      if (error || !proposal) throw error ?? new Error("The trade proposal could not be saved.");

      await recordAudit({
        userId: key.user_id,
        action: "MCP_TRADE_PROPOSED",
        entityType: "mcp_trade_request",
        entityId: proposal.id,
      });

      return textResult({
        proposalId: proposal.id,
        status: proposal.status,
        createdAt: proposal.created_at,
        message: "Proposal saved. It will not be sent to MT5 unless the user approves it in Kocel.",
      });
    }),
  );

  return server;
}

export function createMcpTransport(): WebStandardStreamableHTTPServerTransport {
  const allowedHosts = new Set([
    "kocelforex1.vercel.app",
    "localhost",
    "localhost:3000",
    "localhost:5173",
    "127.0.0.1",
    "127.0.0.1:3000",
    "127.0.0.1:5173",
  ]);
  const configuredUrls = [process.env["PUBLIC_APP_URL"], process.env["VERCEL_URL"]];
  for (const value of configuredUrls) {
    if (!value) continue;
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      allowedHosts.add(url.host);
    } catch {
      throw new Error("The MCP host configuration is invalid.");
    }
  }

  return new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    enableDnsRebindingProtection: true,
    allowedHosts: [...allowedHosts],
  });
}
