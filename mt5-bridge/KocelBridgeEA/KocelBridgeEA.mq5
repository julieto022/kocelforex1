#property strict
#property version   "1.00"
#property copyright "Kocel Forex Hub"
#property description "Kocel Bridge EA foundation for MetaTrader 5."

#include "Core/KocelConstants.mqh"
#include "Core/KocelTypes.mqh"
#include "Core/KocelLogger.mqh"
#include "Core/KocelState.mqh"
#include "Config/KocelConfig.mqh"
#include "MT5/KocelTerminal.mqh"
#include "Network/KocelHttp.mqh"
#include "Network/KocelBridgeClient.mqh"
#include "Trading/KocelTradeTypes.mqh"
#include "Trading/KocelTradeValidator.mqh"
#include "Trading/KocelTradeExecutor.mqh"
#include "Trading/KocelCommandProcessor.mqh"
#include "UI/KocelPanel.mqh"

#import "shell32.dll"
int ShellExecuteW(int hwnd, string operation, string file, string parameters, string directory, int show_command);
#import

input string InpKocelApiBaseUrl = KOCEL_DEFAULT_API_BASE_URL;
input bool InpEnableDebugLogging = false;
input int InpHeartbeatIntervalSeconds = KOCEL_DEFAULT_HEARTBEAT_SECONDS;
input int InpConnectionTimeoutSeconds = KOCEL_DEFAULT_TIMEOUT_SECONDS;
input ENUM_KOCEL_PANEL_CORNER InpPanelPosition = KOCEL_PANEL_LEFT_TOP;
input bool InpShowDetailedStatus = true;

CKocelConfig g_config;
CKocelLogger g_logger;
CKocelState g_state;
CKocelTerminal g_terminal;
CKocelHttp g_http;
CKocelBridgeClient g_bridge;
CKocelPanel g_panel;
CKocelCommandProcessor g_commands;
KocelMt5AccountInfo g_account_info;

bool g_panel_ready = false;
bool g_terminal_status_known = false;
bool g_last_account_available = false;
long g_last_account_login = 0;
string g_last_account_server = "";
datetime g_next_terminal_refresh = 0;
datetime g_next_poll = 0;
datetime g_next_heartbeat = 0;
datetime g_next_status = 0;
datetime g_next_command_poll = 0;
datetime g_next_network_retry = 0;
int g_network_failures = 0;
string g_kocel_status = "Not Connected";

string KocelLocalConnectionText()
{
   switch(g_state.Current())
   {
      case KOCEL_STATE_CONNECTED:
         return g_kocel_status;
      case KOCEL_STATE_CONNECTING:
         return "Preparing browser authorization";
      case KOCEL_STATE_WAITING_FOR_AUTHORIZATION:
         return "Waiting for browser authorization";
      case KOCEL_STATE_ERROR:
         return "Error";
      case KOCEL_STATE_DISCONNECTING:
         return "Disconnecting";
      default:
         return "Not Connected";
   }
}

void KocelRefreshPanel()
{
   if(!g_panel_ready)
      return;

   g_panel.Update(
      g_state.Current(),
      g_account_info,
      KocelLocalConnectionText(),
      g_config,
      g_logger.LatestMessage()
   );
}

void KocelResetRetry()
{
   g_network_failures = 0;
   g_next_network_retry = 0;
}

void KocelScheduleRetry()
{
   g_network_failures++;
   int delay_seconds = 1;
   for(int i = 1; i < g_network_failures && delay_seconds < KOCEL_MAX_BACKOFF_SECONDS; i++)
      delay_seconds *= 2;
   if(delay_seconds > KOCEL_MAX_BACKOFF_SECONDS)
      delay_seconds = KOCEL_MAX_BACKOFF_SECONDS;
   g_next_network_retry = TimeLocal() + delay_seconds;
}

bool KocelBrowserOpen(const string authorization_url)
{
   ResetLastError();
   const int result = ShellExecuteW(0, "open", authorization_url, "", "", 1);
   if(result <= 32)
   {
      g_logger.Error("Could not open the Kocel authorization browser.");
      return false;
   }
   return true;
}

void KocelDisconnectLocal(const string message, const string log_message)
{
   g_kocel_symbol_resolver.ResetCache();
   g_bridge.Clear();
   g_commands.Reset();
   KocelResetRetry();
   g_next_poll = 0;
   g_next_heartbeat = 0;
   g_next_status = 0;
   g_kocel_status = "Not Connected";
   g_state.Set(KOCEL_STATE_DISCONNECTED, message);
   if(log_message != "")
      g_logger.Info(log_message);
}

void KocelHandleSessionFailure(const string message)
{
   g_logger.Error(message);
   KocelDisconnectLocal(message, "Kocel Bridge session cleared.");
}

bool KocelRefreshTerminal()
{
   const bool account_available = g_terminal.Refresh(g_account_info);
   const bool changed = !g_terminal_status_known
      || account_available != g_last_account_available
      || g_account_info.login != g_last_account_login
      || g_account_info.server != g_last_account_server;

   if(changed)
      g_kocel_symbol_resolver.ResetCache();

   if(changed && account_available)
   {
      g_logger.Info("MT5 account detected: " + g_logger.MaskAccountLogin(g_account_info.login));
      g_logger.Info("MT5 server detected.");
   }
   else if(changed)
   {
      g_logger.Warning("MT5 account information is unavailable.");
   }

   g_terminal_status_known = true;
   g_last_account_available = account_available;
   g_last_account_login = g_account_info.login;
   g_last_account_server = g_account_info.server;
   return account_available;
}

void StartKocelConnection()
{
   if(g_state.Current() == KOCEL_STATE_CONNECTING ||
      g_state.Current() == KOCEL_STATE_WAITING_FOR_AUTHORIZATION ||
      g_state.Current() == KOCEL_STATE_CONNECTED ||
      g_state.Current() == KOCEL_STATE_DISCONNECTING)
      return;

   g_logger.Info("Starting Kocel connection...");

   if(!g_config.IsValid())
   {
      g_state.Set(KOCEL_STATE_ERROR, g_config.ErrorMessage());
      g_logger.Error(g_config.ErrorMessage());
      KocelRefreshPanel();
      return;
   }

   KocelRefreshTerminal();

   string readiness_message = "";
   if(!g_terminal.IsReadyForBridge(g_account_info, readiness_message))
   {
      g_state.Set(KOCEL_STATE_ERROR, readiness_message);
      g_logger.Error(readiness_message);
      KocelRefreshPanel();
      return;
   }

   g_state.Set(KOCEL_STATE_CONNECTING, "Registering Bridge authorization request.");
   g_kocel_status = "Connecting";
   g_logger.Info("Registering Bridge authorization request...");

   g_bridge.Configure(g_config.ApiBaseUrl(), g_config.TimeoutSeconds(), g_config.HeartbeatSeconds());
   string message = "";
   if(!g_bridge.Register(g_account_info, message))
   {
      g_state.Set(KOCEL_STATE_ERROR, message);
      g_kocel_status = "Connection error";
      g_logger.Error("Kocel registration failed.");
      g_logger.Error(message);
      KocelRefreshPanel();
      return;
   }

   g_logger.Info(message);
   if(!KocelBrowserOpen(g_bridge.AuthorizationUrl()))
   {
      g_bridge.Clear();
      g_state.Set(KOCEL_STATE_ERROR, "Could not open the Kocel authorization browser.");
      g_kocel_status = "Connection error";
      KocelRefreshPanel();
      return;
   }

   g_state.Set(KOCEL_STATE_WAITING_FOR_AUTHORIZATION, "Waiting for user authorization in browser...");
   g_kocel_status = "Waiting for authorization";
   g_next_poll = TimeLocal() + g_bridge.PollSeconds();
   KocelResetRetry();
   g_logger.Info("Browser authorization opened.");
   g_logger.Info("Waiting for user authorization...");
   KocelRefreshPanel();
}

void DisconnectKocel()
{
   g_logger.Info("Disconnect requested.");
   g_state.Set(KOCEL_STATE_DISCONNECTING, "Clearing local Bridge state.");
   g_kocel_status = "Disconnecting";
   KocelRefreshPanel();

   if(g_bridge.HasBridgeSession())
   {
      string message = "";
      if(!g_bridge.Disconnect("User disconnected from EA", message))
      {
         g_logger.Error("Kocel disconnect request failed.");
         g_logger.Error(message);
      }
      else
      {
         g_logger.Info("Kocel Bridge session disconnected.");
      }
   }

   KocelDisconnectLocal("Kocel Bridge disconnected.", "Local Bridge session information cleared.");
   KocelRefreshPanel();
}

void ShowKocelSettingsHint()
{
   g_logger.Info("Settings are managed through the EA input parameters.");
   g_logger.Info("Settings include the HTTPS API URL, timeout, heartbeat interval, panel position, and detailed status display.");
   KocelRefreshPanel();
}

int OnInit()
{
   g_kocel_symbol_resolver.ResetCache();
   g_logger.Initialize(InpEnableDebugLogging);
   g_state.Initialize();
   KocelResetAccountInfo(g_account_info);

   const bool config_ok = g_config.Initialize(
      InpKocelApiBaseUrl,
      InpEnableDebugLogging,
      InpHeartbeatIntervalSeconds,
      InpConnectionTimeoutSeconds,
      InpPanelPosition,
      InpShowDetailedStatus
   );

   g_http.Configure(g_config.ApiBaseUrl(), g_config.TimeoutSeconds());
   g_bridge.Configure(g_config.ApiBaseUrl(), g_config.TimeoutSeconds(), InpHeartbeatIntervalSeconds);

   g_logger.Info(KOCEL_EA_NAME + " " + KOCEL_EA_VERSION + " initializing.");
   g_logger.Info("Product: " + KOCEL_PRODUCT_NAME + "; Bridge API protocol version " + IntegerToString(KOCEL_PROTOCOL_VERSION) + ".");

   KocelRefreshTerminal();

   g_panel_ready = g_panel.Create(0, g_config.PanelCorner(), g_config.ShowDetailedStatus());
   if(!g_panel_ready)
      g_logger.Error("Could not create Kocel Bridge chart panel.");

   if(!EventSetTimer(KOCEL_TIMER_SECONDS))
   {
      g_state.Set(KOCEL_STATE_ERROR, "Could not start EA timer.");
      g_logger.Error("Could not start EA timer.");
      KocelRefreshPanel();
      return INIT_SUCCEEDED;
   }

   g_next_terminal_refresh = TimeLocal() + 5;
   g_next_poll = 0;
   g_next_heartbeat = 0;
   g_next_status = 0;

   if(!config_ok)
   {
      g_state.Set(KOCEL_STATE_ERROR, g_config.ErrorMessage());
      g_logger.Error(g_config.ErrorMessage());
   }
   else
   {
      g_state.Set(KOCEL_STATE_READY, "Kocel Bridge foundation is ready.");
      g_logger.Info("Bridge state: READY");
   }

   KocelRefreshPanel();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   g_kocel_symbol_resolver.ResetCache();
   EventKillTimer();
   if(g_bridge.HasBridgeSession())
   {
      string message = "";
      g_bridge.Disconnect("EA removed from chart", message);
   }
   g_bridge.Clear();
   g_commands.Reset();
   g_logger.Info("Kocel Bridge shutting down. Reason: " + IntegerToString(reason));
   g_panel.Destroy();
}

void OnTick()
{
   // Network work is timer-driven; this EA intentionally performs no trading work.
}

void OnTimer()
{
   const datetime now = TimeLocal();

   if(now >= g_next_terminal_refresh)
   {
      KocelRefreshTerminal();
      g_next_terminal_refresh = now + 5;
   }

   if(g_state.Current() == KOCEL_STATE_WAITING_FOR_AUTHORIZATION && now >= g_next_poll)
   {
      if(g_bridge.AuthorizationExpired())
      {
         g_logger.Error("Kocel authorization request expired.");
         KocelDisconnectLocal("Authorization request expired.", "Authorization request expired.");
      }
      else if(g_next_network_retry == 0 || now >= g_next_network_retry)
      {
         string status = "";
         string message = "";
         if(!g_bridge.PollAuthorization(status, message))
         {
            if(g_bridge.LastResponseRetryable())
            {
               KocelScheduleRetry();
               g_logger.Warning("Authorization polling temporarily failed; retry scheduled.");
            }
            else
            {
               g_logger.Error("Kocel authorization polling failed.");
               KocelDisconnectLocal(message, "Authorization polling stopped.");
            }
         }
         else if(status == "AUTHORIZED")
         {
            g_state.Set(KOCEL_STATE_CONNECTED, "Kocel Bridge session established.");
            g_kocel_status = "Connected";
            g_next_heartbeat = now;
            g_next_status = now;
            KocelResetRetry();
            g_logger.Info("Kocel authorization approved.");
            g_logger.Info("Bridge session established.");
            g_logger.Info("Kocel heartbeat started.");
         }
         else if(status == "REJECTED")
         {
            KocelDisconnectLocal("Authorization rejected.", "Kocel authorization was rejected.");
         }
         else if(status == "EXPIRED")
         {
            KocelDisconnectLocal("Authorization request expired.", "Authorization request expired.");
         }
         else if(status == "REVOKED")
         {
            KocelDisconnectLocal("Kocel connection was revoked.", "Kocel connection was revoked.");
         }
         else
         {
            g_next_poll = now + g_bridge.PollSeconds();
         }
      }
   }

   if(g_state.Current() == KOCEL_STATE_CONNECTED)
   {
      if(g_bridge.TokenExpired())
      {
         KocelHandleSessionFailure("Kocel session expired. Reconnect to authorize this MT5 account again.");
      }
      else if((g_next_heartbeat == 0 || now >= g_next_heartbeat) && (g_next_network_retry == 0 || now >= g_next_network_retry))
      {
         KocelMt5AccountSnapshot snapshot;
         g_terminal.ReadAccountSnapshot(snapshot);

         // Read positions and orders
         KocelMt5Position positions[];
         int pos_count = 0;
         KocelMt5Order orders[];
         int order_count = 0;
         
         if(!g_terminal.ReadOpenPositions(positions, pos_count))
         {
            g_logger.Error("Failed to read open positions.");
            pos_count = 0;
         }
         
         if(!g_terminal.ReadPendingOrders(orders, order_count))
         {
            g_logger.Error("Failed to read pending orders.");
            order_count = 0;
         }

         string message = "";
         if(g_bridge.Heartbeat(snapshot, positions, pos_count, orders, order_count, message))
         {
            g_next_heartbeat = now + g_bridge.HeartbeatSeconds();
            KocelResetRetry();
            g_kocel_status = "Connected";
         }
         else if(g_bridge.LastResponseStatusCode() == 401)
         {
            KocelHandleSessionFailure("Kocel connection was revoked or the session expired.");
         }
         else
         {
            KocelScheduleRetry();
            int http_code = g_bridge.LastResponseStatusCode();
            if(http_code > 0)
               g_logger.Warning("Kocel heartbeat failed (HTTP " + IntegerToString(http_code) + "); retry scheduled.");
            else
               g_logger.Warning("Kocel heartbeat failed (" + message + "); retry scheduled.");
            g_next_heartbeat = now + g_bridge.HeartbeatSeconds();
         }
         
         ArrayFree(positions);
         ArrayFree(orders);
      }

      // Phase 3.4: Poll for trade commands
      if(g_state.Current() == KOCEL_STATE_CONNECTED && (g_next_command_poll == 0 || now >= g_next_command_poll))
      {
         string commands_json = "";
         string message = "";
         if(g_bridge.PollCommands(commands_json, message))
         {
            g_next_command_poll = now + KOCEL_COMMAND_POLL_SECONDS;

            if(commands_json != "")
               g_commands.ProcessPollData(commands_json, g_bridge, g_logger);

            g_commands.RetryPendingResults(g_bridge, g_logger);
            KocelResetRetry();
         }
         else if(g_bridge.LastResponseStatusCode() == 401)
         {
            // Session expired or revoked
            KocelHandleSessionFailure("Kocel connection was revoked or the session expired.");
         }
         else
         {
            g_next_command_poll = now + KOCEL_COMMAND_POLL_SECONDS;
            g_commands.RetryPendingResults(g_bridge, g_logger);
         }
      }

      if(g_state.Current() == KOCEL_STATE_CONNECTED && (g_next_status == 0 || now >= g_next_status))
      {
         string message = "";
         if(g_bridge.Status(message))
         {
            g_next_status = now + KOCEL_STATUS_INTERVAL_SECONDS;
            g_kocel_status = g_bridge.LastServerStatus();
            if(g_kocel_status == "")
               g_kocel_status = "Connected";
         }
         else if(g_bridge.LastResponseStatusCode() == 401)
         {
            KocelHandleSessionFailure("Kocel connection was revoked or the session expired.");
         }
         else
         {
            g_next_status = now + KOCEL_STATUS_INTERVAL_SECONDS;
         }
      }
   }

   KocelRefreshPanel();
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id != CHARTEVENT_OBJECT_CLICK)
      return;

   if(g_panel.IsConnectButton(sparam))
   {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      StartKocelConnection();
      return;
   }

   if(g_panel.IsDisconnectButton(sparam))
   {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      DisconnectKocel();
      return;
   }

   if(g_panel.IsSettingsButton(sparam))
   {
      ObjectSetInteger(0, sparam, OBJPROP_STATE, false);
      ShowKocelSettingsHint();
      return;
   }
}
