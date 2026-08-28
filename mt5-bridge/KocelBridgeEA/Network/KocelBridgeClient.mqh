#ifndef KOCEL_BRIDGE_CLIENT_MQH
#define KOCEL_BRIDGE_CLIENT_MQH

#include "../Core/KocelConstants.mqh"
#include "../Core/KocelJson.mqh"
#include "../Core/KocelTypes.mqh"
#include "KocelHttp.mqh"

class CKocelBridgeClient
{
private:
   CKocelHttp m_http;
   string m_request_id;
   string m_poll_token;
   string m_authorization_url;
   string m_expires_at_raw;
   datetime m_expires_at;
   int m_poll_seconds;
   int m_heartbeat_seconds;

   string m_bridge_token;
   string m_connection_id;
   string m_token_expires_at_raw;
   datetime m_token_expires_at;

   string m_last_server_status;
   string m_last_seen_at;
   bool m_online;
   KocelHttpResponse m_last_response;

   int NormalizeInterval(const int value, const int fallback) const
   {
      if(value < 1)
         return fallback;
      if(value > KOCEL_MAX_HEARTBEAT_SECONDS)
         return KOCEL_MAX_HEARTBEAT_SECONDS;
      return value;
   }

   bool ParseEnvelope(const KocelHttpResponse &response, string &data, string &message)
   {
      data = "";
      message = "";

      bool success = false;
      if(!KocelJsonGetBool(response.body, "success", success))
      {
         message = "Invalid Kocel server response.";
         return false;
      }

      if(!success)
      {
         string error_object = "";
         string error_code = "";
         string error_message = "";
         if(KocelJsonGetObject(response.body, "error", error_object))
         {
            KocelJsonGetString(error_object, "code", error_code);
            KocelJsonGetString(error_object, "message", error_message);
         }
         if(error_message != "")
            message = error_message;
         else if(error_code != "")
            message = error_code;
         else
            message = "Kocel Bridge request failed.";
         return false;
      }

      if(!KocelJsonGetObject(response.body, "data", data))
      {
         message = "Invalid Kocel server response.";
         return false;
      }
      return true;
   }

   string RegisterPayload(const KocelMt5AccountInfo &account) const
   {
      string payload = "{";
      payload += "\"mt5Login\":" + KocelJsonString(IntegerToString(account.login)) + ",";
      payload += "\"server\":" + KocelJsonString(account.server) + ",";
      payload += "\"environment\":" + KocelJsonStringOrNull(account.environment) + ",";
      payload += "\"broker\":" + KocelJsonStringOrNull(account.broker) + ",";
      payload += "\"accountName\":" + KocelJsonStringOrNull(account.account_name) + ",";
      payload += "\"currency\":" + KocelJsonStringOrNull(account.currency) + ",";
      payload += "\"leverage\":" + IntegerToString(account.leverage) + ",";
      payload += "\"eaVersion\":" + KocelJsonString(KOCEL_EA_VERSION) + ",";
      payload += "\"terminalBuild\":" + KocelJsonString(IntegerToString(account.terminal_build)) + ",";
      payload += "\"terminalName\":" + KocelJsonStringOrNull(account.terminal_name) + ",";
      payload += "\"terminalCompany\":" + KocelJsonStringOrNull(account.terminal_company);
      payload += "}";
      return payload;
   }

   string HeartbeatPayload(const KocelMt5AccountSnapshot &snapshot, const int open_trades) const
   {
      string margin_level = "null";
      if(snapshot.margin_level_available)
         margin_level = DoubleToString(snapshot.margin_level, 2);

      string leverage = "null";
      if(snapshot.leverage > 0)
         leverage = IntegerToString(snapshot.leverage);

      string payload = "{";
      payload += "\"status\":\"CONNECTED\",";
      payload += "\"account\":{";
      payload += "\"balance\":" + DoubleToString(snapshot.balance, 2) + ",";
      payload += "\"equity\":" + DoubleToString(snapshot.equity, 2) + ",";
      payload += "\"margin\":" + DoubleToString(snapshot.margin, 2) + ",";
      payload += "\"freeMargin\":" + DoubleToString(snapshot.free_margin, 2) + ",";
      payload += "\"marginLevel\":" + margin_level + ",";
      payload += "\"currency\":" + KocelJsonString(snapshot.currency) + ",";
      payload += "\"leverage\":" + leverage;
      payload += "},";
      payload += "\"openTrades\":" + IntegerToString(open_trades) + ",";
      payload += "\"message\":null";
      payload += "}";
      return payload;
   }

public:
   CKocelBridgeClient()
   {
      Clear();
      m_poll_seconds = KOCEL_DEFAULT_POLL_SECONDS;
      m_heartbeat_seconds = KOCEL_DEFAULT_HEARTBEAT_SECONDS;
   }

   void Configure(const string base_url, const int timeout_seconds, const int heartbeat_seconds)
   {
      m_http.Configure(base_url, timeout_seconds);
      m_poll_seconds = KOCEL_DEFAULT_POLL_SECONDS;
      m_heartbeat_seconds = NormalizeInterval(heartbeat_seconds, KOCEL_DEFAULT_HEARTBEAT_SECONDS);
   }

   void Clear()
   {
      m_request_id = "";
      m_poll_token = "";
      m_authorization_url = "";
      m_expires_at_raw = "";
      m_expires_at = 0;
      m_bridge_token = "";
      m_connection_id = "";
      m_token_expires_at_raw = "";
      m_token_expires_at = 0;
      m_last_server_status = "";
      m_last_seen_at = "";
      m_online = false;
      KocelResetHttpResponse(m_last_response);
   }

   bool Register(const KocelMt5AccountInfo &account, string &message)
   {
      Clear();
      message = "";
      KocelHttpResponse response;
      const bool http_ok = m_http.HttpPost(KOCEL_ENDPOINT_REGISTER, RegisterPayload(account), "", response);
      m_last_response = response;
      if(!http_ok)
      {
         message = response.error_message;
         return false;
      }

      string data = "";
      if(!ParseEnvelope(response, data, message))
         return false;

      int poll_seconds = 0;
      int heartbeat_seconds = 0;
      if(!KocelJsonGetString(data, "authorizationUrl", m_authorization_url) ||
         !KocelJsonGetString(data, "requestId", m_request_id) ||
         !KocelJsonGetString(data, "pollToken", m_poll_token) ||
         !KocelJsonGetString(data, "expiresAt", m_expires_at_raw))
      {
         message = "Invalid Kocel registration response.";
         Clear();
         return false;
      }

      KocelJsonGetInt(data, "pollSeconds", poll_seconds);
      KocelJsonGetInt(data, "heartbeatSeconds", heartbeat_seconds);
      m_poll_seconds = NormalizeInterval(poll_seconds, KOCEL_DEFAULT_POLL_SECONDS);
      m_heartbeat_seconds = NormalizeInterval(heartbeat_seconds, KOCEL_DEFAULT_HEARTBEAT_SECONDS);
      m_expires_at = KocelIsoUtcToTime(m_expires_at_raw);

      message = "Authorization URL received.";
      return true;
   }

   bool PollAuthorization(string &status, string &message)
   {
      status = "";
      message = "";

      if(m_poll_token == "")
      {
         message = "No authorization request is active.";
         return false;
      }

      KocelHttpResponse response;
      const string payload = "{\"pollToken\":" + KocelJsonString(m_poll_token) + "}";
      const bool http_ok = m_http.HttpPost(KOCEL_ENDPOINT_AUTHENTICATE, payload, "", response);
      m_last_response = response;
      if(!http_ok)
      {
         message = response.error_message;
         return false;
      }

      string data = "";
      if(!ParseEnvelope(response, data, message))
         return false;

      if(!KocelJsonGetString(data, "status", status))
      {
         message = "Invalid Kocel authorization response.";
         return false;
      }

      if(status == "AUTHORIZED")
      {
         if(!KocelJsonGetString(data, "token", m_bridge_token) ||
            !KocelJsonGetString(data, "tokenExpiresAt", m_token_expires_at_raw) ||
            !KocelJsonGetString(data, "connectionId", m_connection_id))
         {
            message = "Invalid Kocel authorization approval response.";
            Clear();
            return false;
         }

         m_token_expires_at = KocelIsoUtcToTime(m_token_expires_at_raw);
         m_poll_token = "";
         m_authorization_url = "";
         response.body = "";
         m_last_response.body = "";
         message = "Kocel authorization approved.";
         return true;
      }

      message = "Authorization status: " + status + ".";
      return true;
   }

   bool Heartbeat(const KocelMt5AccountSnapshot &snapshot, const int open_trades, string &message)
   {
      message = "";
      if(m_bridge_token == "")
      {
         message = "No Bridge session token is active.";
         return false;
      }

      KocelHttpResponse response;
      const bool http_ok = m_http.HttpPost(KOCEL_ENDPOINT_HEARTBEAT, HeartbeatPayload(snapshot, open_trades), m_bridge_token, response);
      m_last_response = response;
      if(!http_ok)
      {
         message = response.error_message;
         return false;
      }

      string data = "";
      if(!ParseEnvelope(response, data, message))
         return false;

      KocelJsonGetString(data, "connectionId", m_connection_id);
      KocelJsonGetString(data, "status", m_last_server_status);
      KocelJsonGetString(data, "lastSeenAt", m_last_seen_at);
      KocelJsonGetBool(data, "online", m_online);
      message = "Heartbeat received.";
      return true;
   }

   bool Status(string &message)
   {
      message = "";
      if(m_bridge_token == "")
      {
         message = "No Bridge session token is active.";
         return false;
      }

      KocelHttpResponse response;
      const bool http_ok = m_http.HttpGet(KOCEL_ENDPOINT_STATUS, m_bridge_token, response);
      m_last_response = response;
      if(!http_ok)
      {
         message = response.error_message;
         return false;
      }

      string data = "";
      if(!ParseEnvelope(response, data, message))
         return false;

      KocelJsonGetString(data, "connectionId", m_connection_id);
      KocelJsonGetString(data, "status", m_last_server_status);
      KocelJsonGetString(data, "lastSeenAt", m_last_seen_at);
      KocelJsonGetBool(data, "online", m_online);
      message = "Status received.";
      return true;
   }

   bool Disconnect(const string reason, string &message)
   {
      message = "";
      if(m_bridge_token == "")
      {
         Clear();
         message = "No active Bridge session exists.";
         return true;
      }

      KocelHttpResponse response;
      const string payload = "{\"reason\":" + KocelJsonStringOrNull(reason) + "}";
      const bool http_ok = m_http.HttpPost(KOCEL_ENDPOINT_DISCONNECT, payload, m_bridge_token, response);
      m_last_response = response;
      if(!http_ok)
      {
         message = response.error_message;
         return false;
      }

      string data = "";
      if(!ParseEnvelope(response, data, message))
         return false;

      Clear();
      message = "Disconnected.";
      return true;
   }

   bool HasActiveRequest() const { return m_poll_token != ""; }
   bool HasBridgeSession() const { return m_bridge_token != ""; }
   string AuthorizationUrl() const { return m_authorization_url; }
   string RequestId() const { return m_request_id; }
   string ConnectionId() const { return m_connection_id; }
   string TokenExpiresAtRaw() const { return m_token_expires_at_raw; }
   string LastServerStatus() const { return m_last_server_status; }
   int PollSeconds() const { return m_poll_seconds; }
   int HeartbeatSeconds() const { return m_heartbeat_seconds; }
   KocelHttpResponse LastResponse() const { return m_last_response; }
   int LastResponseStatusCode() const { return m_last_response.status_code; }
   bool LastResponseRetryable() const { return m_http.IsRetryable(m_last_response); }
   bool LastResponsePermissionRequired() const { return m_last_response.permission_required; }

   bool AuthorizationExpired() const
   {
      return m_expires_at > 0 && TimeGMT() >= m_expires_at;
   }

   bool TokenExpired() const
   {
      return m_token_expires_at > 0 && TimeGMT() >= m_token_expires_at;
   }
};

#endif
