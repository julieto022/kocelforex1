#ifndef KOCEL_CONSTANTS_MQH
#define KOCEL_CONSTANTS_MQH

const string KOCEL_EA_NAME = "Kocel Bridge";
const string KOCEL_PRODUCT_NAME = "Kocel Forex Hub";
const string KOCEL_EA_VERSION = "1.0.0";
const int    KOCEL_PROTOCOL_VERSION = 1;

#define KOCEL_DEFAULT_API_BASE_URL "https://kocelforexhub.lovable.app"

const string KOCEL_ENDPOINT_REGISTER     = "/api/public/bridge/register";
const string KOCEL_ENDPOINT_AUTHENTICATE = "/api/public/bridge/authenticate";
const string KOCEL_ENDPOINT_HEARTBEAT    = "/api/public/bridge/heartbeat";
const string KOCEL_ENDPOINT_STATUS       = "/api/public/bridge/status";
const string KOCEL_ENDPOINT_DISCONNECT   = "/api/public/bridge/disconnect";
const string KOCEL_ENDPOINT_COMMAND_POLL = "/api/public/bridge/commands/poll";
const string KOCEL_ENDPOINT_COMMAND_RESULT = "/api/public/bridge/commands";

#define KOCEL_DEFAULT_HEARTBEAT_SECONDS 30
#define KOCEL_DEFAULT_TIMEOUT_SECONDS 30
const int KOCEL_TIMER_SECONDS = 1;
const int KOCEL_MIN_HEARTBEAT_SECONDS = 5;
const int KOCEL_MAX_HEARTBEAT_SECONDS = 3600;
const int KOCEL_MIN_TIMEOUT_SECONDS = 5;
const int KOCEL_MAX_TIMEOUT_SECONDS = 120;
const int KOCEL_DEFAULT_POLL_SECONDS = 5;
const int KOCEL_MAX_NETWORK_FAILURES = 3;
const int KOCEL_MAX_BACKOFF_SECONDS = 60;
const int KOCEL_STATUS_INTERVAL_SECONDS = 60;

const string KOCEL_OBJECT_PREFIX = "KocelBridge_";
const string KOCEL_UI_FONT = "Segoe UI";
const int KOCEL_PANEL_WIDTH = 370;
const int KOCEL_PANEL_HEIGHT_DETAILED = 430;
const int KOCEL_PANEL_HEIGHT_COMPACT = 340;
const int KOCEL_PANEL_PADDING = 14;

#endif
