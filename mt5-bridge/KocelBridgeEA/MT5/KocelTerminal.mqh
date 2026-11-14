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

   string TimeframeName(const ENUM_TIMEFRAMES timeframe) const
   {
      switch(timeframe)
      {
         case PERIOD_M1: return "M1";
         case PERIOD_M5: return "M5";
         case PERIOD_M15: return "M15";
         case PERIOD_M30: return "M30";
         case PERIOD_H1: return "H1";
         case PERIOD_H4: return "H4";
         case PERIOD_D1: return "D1";
         default: return "";
      }
   }

   ENUM_TIMEFRAMES TimeframeFromName(const string timeframe) const
   {
      if(timeframe == "M1") return PERIOD_M1;
      if(timeframe == "M5") return PERIOD_M5;
      if(timeframe == "M15") return PERIOD_M15;
      if(timeframe == "M30") return PERIOD_M30;
      if(timeframe == "H1") return PERIOD_H1;
      if(timeframe == "H4") return PERIOD_H4;
      if(timeframe == "D1") return PERIOD_D1;
      return PERIOD_CURRENT;
   }

   datetime ParseRangeTime(const string value) const
   {
      if(StringLen(value) < 19)
         return 0;
      MqlDateTime parts;
      parts.year = (int)StringToInteger(StringSubstr(value, 0, 4));
      parts.mon = (int)StringToInteger(StringSubstr(value, 5, 2));
      parts.day = (int)StringToInteger(StringSubstr(value, 8, 2));
      parts.hour = (int)StringToInteger(StringSubstr(value, 11, 2));
      parts.min = (int)StringToInteger(StringSubstr(value, 14, 2));
      parts.sec = (int)StringToInteger(StringSubstr(value, 17, 2));
      if(parts.year < 1970 || parts.mon < 1 || parts.mon > 12 ||
         parts.day < 1 || parts.day > 31 || parts.hour < 0 || parts.hour > 23 ||
         parts.min < 0 || parts.min > 59 || parts.sec < 0 || parts.sec > 59)
         return 0;
      const long server_offset = (long)(TimeTradeServer() - TimeGMT());
      return (datetime)(StructToTime(parts) + server_offset);
   }

   string IsoUtcTime(const datetime server_time) const
   {
      const long server_offset = (long)(TimeTradeServer() - TimeGMT());
      MqlDateTime parts;
      TimeToStruct((datetime)(server_time - server_offset), parts);
      return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d",
                          parts.year, parts.mon, parts.day,
                          parts.hour, parts.min, parts.sec);
   }

public:
   bool Refresh(KocelMt5AccountInfo &info) const
   {
      KocelResetAccountInfo(info);

      info.login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
      info.server = SafeString(AccountInfoString(ACCOUNT_SERVER));
      info.broker = SafeString(AccountInfoString(ACCOUNT_COMPANY));
      if(info.broker == "")
         info.broker = info.server;
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

   bool ReadMarketCandles(const string symbol, KocelMt5Candle &candles[], int &count, const bool initial_sync, const int per_timeframe = 400) const
   {
      ArrayFree(candles);
      count = 0;
      if(symbol == "" || per_timeframe < 2)
         return false;

      ENUM_TIMEFRAMES timeframes[7] = { PERIOD_M1, PERIOD_M5, PERIOD_M15, PERIOD_M30, PERIOD_H1, PERIOD_H4, PERIOD_D1 };
      for(int timeframe_index = 0; timeframe_index < ArraySize(timeframes); timeframe_index++)
      {
         MqlRates rates[];
         ArraySetAsSeries(rates, false);
         const int requested = initial_sync ? per_timeframe : 2;
         const int copied = CopyRates(symbol, timeframes[timeframe_index], 1, requested, rates);
         if(copied <= 0)
            continue;

         const string timeframe_name = TimeframeName(timeframes[timeframe_index]);
         for(int rate_index = 0; rate_index < copied; rate_index++)
         {
            const int next = count;
            if(ArrayResize(candles, next + 1) != next + 1)
            {
               ArrayFree(candles);
               count = 0;
               return false;
            }
            candles[next].symbol = symbol;
            candles[next].timeframe = timeframe_name;
            candles[next].timestamp = IsoUtcTime(rates[rate_index].time);
            candles[next].open = rates[rate_index].open;
            candles[next].high = rates[rate_index].high;
            candles[next].low = rates[rate_index].low;
            candles[next].close = rates[rate_index].close;
            candles[next].volume = (long)rates[rate_index].tick_volume;
            count++;
         }
      }
      return count > 0;
   }

   bool ReadMarketSymbols(string &symbols[], int &count) const
   {
      ArrayFree(symbols);
      count = 0;
      const int total = SymbolsTotal(true);
      const int limit = MathMin(total, 5000);
      if(limit <= 0)
         return false;
      if(ArrayResize(symbols, limit) != limit)
         return false;
      for(int i = 0; i < limit; i++)
      {
         const string symbol = SymbolName(i, true);
         if(symbol == "")
            continue;
         symbols[count++] = symbol;
      }
      ArrayResize(symbols, count);
      return count > 0;
   }

   bool ReadMarketHistoryPage(const string symbol, const string timeframe_name,
                              const string page_start_at, const string end_at,
                              KocelMt5Candle &candles[], int &count,
                              string &next_start_at, string &message) const
   {
      ArrayFree(candles);
      count = 0;
      next_start_at = "";
      message = "";
      const ENUM_TIMEFRAMES timeframe = TimeframeFromName(timeframe_name);
      const datetime start_time = ParseRangeTime(page_start_at);
      const datetime end_time = ParseRangeTime(end_at);
      const int period_seconds = PeriodSeconds(timeframe);
      if(symbol == "" || timeframe == PERIOD_CURRENT || start_time <= 0 ||
         end_time <= start_time || end_time > TimeTradeServer() || period_seconds <= 0)
      {
         message = "The requested symbol, timeframe, or date range is invalid.";
         return false;
      }
      if(!SymbolSelect(symbol, true))
      {
         message = "MT5 could not select the requested symbol. Add it to Market Watch and retry.";
         return false;
      }

      datetime page_end = end_time;
      const datetime max_page_end =
         start_time + (datetime)(period_seconds * KOCEL_HISTORY_PAGE_CANDLES - 1);
      if(page_end > max_page_end)
         page_end = max_page_end;
      if(page_end < end_time)
         next_start_at = IsoUtcTime(page_end + 1);

      MqlRates rates[];
      ArraySetAsSeries(rates, false);
      const int copied = CopyRates(symbol, timeframe, start_time, page_end, rates);
      if(copied < 0)
      {
         message = "MT5 could not read this history page. Check that the terminal has downloaded the broker's history.";
         return false;
      }
      const datetime current_bar_time = iTime(symbol, timeframe, 0);
      int completed_count = 0;
      for(int i = 0; i < copied; i++)
         if(current_bar_time <= 0 || rates[i].time < current_bar_time)
            completed_count++;
      if(completed_count > KOCEL_HISTORY_PAGE_CANDLES)
      {
         message = "MT5 returned too many candles for one bounded history page.";
         return false;
      }
      if(completed_count == 0)
         return true;
      if(ArrayResize(candles, completed_count) != completed_count)
      {
         message = "MT5 could not allocate memory for the requested candle history.";
         return false;
      }

      int candle_index = 0;
      for(int i = 0; i < copied; i++)
      {
         if(current_bar_time > 0 && rates[i].time >= current_bar_time)
            continue;
         candles[candle_index].symbol = symbol;
         candles[candle_index].timeframe = timeframe_name;
         candles[candle_index].timestamp = IsoUtcTime(rates[i].time);
         candles[candle_index].open = rates[i].open;
         candles[candle_index].high = rates[i].high;
         candles[candle_index].low = rates[i].low;
         candles[candle_index].close = rates[i].close;
         candles[candle_index].volume = (long)rates[i].tick_volume;
         candle_index++;
      }
      count = completed_count;
      return true;
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
