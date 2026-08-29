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

   bool ReadOpenPositions(KocelMt5Position *&positions, int &count) const
   {
      count = PositionsTotal();
      if(count == 0)
         return true;

      if(ArrayResize(positions, count) != count)
      {
         ArrayFree(positions);
         return false;
      }

      for(int i = 0; i < count; i++)
      {
         ulong pos_ticket = PositionGetTicket(i);
         if(!PositionSelectByTicket(pos_ticket))
         {
            ArrayFree(positions);
            return false;
         }

         KocelResetPosition(positions[i]);
         positions[i].ticket = pos_ticket;
         positions[i].symbol = SafeString(PositionGetString(POSITION_SYMBOL));
         positions[i].type = PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL";
         positions[i].volume = PositionGetDouble(POSITION_VOLUME);
         positions[i].open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         positions[i].current_price = PositionGetDouble(POSITION_PRICE_CURRENT);
         positions[i].stop_loss = PositionGetDouble(POSITION_SL);
         positions[i].take_profit = PositionGetDouble(POSITION_TP);
         positions[i].current_profit = PositionGetDouble(POSITION_PROFIT);
         positions[i].swap = PositionGetDouble(POSITION_SWAP);
         positions[i].magic = PositionGetInteger(POSITION_MAGIC);
         positions[i].open_time = TimeToString(PositionGetInteger(POSITION_TIME), TIME_DATE|TIME_MINUTES);
      }
      return true;
   }

   bool ReadPendingOrders(KocelMt5Order *&orders, int &count) const
   {
      count = OrdersTotal();
      if(count == 0)
         return true;

      if(ArrayResize(orders, count) != count)
      {
         ArrayFree(orders);
         return false;
      }

      for(int i = 0; i < count; i++)
      {
         ulong order_ticket = OrderGetTicket(i);
         if(!OrderSelectByTicket(order_ticket))
         {
            ArrayFree(orders);
            return false;
         }

         KocelResetOrder(orders[i]);
         orders[i].ticket = order_ticket;
         orders[i].symbol = SafeString(OrderGetString(ORDER_SYMBOL));
         ENUM_ORDER_TYPE order_type = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
         if(order_type == ORDER_TYPE_BUY || order_type == ORDER_TYPE_BUY_LIMIT || order_type == ORDER_TYPE_BUY_STOP)
            orders[i].type = "BUY_" + IntegerToString((int)order_type);
         else
            orders[i].type = "SELL_" + IntegerToString((int)order_type);
         orders[i].volume = OrderGetDouble(ORDER_VOLUME_CURRENT);
         orders[i].price = OrderGetDouble(ORDER_PRICE_OPEN);
         orders[i].stop_loss = OrderGetDouble(ORDER_SL);
         orders[i].take_profit = OrderGetDouble(ORDER_TP);
         orders[i].current_state = OrderGetString(ORDER_STATE);
         orders[i].magic = OrderGetInteger(ORDER_MAGIC);
         orders[i].created_at = TimeToString(OrderGetInteger(ORDER_TIME_SETUP), TIME_DATE|TIME_MINUTES);
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
