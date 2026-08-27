#ifndef KOCEL_LOGGER_MQH
#define KOCEL_LOGGER_MQH

#include "KocelTypes.mqh"

class CKocelLogger
{
private:
   bool m_debug_enabled;
   string m_latest_message;

   string LevelText(const ENUM_KOCEL_LOG_LEVEL level) const
   {
      switch(level)
      {
         case KOCEL_LOG_INFO:    return "INFO";
         case KOCEL_LOG_WARNING: return "WARNING";
         case KOCEL_LOG_ERROR:   return "ERROR";
         case KOCEL_LOG_DEBUG:   return "DEBUG";
      }
      return "INFO";
   }

   string Sanitize(const string message) const
   {
      string value = message;
      StringReplace(value, "\r", " ");
      StringReplace(value, "\n", " ");
      return value;
   }

public:
   CKocelLogger()
   {
      m_debug_enabled = false;
      m_latest_message = "";
   }

   void Initialize(const bool debug_enabled)
   {
      m_debug_enabled = debug_enabled;
      m_latest_message = "";
   }

   void Log(const ENUM_KOCEL_LOG_LEVEL level, const string message)
   {
      if(level == KOCEL_LOG_DEBUG && !m_debug_enabled)
         return;

      const string clean_message = Sanitize(message);
      const string line = "[" + LevelText(level) + "] " + clean_message;
      m_latest_message = line;
      Print(line);
   }

   void Info(const string message)    { Log(KOCEL_LOG_INFO, message); }
   void Warning(const string message) { Log(KOCEL_LOG_WARNING, message); }
   void Error(const string message)   { Log(KOCEL_LOG_ERROR, message); }
   void Debug(const string message)   { Log(KOCEL_LOG_DEBUG, message); }

   string LatestMessage() const
   {
      if(m_latest_message == "")
         return "No activity yet.";
      return m_latest_message;
   }

   string MaskAccountLogin(const long login) const
   {
      if(login <= 0)
         return "N/A";

      string value = IntegerToString(login);
      const int length = StringLen(value);
      if(length <= 4)
         return "****";

      return StringSubstr(value, 0, 2) + "****" + StringSubstr(value, length - 2, 2);
   }
};

#endif
