#ifndef KOCEL_TYPES_MQH
#define KOCEL_TYPES_MQH

enum ENUM_KOCEL_LOG_LEVEL
{
   KOCEL_LOG_INFO = 0,
   KOCEL_LOG_WARNING = 1,
   KOCEL_LOG_ERROR = 2,
   KOCEL_LOG_DEBUG = 3
};

enum ENUM_KOCEL_CONNECTION_STATE
{
   KOCEL_STATE_DISCONNECTED = 0,
   KOCEL_STATE_INITIALIZING = 1,
   KOCEL_STATE_READY = 2,
   KOCEL_STATE_CONNECTING = 3,
   KOCEL_STATE_WAITING_FOR_AUTHORIZATION = 4,
   KOCEL_STATE_CONNECTED = 5,
   KOCEL_STATE_DISCONNECTING = 6,
   KOCEL_STATE_ERROR = 7
};

enum ENUM_KOCEL_PANEL_CORNER
{
   KOCEL_PANEL_LEFT_TOP = 0,
   KOCEL_PANEL_RIGHT_TOP = 1,
   KOCEL_PANEL_LEFT_BOTTOM = 2,
   KOCEL_PANEL_RIGHT_BOTTOM = 3
};

struct KocelMt5AccountInfo
{
   long login;
   string server;
   string broker;
   string account_name;
   string currency;
   long leverage;
   string environment;
   int terminal_build;
   string terminal_name;
   string terminal_company;
   bool terminal_connected;
   bool account_available;
};

struct KocelMt5AccountSnapshot
{
   double balance;
   double equity;
   double margin;
   double free_margin;
   double margin_level;
   bool margin_level_available;
   string currency;
   long leverage;
};

struct KocelHttpResponse
{
   int status_code;
   string body;
   string headers;
   string error_message;
   int mql_error;
   bool permission_required;
   bool transport_executed;
};

void KocelResetAccountInfo(KocelMt5AccountInfo &info)
{
   info.login = 0;
   info.server = "";
   info.broker = "";
   info.account_name = "";
   info.currency = "";
   info.leverage = 0;
   info.environment = "";
   info.terminal_build = 0;
   info.terminal_name = "";
   info.terminal_company = "";
   info.terminal_connected = false;
   info.account_available = false;
}

void KocelResetAccountSnapshot(KocelMt5AccountSnapshot &snapshot)
{
   snapshot.balance = 0.0;
   snapshot.equity = 0.0;
   snapshot.margin = 0.0;
   snapshot.free_margin = 0.0;
   snapshot.margin_level = 0.0;
   snapshot.margin_level_available = false;
   snapshot.currency = "";
   snapshot.leverage = 0;
}

void KocelResetHttpResponse(KocelHttpResponse &response)
{
   response.status_code = 0;
   response.body = "";
   response.headers = "";
   response.error_message = "";
   response.mql_error = 0;
   response.permission_required = false;
   response.transport_executed = false;
}

#endif
