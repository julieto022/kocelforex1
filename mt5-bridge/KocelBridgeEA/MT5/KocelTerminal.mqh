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

   /** ISO-8601 UTC timestamp (YYYY-MM-DDTHH:MM:SS) expected by the Kocel API. */
   string IsoTime(const datetime value) const
   {
      MqlDateTime parts;
      TimeToStruct(value, parts);
      return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d",
                          parts.year, parts.mon, parts.day,
                          parts.hour, parts.min, parts.sec);
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

   bool ReadOpenPositions(KocelMt5Position &positions[], int &count) const
   {
      ArrayFree(positions);
      count = PositionsTotal();
      if(count <= 0)
         return true;

      if(ArrayResize(positions, count) != count)
      {
         ArrayFree(positions);
         count = 0;
         return false;
      }

      for(int i = 0; i < count; i++)
      {
         ulong pos_ticket = PositionGetTicket(i);
         if(pos_ticket == 0 || !PositionSelectByTicket(pos_ticket))
         {
            ArrayFree(positions);
            count = 0;
            return false;
         }

         KocelResetPosition(positions[i]);
         positions[i].ticket = pos_ticket;
         positions[i].symbol = SafeString(PositionGetString(POSITION_SYMBOL));
         const int position_type = (int)PositionGetInteger(POSITION_TYPE);
         positions[i].type = (position_type == POSITION_TYPE_BUY) ? "BUY" : "SELL";
         positions[i].volume = PositionGetDouble(POSITION_VOLUME);
         positions[i].open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         positions[i].current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
         positions[i].stop_loss = PositionGetDouble(POSITION_SL);
         positions[i].take_profit = PositionGetDouble(POSITION_TP);
         positions[i].current_profit = PositionGetDouble(POSITION_PROFIT);
         positions[i].swap = PositionGetDouble(POSITION_SWAP);
         positions[i].magic = (long)PositionGetInteger(POSITION_MAGIC);
         const datetime open_time = (datetime)PositionGetInteger(POSITION_TIME);
         positions[i].open_time = TimeToString(open_time, TIME_DATE | TIME_SECONDS);
      }
      return true;
   }

   bool ReadPendingOrders(KocelMt5Order &orders[], int &count) const
   {
      ArrayFree(orders);
      count = OrdersTotal();
      if(count <= 0)
         return true;

      if(ArrayResize(orders, count) != count)
      {
         ArrayFree(orders);
         count = 0;
         return false;
      }

      for(int i = 0; i < count; i++)
      {
         ulong order_ticket = OrderGetTicket(i);
         if(order_ticket == 0 || !OrderSelect(order_ticket))
         {
            ArrayFree(orders);
            count = 0;
            return false;
         }

         KocelResetOrder(orders[i]);
         orders[i].ticket = order_ticket;
         orders[i].symbol = SafeString(OrderGetString(ORDER_SYMBOL));
         const ENUM_ORDER_TYPE order_type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
         orders[i].type = EnumToString(order_type);
         orders[i].volume = OrderGetDouble(ORDER_VOLUME_CURRENT);
         orders[i].price = OrderGetDouble(ORDER_PRICE_OPEN);
         orders[i].stop_loss = OrderGetDouble(ORDER_SL);
         orders[i].take_profit = OrderGetDouble(ORDER_TP);
         orders[i].current_state = EnumToString((ENUM_ORDER_STATE)OrderGetInteger(ORDER_STATE));
         orders[i].magic = (long)OrderGetInteger(ORDER_MAGIC);
         const datetime created_at = (datetime)OrderGetInteger(ORDER_TIME_SETUP);
         orders[i].created_at = TimeToString(created_at, TIME_DATE | TIME_SECONDS);
      }
      return true;
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
