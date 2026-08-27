#ifndef KOCEL_CONFIG_MQH
#define KOCEL_CONFIG_MQH

#include "../Core/KocelConstants.mqh"
#include "../Core/KocelTypes.mqh"

class CKocelConfig
{
private:
   string m_api_base_url;
   bool m_debug_logging;
   int m_heartbeat_seconds;
   int m_timeout_seconds;
   ENUM_KOCEL_PANEL_CORNER m_panel_position;
   bool m_show_detailed_status;
   bool m_valid;
   string m_error_message;

   string Trimmed(const string raw) const
   {
      string value = raw;
      StringTrimLeft(value);
      StringTrimRight(value);
      return value;
   }

   string WithoutTrailingSlash(const string raw) const
   {
      string value = raw;
      while(StringLen(value) > 0 && StringSubstr(value, StringLen(value) - 1, 1) == "/")
         value = StringSubstr(value, 0, StringLen(value) - 1);
      return value;
   }

   int ClampInt(const int value, const int minimum, const int maximum) const
   {
      if(value < minimum)
         return minimum;
      if(value > maximum)
         return maximum;
      return value;
   }

   bool ValidateApiBaseUrl(const string value, string &error_message) const
   {
      if(value == "")
      {
         error_message = "Kocel API Base URL is required.";
         return false;
      }

      string lower = value;
      StringToLower(lower);

      if(StringFind(lower, "https://") != 0)
      {
         error_message = "Kocel API Base URL must start with https://.";
         return false;
      }

      if(StringFind(value, " ") >= 0 || StringFind(value, "\t") >= 0)
      {
         error_message = "Kocel API Base URL must not contain whitespace.";
         return false;
      }

      const string host_and_path = StringSubstr(value, 8);
      if(StringFind(host_and_path, ".") < 0 || StringLen(host_and_path) < 4)
      {
         error_message = "Kocel API Base URL host is invalid.";
         return false;
      }

      error_message = "";
      return true;
   }

public:
   CKocelConfig()
   {
      m_api_base_url = KOCEL_DEFAULT_API_BASE_URL;
      m_debug_logging = false;
      m_heartbeat_seconds = KOCEL_DEFAULT_HEARTBEAT_SECONDS;
      m_timeout_seconds = KOCEL_DEFAULT_TIMEOUT_SECONDS;
      m_panel_position = KOCEL_PANEL_LEFT_TOP;
      m_show_detailed_status = true;
      m_valid = false;
      m_error_message = "";
   }

   bool Initialize(
      const string api_base_url,
      const bool debug_logging,
      const int heartbeat_seconds,
      const int timeout_seconds,
      const ENUM_KOCEL_PANEL_CORNER panel_position,
      const bool show_detailed_status
   )
   {
      m_api_base_url = WithoutTrailingSlash(Trimmed(api_base_url));
      m_debug_logging = debug_logging;
      m_heartbeat_seconds = ClampInt(heartbeat_seconds, KOCEL_MIN_HEARTBEAT_SECONDS, KOCEL_MAX_HEARTBEAT_SECONDS);
      m_timeout_seconds = ClampInt(timeout_seconds, KOCEL_MIN_TIMEOUT_SECONDS, KOCEL_MAX_TIMEOUT_SECONDS);
      m_panel_position = panel_position;
      m_show_detailed_status = show_detailed_status;

      m_valid = ValidateApiBaseUrl(m_api_base_url, m_error_message);
      return m_valid;
   }

   bool IsValid() const { return m_valid; }
   string ErrorMessage() const { return m_error_message; }
   string ApiBaseUrl() const { return m_api_base_url; }
   bool DebugLogging() const { return m_debug_logging; }
   int HeartbeatSeconds() const { return m_heartbeat_seconds; }
   int TimeoutSeconds() const { return m_timeout_seconds; }
   ENUM_KOCEL_PANEL_CORNER PanelPosition() const { return m_panel_position; }
   bool ShowDetailedStatus() const { return m_show_detailed_status; }

   ENUM_BASE_CORNER PanelCorner() const
   {
      switch(m_panel_position)
      {
         case KOCEL_PANEL_RIGHT_TOP:    return CORNER_RIGHT_UPPER;
         case KOCEL_PANEL_LEFT_BOTTOM:  return CORNER_LEFT_LOWER;
         case KOCEL_PANEL_RIGHT_BOTTOM: return CORNER_RIGHT_LOWER;
         case KOCEL_PANEL_LEFT_TOP:
         default:                       return CORNER_LEFT_UPPER;
      }
   }
};

#endif
