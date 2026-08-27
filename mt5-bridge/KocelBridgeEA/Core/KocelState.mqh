#ifndef KOCEL_STATE_MQH
#define KOCEL_STATE_MQH

#include "KocelTypes.mqh"

string KocelStateToString(const ENUM_KOCEL_CONNECTION_STATE state)
{
   switch(state)
   {
      case KOCEL_STATE_DISCONNECTED:              return "DISCONNECTED";
      case KOCEL_STATE_INITIALIZING:              return "INITIALIZING";
      case KOCEL_STATE_READY:                     return "READY";
      case KOCEL_STATE_CONNECTING:                return "CONNECTING";
      case KOCEL_STATE_WAITING_FOR_AUTHORIZATION: return "WAITING FOR AUTHORIZATION";
      case KOCEL_STATE_CONNECTED:                 return "CONNECTED";
      case KOCEL_STATE_DISCONNECTING:             return "DISCONNECTING";
      case KOCEL_STATE_ERROR:                     return "ERROR";
   }
   return "UNKNOWN";
}

class CKocelState
{
private:
   ENUM_KOCEL_CONNECTION_STATE m_state;
   string m_status_message;
   datetime m_updated_at;

public:
   CKocelState()
   {
      m_state = KOCEL_STATE_INITIALIZING;
      m_status_message = "Initializing Kocel Bridge.";
      m_updated_at = TimeLocal();
   }

   void Initialize()
   {
      Set(KOCEL_STATE_INITIALIZING, "Initializing Kocel Bridge.");
   }

   bool Set(const ENUM_KOCEL_CONNECTION_STATE state, const string message = "")
   {
      m_state = state;
      if(message == "")
         m_status_message = KocelStateToString(state);
      else
         m_status_message = message;
      m_updated_at = TimeLocal();
      return true;
   }

   ENUM_KOCEL_CONNECTION_STATE Current() const
   {
      return m_state;
   }

   string StatusMessage() const
   {
      return m_status_message;
   }

   datetime UpdatedAt() const
   {
      return m_updated_at;
   }

   bool IsConnected() const
   {
      return m_state == KOCEL_STATE_CONNECTED;
   }
};

#endif
