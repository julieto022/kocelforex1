#ifndef KOCEL_TERMINAL_MQH
#define KOCEL_TERMINAL_MQH

#include "../Core/KocelTypes.mqh"

class CKocelTerminal
{
private:
   string SafeString(const string value) const
   {
      if(value == "")
         return "";
      return value;
   }

   string DetectEnvironment() const
   {
      const long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
      if(mode == ACCOUNT_TRADE_MODE_DEMO)
         return "DEMO";
      if(mode == ACCOUNT_TRADE_MODE_REAL)
         return "REAL";
      return "Unavailable";
   }

public:
   bool Refresh(KocelMt5AccountInfo &info) const
   {
      KocelResetAccountInfo(info);

      info.login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
      info.server = SafeString(AccountInfoString(ACCOUNT_SERVER));
      info.broker = SafeString(AccountInfoString(ACCOUNT_COMPANY));
      info.account_name = SafeString(AccountInfoString(ACCOUNT_NAME));
      info.currency = SafeString(AccountInfoString(ACCOUNT_CURRENCY));
      info.leverage = (long)AccountInfoInteger(ACCOUNT_LEVERAGE);
      info.environment = DetectEnvironment();
      info.terminal_build = (int)TerminalInfoInteger(TERMINAL_BUILD);
      info.terminal_name = SafeString(TerminalInfoString(TERMINAL_NAME));
      info.terminal_company = SafeString(TerminalInfoString(TERMINAL_COMPANY));
      info.terminal_connected = (bool)TerminalInfoInteger(TERMINAL_CONNECTED);
      info.account_available = info.login > 0 && info.server != "";

      return info.account_available;
   }

   void ReadAccountSnapshot(KocelMt5AccountSnapshot &snapshot) const
   {
      KocelResetAccountSnapshot(snapshot);
      snapshot.balance = AccountInfoDouble(ACCOUNT_BALANCE);
      snapshot.equity = AccountInfoDouble(ACCOUNT_EQUITY);
      snapshot.margin = AccountInfoDouble(ACCOUNT_MARGIN);
      snapshot.free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      snapshot.margin_level = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
      snapshot.margin_level_available = snapshot.margin > 0.0;
      snapshot.currency = SafeString(AccountInfoString(ACCOUNT_CURRENCY));
      snapshot.leverage = (long)AccountInfoInteger(ACCOUNT_LEVERAGE);
   }

   int OpenTradesCount() const
   {
      return PositionsTotal() + OrdersTotal();
   }

   bool IsReadyForBridge(const KocelMt5AccountInfo &info, string &message) const
   {
      if(!info.terminal_connected)
      {
         message = "MT5 terminal is not connected to the broker server.";
         return false;
      }

      if(!info.account_available)
      {
         message = "No MT5 trading account is available in this terminal.";
         return false;
      }

      if(info.environment != "DEMO" && info.environment != "REAL")
      {
         message = "MT5 account environment is unavailable.";
         return false;
      }

      message = "";
      return true;
   }
};

#endif
