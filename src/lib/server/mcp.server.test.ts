import { describe, expect, it } from "vitest";

import {
  createKocelMcpServer,
  createMcpTransport,
  prepareMcpTradeProposal,
} from "@/lib/server/mcp.server";

async function sendStatelessMcpRequest(body: unknown): Promise<Response> {
  const server = createKocelMcpServer({
    id: "4e090855-f447-4ad4-8e51-ce13004feefd",
    user_id: "8bf848e7-f647-4711-a7cb-bbd0ed65f079",
    connection_id: "92dcd879-9d35-4f4f-9cad-965b6392675d",
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

describe("MCP trade proposal validation", () => {
  const connectionId = "92dcd879-9d35-4f4f-9cad-965b6392675d";

  it("binds a valid proposal to its account and adds an idempotency key", () => {
    const request = prepareMcpTradeProposal(connectionId, {
      operation: "OPEN_MARKET",
      symbol: "EURUSD",
      side: "BUY",
      volume: 0.1,
      stopLoss: 1.05,
    });

    expect(request).toMatchObject({
      connectionId,
      operation: "OPEN_MARKET",
      symbol: "EURUSD",
      side: "BUY",
      volume: 0.1,
    });
    expect(request.clientRequestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rejects operation-specific fields that are missing or invalid", () => {
    expect(() =>
      prepareMcpTradeProposal(connectionId, {
        operation: "OPEN_MARKET",
        side: "BUY",
        volume: 0.1,
      }),
    ).toThrow();

    expect(() =>
      prepareMcpTradeProposal(connectionId, {
        operation: "OPEN_MARKET",
        side: "BUY",
        volume: 0,
      }),
    ).toThrow();

    expect(() =>
      prepareMcpTradeProposal(connectionId, {
        operation: "CLOSE_POSITION",
        positionTicket: -1,
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
      "propose_trade",
    ]);
  });
});
