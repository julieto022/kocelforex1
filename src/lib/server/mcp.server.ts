import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { forbidden, isApiError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { hashSecretValue } from "@/lib/server/crypto.server";
import { recordAudit } from "@/lib/server/audit.server";
import {
  deleteBacktestRun,
  getBacktestCatalog,
  getBacktestRun,
  runBacktestForUser,
} from "@/lib/server/backtest.server";
import {
  createMcpBot,
  createMcpStrategy,
  deleteMcpBot,
  deleteMcpStrategy,
  listMcpBots,
  listMcpStrategies,
  setMcpBotStatus,
  updateMcpBot,
  updateMcpStrategy,
} from "@/lib/server/mcp-management.server";
import { executeTradeCommand, tradeExecutionRequestSchema } from "@/lib/server/trade.server";
import { enforceRateLimit } from "@/lib/server/rate-limit.server";

type McpApiKey = {
  id: string;
  user_id: string;
  connection_id: string;
  can_trade_directly: boolean;
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
    .select("id, user_id, connection_id, can_trade_directly")
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

const mcpTradeArgsSchema = z
  .object({
    operation: z.enum([
      "OPEN_MARKET",
      "CLOSE_POSITION",
      "MODIFY_POSITION",
      "PARTIAL_CLOSE",
      "MOVE_TO_BREAK_EVEN",
      "CANCEL_PENDING_ORDER",
    ]),
    clientRequestId: z.string().uuid(),
    symbol: z.string().trim().min(1).max(32).optional(),
    side: z.enum(["BUY", "SELL"]).optional(),
    volume: z.number().positive().optional(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
    positionTicket: z.number().int().positive().optional(),
    orderTicket: z.number().int().positive().optional(),
  })
  .strict();

export function prepareMcpTradeExecution(connectionId: string, args: unknown) {
  const validatedArgs = mcpTradeArgsSchema.parse(args);
  return tradeExecutionRequestSchema.parse({
    ...validatedArgs,
    connectionId,
  });
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

const createBotArgsSchema = z.object({
  name: z.string().trim().min(2).max(60),
  symbol: z.string().trim().min(2).max(64),
  strategyId: z.string().uuid(),
  timeframe: z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]),
  riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]).default("BALANCED"),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

const updateBotArgsSchema = z
  .object({
    botId: z.string().uuid(),
    name: z.string().trim().min(2).max(60).optional(),
    symbol: z.string().trim().min(2).max(64).optional(),
    strategyId: z.string().uuid().optional(),
    timeframe: z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]).optional(),
    riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const createStrategyArgsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().min(1).max(60).default("Custom"),
  description: z.string().max(4000).default(""),
  shortDescription: z.string().max(240).default(""),
  engineSlug: z.string().trim().min(1).max(80),
  timeframes: z.array(z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"])).default([]),
  markets: z.array(z.string().trim().min(1).max(40)).default([]),
  configuration: z.record(z.string(), z.unknown()).optional(),
});

const editStrategyArgsSchema = z
  .object({
    strategyId: z.string().uuid(),
    name: z.string().trim().min(2).max(80).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    description: z.string().max(4000).optional(),
    shortDescription: z.string().max(240).optional(),
    engineSlug: z.string().trim().min(1).max(80).optional(),
    isActive: z.boolean().optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const backtestArgsSchema = z.object({
  strategyId: z.string().uuid(),
  symbol: z.string().trim().min(1).max(64),
  timeframe: z.enum(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  initialBalance: z.number().positive().max(100_000_000),
  riskPercent: z.number().min(0.1).max(5),
  spread: z.number().min(0).max(1_000).default(0),
  slippage: z.number().min(0).max(1_000).default(0),
});

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
        content: [
          {
            type: "text" as const,
            text: isApiError(error) ? error.message : "The MCP request could not be completed.",
          },
        ],
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
        "Read and manage the account-scoped MT5 bots, strategies, and backtests. If this key has direct-trading permission, execute_trade queues a command without per-trade site approval, but normal risk checks and MT5 Bridge validation still apply. Do not claim a trade executed until the Bridge reports its result.",
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
    "execute_trade",
    {
      title: "Execute an MT5 trade",
      description:
        "Queue the specified MT5 trade action without per-trade site approval. This requires direct-trading permission on the MCP key. Kocel still enforces account ownership, Bridge freshness, and configured trade risk checks; the returned command is pending until the EA reports its execution result.",
      inputSchema: { ...mcpTradeArgsSchema.shape },
    },
    safeTool("execute_trade", async (args) => {
      if (!key.can_trade_directly) {
        throw forbidden("Direct trading is not enabled for this MCP key.");
      }
      const request = prepareMcpTradeExecution(key.connection_id, args);
      const result = await executeTradeCommand(key.user_id, request);
      await recordAudit({
        userId: key.user_id,
        action: "MCP_TRADE_EXECUTED",
        entityType: "mt5_trade_command",
        entityId: result.commandId,
        metadata: {
          apiKeyId: key.id,
          operation: request.operation,
          status: result.status,
          errorCode: result.errorCode ?? null,
        },
      });
      return textResult({
        ...result,
        message:
          result.status === "PENDING"
            ? "Command queued for the MT5 Bridge; this is not confirmation of execution."
            : result.message,
      });
    }),
  );

  server.registerTool(
    "list_bots",
    {
      title: "List bots",
      description:
        "List up to 100 bots owned by this user and assigned to the MT5 account scoped to this key.",
      inputSchema: {},
    },
    safeTool("list_bots", async () =>
      textResult(await listMcpBots(key.user_id, key.connection_id)),
    ),
  );

  server.registerTool(
    "create_bot",
    {
      title: "Create a bot",
      description:
        "Create a stopped bot for the MT5 account scoped to this key, using an active strategy you own or a built-in strategy.",
      inputSchema: { ...createBotArgsSchema.shape },
    },
    safeTool("create_bot", async (args) =>
      textResult(
        await createMcpBot(key.user_id, key.connection_id, {
          ...args,
          configuration: args.configuration ?? {},
        }),
      ),
    ),
  );

  server.registerTool(
    "update_bot",
    {
      title: "Edit a bot",
      description:
        "Update the name, symbol, strategy, timeframe, risk profile, or configuration of one of this account's bots.",
      inputSchema: { ...updateBotArgsSchema.shape },
    },
    safeTool("update_bot", async ({ botId, ...patch }) =>
      textResult(await updateMcpBot(key.user_id, key.connection_id, botId, patch)),
    ),
  );

  server.registerTool(
    "set_bot_status",
    {
      title: "Change bot status",
      description:
        "Start, pause, stop, or leave a bot in draft. A start request becomes WAITING if its MT5 account is disconnected.",
      inputSchema: {
        botId: z.string().uuid(),
        status: z.enum(["DRAFT", "STOPPED", "RUNNING", "PAUSED"]),
      },
    },
    safeTool("set_bot_status", async ({ botId, status }) =>
      textResult(await setMcpBotStatus(key.user_id, key.connection_id, botId, status)),
    ),
  );

  server.registerTool(
    "delete_bot",
    {
      title: "Delete a bot",
      description:
        "Permanently delete one of this user's bots assigned to the account scoped to this key.",
      inputSchema: { botId: z.string().uuid() },
    },
    safeTool("delete_bot", async ({ botId }) =>
      textResult(await deleteMcpBot(key.user_id, key.connection_id, botId)),
    ),
  );

  server.registerTool(
    "list_strategies",
    {
      title: "List strategies",
      description:
        "List active built-in strategies and all strategies owned by this user, including account-specific system-strategy names.",
      inputSchema: {},
    },
    safeTool("list_strategies", async () => textResult(await listMcpStrategies(key.user_id))),
  );

  server.registerTool(
    "create_strategy",
    {
      title: "Create a strategy",
      description:
        "Create an account-owned strategy using a supported Kocel runtime engine. This does not deploy or start a bot.",
      inputSchema: { ...createStrategyArgsSchema.shape },
    },
    safeTool("create_strategy", async (args) =>
      textResult(
        await createMcpStrategy(key.user_id, {
          ...args,
          configuration: args.configuration ?? {},
        }),
      ),
    ),
  );

  server.registerTool(
    "edit_strategy",
    {
      title: "Edit a strategy",
      description:
        "Edit an owned strategy, or create account-specific overrides for a built-in strategy without changing it for other users.",
      inputSchema: { ...editStrategyArgsSchema.shape },
    },
    safeTool("edit_strategy", async ({ strategyId, ...patch }) =>
      textResult(await updateMcpStrategy(key.user_id, strategyId, patch)),
    ),
  );

  server.registerTool(
    "rename_strategy",
    {
      title: "Rename a strategy",
      description:
        "Rename an owned strategy or set a private account-specific name for a built-in strategy.",
      inputSchema: {
        strategyId: z.string().uuid(),
        name: z.string().trim().min(2).max(80),
      },
    },
    safeTool("rename_strategy", async ({ strategyId, name }) =>
      textResult(await updateMcpStrategy(key.user_id, strategyId, { name })),
    ),
  );

  server.registerTool(
    "delete_strategy",
    {
      title: "Delete a strategy",
      description:
        "Delete an owned strategy that is not used by a bot, or hide a built-in strategy from this user's library only.",
      inputSchema: { strategyId: z.string().uuid() },
    },
    safeTool("delete_strategy", async ({ strategyId }) =>
      textResult(await deleteMcpStrategy(key.user_id, strategyId)),
    ),
  );

  server.registerTool(
    "list_backtests",
    {
      title: "List backtests",
      description:
        "List EA-candle availability and recent saved backtests for the MT5 account scoped to this key.",
      inputSchema: {},
    },
    safeTool("list_backtests", async () =>
      textResult(await getBacktestCatalog(key.user_id, key.connection_id)),
    ),
  );

  server.registerTool(
    "run_backtest",
    {
      title: "Run a strategy backtest",
      description:
        "Replay up to 5,000 real historical candles synced by the Kocel Bridge EA. Uses risk-based simulated sizing; it never places MT5 orders.",
      inputSchema: { ...backtestArgsSchema.shape },
    },
    safeTool("run_backtest", async (args) =>
      textResult(
        await runBacktestForUser({
          userId: key.user_id,
          connectionId: key.connection_id,
          strategyId: args.strategyId,
          symbol: args.symbol,
          timeframe: args.timeframe,
          startAt: args.startAt,
          endAt: args.endAt,
          settings: {
            initialBalance: args.initialBalance,
            riskPercent: args.riskPercent,
            spread: args.spread,
            slippage: args.slippage,
          },
        }),
      ),
    ),
  );

  server.registerTool(
    "get_backtest",
    {
      title: "Get a backtest",
      description: "Read a saved backtest owned by this user for the account scoped to this key.",
      inputSchema: { runId: z.string().uuid() },
    },
    safeTool("get_backtest", async ({ runId }) =>
      textResult(await getBacktestRun(key.user_id, key.connection_id, runId)),
    ),
  );

  server.registerTool(
    "delete_backtest",
    {
      title: "Delete a backtest",
      description:
        "Permanently delete a saved backtest owned by this user for the account scoped to this key.",
      inputSchema: { runId: z.string().uuid() },
    },
    safeTool("delete_backtest", async ({ runId }) =>
      textResult(await deleteBacktestRun(key.user_id, key.connection_id, runId)),
    ),
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
