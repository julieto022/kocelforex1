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
      snapshot.profit = AccountInfoDouble(ACCOUNT_PROFIT);
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
         positions[i].open_time = IsoTime(open_time);
      }
      return true;
   }

   int FindClosedTrade(const KocelMt5ClosedTrade &trades[], const ulong position_ticket) const
   {
      for(int i = 0; i < ArraySize(trades); i++)
         if(trades[i].position_ticket == position_ticket)
            return i;
      return -1;
   }

   bool ReadClosedTrades(const datetime from_time, KocelMt5ClosedTrade &trades[], int &count) const
   {
      ArrayFree(trades);
      count = 0;
      const datetime end_time = TimeCurrent();
      if(end_time <= 0 || !HistorySelect(from_time, end_time))
         return false;

      const int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
      {
         const ulong deal_ticket = HistoryDealGetTicket(i);
         if(deal_ticket == 0)
            continue;
         const ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
         if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY)
            continue;

         const ulong position_ticket = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
         if(position_ticket == 0)
            continue;

         int trade_index = FindClosedTrade(trades, position_ticket);
         if(trade_index < 0)
         {
            trade_index = count++;
            if(ArrayResize(trades, count) != count)
            {
               ArrayFree(trades);
               count = 0;
               return false;
            }
            KocelResetClosedTrade(trades[trade_index]);
            trades[trade_index].position_ticket = position_ticket;
            trades[trade_index].symbol = SafeString(HistoryDealGetString(deal_ticket, DEAL_SYMBOL));
            const ENUM_DEAL_TYPE close_type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
            trades[trade_index].type = close_type == DEAL_TYPE_SELL ? "BUY" : "SELL";
         }

         trades[trade_index].deal_ticket = deal_ticket;
         trades[trade_index].order_ticket = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_ORDER);
         trades[trade_index].volume += HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
         trades[trade_index].profit += HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
         trades[trade_index].commission += HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
         trades[trade_index].swap += HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
         trades[trade_index].close_price = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
         trades[trade_index].close_time = IsoTime((datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME));
         trades[trade_index].magic = (long)HistoryDealGetInteger(deal_ticket, DEAL_MAGIC);
         trades[trade_index].comment = SafeString(HistoryDealGetString(deal_ticket, DEAL_COMMENT));
      }

      for(int i = 0; i < count; i++)
      {
         if(!HistorySelectByPosition(trades[i].position_ticket))
            continue;

         double entry_volume = 0.0;
         double exit_volume = 0.0;
         trades[i].volume = 0.0;
         trades[i].profit = 0.0;
         trades[i].commission = 0.0;
         trades[i].swap = 0.0;
         const int position_deals = HistoryDealsTotal();
         for(int j = 0; j < position_deals; j++)
         {
            const ulong position_deal = HistoryDealGetTicket(j);
            if(position_deal == 0)
               continue;
            const ENUM_DEAL_ENTRY position_entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(position_deal, DEAL_ENTRY);
            const double deal_volume = HistoryDealGetDouble(position_deal, DEAL_VOLUME);
            if(position_entry == DEAL_ENTRY_IN || position_entry == DEAL_ENTRY_INOUT)
            {
               entry_volume += deal_volume;
               trades[i].open_price = HistoryDealGetDouble(position_deal, DEAL_PRICE);
               trades[i].open_time = IsoTime((datetime)HistoryDealGetInteger(position_deal, DEAL_TIME));
               trades[i].symbol = SafeString(HistoryDealGetString(position_deal, DEAL_SYMBOL));
               trades[i].type = ((ENUM_DEAL_TYPE)HistoryDealGetInteger(position_deal, DEAL_TYPE) == DEAL_TYPE_BUY) ? "BUY" : "SELL";
               trades[i].order_ticket = (ulong)HistoryDealGetInteger(position_deal, DEAL_ORDER);
            }
            if(position_entry == DEAL_ENTRY_OUT || position_entry == DEAL_ENTRY_OUT_BY || position_entry == DEAL_ENTRY_INOUT)
            {
               exit_volume += deal_volume;
               trades[i].volume += deal_volume;
               trades[i].profit += HistoryDealGetDouble(position_deal, DEAL_PROFIT);
               trades[i].commission += HistoryDealGetDouble(position_deal, DEAL_COMMISSION);
               trades[i].swap += HistoryDealGetDouble(position_deal, DEAL_SWAP);
               trades[i].close_price = HistoryDealGetDouble(position_deal, DEAL_PRICE);
               trades[i].close_time = IsoTime((datetime)HistoryDealGetInteger(position_deal, DEAL_TIME));
               trades[i].deal_ticket = position_deal;
               trades[i].comment = SafeString(HistoryDealGetString(position_deal, DEAL_COMMENT));
            }
         }
         trades[i].net_profit = trades[i].profit + trades[i].commission + trades[i].swap;
         if(exit_volume + 0.00000001 < entry_volume)
         {
            for(int j = i + 1; j < count; j++)
               trades[j - 1] = trades[j];
            count--;
            ArrayResize(trades, count);
            i--;
         }
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
         orders[i].created_at = IsoTime(created_at);
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
