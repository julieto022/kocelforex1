# Kocel Bridge EA - Phase 3.2

Native MQL5 browser-authorized Bridge client for the Kocel Forex Hub MetaTrader 5 Bridge EA.

This phase implements:

- chart panel and controls
- centralized connection state management
- centralized logging
- MT5 terminal/account detection
- input-based configuration
- timer/event architecture
- MQL5 WebRequest HTTP transport
- browser authorization registration and polling
- in-memory Bridge session handling
- scheduled heartbeat and status diagnostics
- clean Bridge disconnect

It does not execute trades, request broker credentials, create pairing codes, or ask for manual API or Bridge tokens.

## Folder Structure

```text
mt5-bridge/
  KocelBridgeEA/
    KocelBridgeEA.mq5
    Config/
      KocelConfig.mqh
    Core/
      KocelConstants.mqh
      KocelTypes.mqh
      KocelState.mqh
      KocelLogger.mqh
    MT5/
      KocelTerminal.mqh
    Network/
      KocelHttp.mqh
        KocelBridgeClient.mqh
    UI/
      KocelControls.mqh
      KocelPanel.mqh
```

## Installation

1. Open MetaTrader 5.
2. Select File -> Open Data Folder.
3. Open `MQL5/Experts`.
4. Copy the `KocelBridgeEA` folder into `MQL5/Experts`.
5. Open MetaEditor and compile `KocelBridgeEA/KocelBridgeEA.mq5`.
6. Refresh Expert Advisors in MT5 and attach `Kocel Bridge` to a chart.

## Inputs

- `InpKocelApiBaseUrl`: Kocel API base URL from the Phase 2 OpenAPI contract.
- `InpEnableDebugLogging`: enables debug messages in the MT5 Experts log.
- `InpHeartbeatIntervalSeconds`: fallback heartbeat interval, overridden by the server after registration.
- `InpConnectionTimeoutSeconds`: WebRequest timeout in seconds.
- `InpPanelPosition`: chart corner for the EA panel.
- `InpShowDetailedStatus`: shows extra MT5/API status details on the chart panel.

## Phase 2 Endpoint Alignment

The HTTP foundation defines the existing Phase 2 paths:

- `POST /api/public/bridge/register`
- `POST /api/public/bridge/authenticate`
- `POST /api/public/bridge/heartbeat`
- `GET /api/public/bridge/status`
- `POST /api/public/bridge/disconnect`

The EA calls these endpoints during the Phase 3.2 authorization and connection lifecycle.

## MT5 WebRequest Permission

Add the configured Kocel API base URL to:

`Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL`

The EA reports a clear error when MT5 blocks the request.

## Runtime Flow

1. Click `CONNECT TO KOCEL`.
2. The EA registers the detected MT5 account and opens the exact authorization URL returned by Kocel.
3. Approve the connection in the browser.
4. The EA polls until authorization succeeds, then stores the Bridge session only in runtime memory.
5. Heartbeats and status diagnostics run on timers.
6. Click `DISCONNECT` to revoke the Bridge session without changing MT5 positions.
