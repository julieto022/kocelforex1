import { describe, expect, it } from "vitest";

import {
  createKocelMcpServer,
  createMcpTransport,
  prepareMcpTradeExecution,
} from "@/lib/server/mcp.server";

async function sendStatelessMcpRequest(body: unknown): Promise<Response> {
  const server = createKocelMcpServer({
    id: "4e090855-f447-4ad4-8e51-ce13004feefd",
    user_id: "8bf848e7-f647-4711-a7cb-bbd0ed65f079",
    connection_id: "92dcd879-9d35-4f4f-9cad-965b6392675d",
    can_trade_directly: false,
  });
  const transport = createMcpTransport();
  await server.connect(transport);

  try {
    return await transport.handleRequest(
      new Request("https://kocelforex1.vercel.app/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          host: "kocelforex1.vercel.app",
        },
        body: JSON.stringify(body),
      }),
    );
  } finally {
    await server.close();
  }
}

describe("MCP direct trade validation", () => {
  const connectionId = "92dcd879-9d35-4f4f-9cad-965b6392675d";
  const clientRequestId = "c799d57a-2ea8-4df5-b0dc-c79839a12d62";

  it("binds a valid execution request to its account and preserves its idempotency key", () => {
    const request = prepareMcpTradeExecution(connectionId, {
      operation: "OPEN_MARKET",
      clientRequestId,
      symbol: "EURUSD",
      side: "BUY",
      volume: 0.1,
      stopLoss: 1.05,
    });

    expect(request).toMatchObject({
      connectionId,
      operation: "OPEN_MARKET",
      clientRequestId,
      symbol: "EURUSD",
      side: "BUY",
      volume: 0.1,
    });
    expect(request.clientRequestId).toBe(clientRequestId);
  });

  it("rejects operation-specific fields that are missing or invalid", () => {
    expect(() =>
      prepareMcpTradeExecution(connectionId, {
        operation: "OPEN_MARKET",
        clientRequestId,
        side: "BUY",
        volume: 0.1,
      }),
    ).toThrow();

    expect(() =>
      prepareMcpTradeExecution(connectionId, {
        operation: "OPEN_MARKET",
        clientRequestId,
        side: "BUY",
        volume: 0,
      }),
    ).toThrow();

    expect(() =>
      prepareMcpTradeExecution(connectionId, {
        operation: "CLOSE_POSITION",
        clientRequestId,
        positionTicket: -1,
      }),
    ).toThrow();
  });

  it("requires a caller-provided idempotency key", () => {
    expect(() =>
      prepareMcpTradeExecution(connectionId, {
        operation: "CLOSE_POSITION",
        positionTicket: 123,
      }),
    ).toThrow();
  });
});

describe("stateless MCP transport", () => {
  it("supports initialization and tool discovery without a session", async () => {
    const initializeResponse = await sendStatelessMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
    expect(initializeResponse.status).toBe(200);
    expect(initializeResponse.headers.get("mcp-session-id")).toBeNull();

    const toolsResponse = await sendStatelessMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    expect(toolsResponse.status).toBe(200);
    const response = (await toolsResponse.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(response.result.tools.map((tool) => tool.name)).toEqual([
      "get_mt5_account",
      "list_open_positions",
      "list_pending_orders",
      "execute_trade",
      "get_risk_settings",
      "update_risk_settings",
      "list_bots",
      "create_bot",
      "create_bots",
      "update_bot",
      "set_bot_status",
      "delete_bot",
      "clear_bots",
      "list_strategies",
      "create_strategy",
      "create_strategies",
      "edit_strategy",
      "rename_strategy",
      "delete_strategy",
      "clear_strategies",
      "list_backtests",
      "run_backtest",
      "get_backtest_sync",
      "get_backtest",
      "delete_backtest",
    ]);
  });

  it("refuses direct trade execution when the key capability is disabled", async () => {
    const response = await sendStatelessMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "execute_trade",
        arguments: {
          operation: "OPEN_MARKET",
          clientRequestId: "c799d57a-2ea8-4df5-b0dc-c79839a12d62",
          symbol: "EURUSD",
          side: "BUY",
          volume: 0.1,
        },
      },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toContain("Direct trading is not enabled");
  });

  it("refuses to start automated bots when the key cannot trade directly", async () => {
    const response = await sendStatelessMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "set_bot_status",
        arguments: {
          botId: "5fb432b2-0ae9-4dfb-9f73-2c5088b52650",
          status: "RUNNING",
        },
      },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> };
    };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0]?.text).toContain("Enable direct-trading permission");
  });
});
