#ifndef KOCEL_PANEL_MQH
#define KOCEL_PANEL_MQH

#include "../Config/KocelConfig.mqh"
#include "../Core/KocelConstants.mqh"
#include "../Core/KocelState.mqh"
#include "../Core/KocelTypes.mqh"
#include "KocelControls.mqh"

class CKocelPanel
{
private:
   long m_chart_id;
   ENUM_BASE_CORNER m_corner;
   bool m_detailed;
   int m_height;
   CKocelControls m_controls;

   string Name(const string suffix) const
   {
      return KOCEL_OBJECT_PREFIX + suffix;
   }

   string ValueOrUnavailable(const string value) const
   {
      if(value == "")
         return "N/A";
      return value;
   }

   string LoginText(const long login) const
   {
      if(login <= 0)
         return "N/A";
      return IntegerToString(login);
   }

   color StateColor(const ENUM_KOCEL_CONNECTION_STATE state) const
   {
      switch(state)
      {
         case KOCEL_STATE_READY:                     return C'55,180,120';
         case KOCEL_STATE_CONNECTING:                return C'240,174,64';
         case KOCEL_STATE_WAITING_FOR_AUTHORIZATION: return C'79,143,247';
         case KOCEL_STATE_CONNECTED:                 return C'42,190,120';
         case KOCEL_STATE_DISCONNECTING:             return C'230,150,70';
         case KOCEL_STATE_ERROR:                     return C'235,88,88';
         case KOCEL_STATE_DISCONNECTED:
         default:                                    return C'140,150,165';
      }
   }

   bool SetText(const string suffix, const string text)
   {
      return ObjectSetString(m_chart_id, Name(suffix), OBJPROP_TEXT, text);
   }

   bool SetBg(const string suffix, const color bg)
   {
      return ObjectSetInteger(m_chart_id, Name(suffix), OBJPROP_BGCOLOR, bg);
   }

   void DeleteObjects()
   {
      for(int i = ObjectsTotal(m_chart_id, 0, -1) - 1; i >= 0; i--)
      {
         const string object_name = ObjectName(m_chart_id, i, 0, -1);
         if(StringFind(object_name, KOCEL_OBJECT_PREFIX) == 0)
            ObjectDelete(m_chart_id, object_name);
      }
   }

public:
   CKocelPanel()
   {
      m_chart_id = 0;
      m_corner = CORNER_LEFT_UPPER;
      m_detailed = true;
      m_height = KOCEL_PANEL_HEIGHT_DETAILED;
   }

   bool Create(const long chart_id, const ENUM_BASE_CORNER corner, const bool detailed)
   {
      m_chart_id = chart_id;
      m_corner = corner;
      m_detailed = detailed;
      m_height = detailed ? KOCEL_PANEL_HEIGHT_DETAILED : KOCEL_PANEL_HEIGHT_COMPACT;

      DeleteObjects();

      const int x = 12;
      const int y = 22;
      const int pad = KOCEL_PANEL_PADDING;
      const int left = x + pad;
      int cursor = y + 14;

      bool ok = true;
      ok = ok && m_controls.CreatePanelBox(m_chart_id, Name("Panel"), m_corner, x, y, KOCEL_PANEL_WIDTH, m_height, C'14,20,31', C'46,58,78');
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Title"), m_corner, left, cursor, "KOCEL BRIDGE", 12, C'245,248,252');
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Version"), m_corner, left + 210, cursor + 2, "Version " + KOCEL_EA_VERSION, 8, C'165,174,190');

      cursor += 34;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("BridgeLabel"), m_corner, left, cursor, "Bridge Status", 8, C'165,174,190');
      cursor += 18;
      ok = ok && m_controls.CreatePanelBox(m_chart_id, Name("StatePill"), m_corner, left, cursor, 160, 24, C'55,180,120', C'55,180,120');
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("StateText"), m_corner, left + 12, cursor + 5, "READY", 9, C'255,255,255');

      cursor += 44;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("AccountHeader"), m_corner, left, cursor, "MT5 ACCOUNT", 8, C'165,174,190');
      cursor += 20;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Login"), m_corner, left, cursor, "Login: N/A", 9, C'235,238,243');
      cursor += 18;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Server"), m_corner, left, cursor, "Server: N/A", 9, C'235,238,243');
      cursor += 18;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Environment"), m_corner, left, cursor, "Environment: N/A", 9, C'235,238,243');

      if(m_detailed)
      {
         cursor += 18;
         ok = ok && m_controls.CreateLabel(m_chart_id, Name("Broker"), m_corner, left, cursor, "Broker: N/A", 9, C'235,238,243');
         cursor += 18;
         ok = ok && m_controls.CreateLabel(m_chart_id, Name("Terminal"), m_corner, left, cursor, "Terminal: N/A", 9, C'235,238,243');
      }

      cursor += 34;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("KocelHeader"), m_corner, left, cursor, "KOCEL", 8, C'165,174,190');
      cursor += 20;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("KocelStatus"), m_corner, left, cursor, "Status: Not Connected", 9, C'235,238,243');

      cursor += 28;
      ok = ok && m_controls.CreateButton(m_chart_id, Name("ConnectButton"), m_corner, left, cursor, 220, 30, "CONNECT TO KOCEL", C'29,104,216', C'255,255,255');
      cursor += 38;
      ok = ok && m_controls.CreateButton(m_chart_id, Name("DisconnectButton"), m_corner, left, cursor, 160, 28, "DISCONNECT", C'67,78,97', C'255,255,255');
      ok = ok && m_controls.CreateButton(m_chart_id, Name("SettingsButton"), m_corner, left + 172, cursor, 90, 28, "SETTINGS", C'43,54,72', C'235,238,243');

      cursor += 42;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("ActivityHeader"), m_corner, left, cursor, "Activity", 8, C'165,174,190');
      cursor += 20;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Activity"), m_corner, left, cursor, "No activity yet.", 8, C'220,226,235');
      cursor += 18;
      ok = ok && m_controls.CreateLabel(m_chart_id, Name("Hint"), m_corner, left, cursor, "", 8, C'165,174,190');

      ChartRedraw(m_chart_id);
      return ok;
   }

   void Destroy()
   {
      DeleteObjects();
      ChartRedraw(m_chart_id);
   }

   void Update(const ENUM_KOCEL_CONNECTION_STATE state, const KocelMt5AccountInfo &account, const string kocel_status, const CKocelConfig &config, const string activity)
   {
      SetBg("StatePill", StateColor(state));
      SetText("StateText", KocelStateToString(state));
      SetText("Login", "Login: " + LoginText(account.login));
      SetText("Server", "Server: " + ValueOrUnavailable(account.server));
      SetText("Environment", "Environment: " + ValueOrUnavailable(account.environment));
      SetText("KocelStatus", "Status: " + kocel_status);
      SetText("Activity", activity);

      if(m_detailed)
      {
         SetText("Broker", "Broker: " + ValueOrUnavailable(account.broker));
         SetText("Terminal", "Terminal: Build " + IntegerToString(account.terminal_build));
         SetText("Hint", "API: " + config.ApiBaseUrl());
      }
      else
      {
         SetText("Hint", "Settings are available from the EA inputs.");
      }

      ChartRedraw(m_chart_id);
   }

   bool IsConnectButton(const string object_name) const
   {
      return object_name == Name("ConnectButton");
   }

   bool IsDisconnectButton(const string object_name) const
   {
      return object_name == Name("DisconnectButton");
   }

   bool IsSettingsButton(const string object_name) const
   {
      return object_name == Name("SettingsButton");
   }
};

#endif
