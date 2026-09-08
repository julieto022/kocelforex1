#ifndef KOCEL_TRADE_VALIDATOR_MQH
#define KOCEL_TRADE_VALIDATOR_MQH

#include "../Core/KocelConstants.mqh"
#include "KocelTradeTypes.mqh"
#include "../MT5/KocelSymbolResolver.mqh"

/**
 * Trade validation - ensures commands are valid before execution against MT5
 */
class CKocelTradeValidator
{
public:
   /**
    * Validates an open market order command
    */
   static KocelTradeValidationResult ValidateOpenMarket(const KocelTradeCommand &cmd)
   {
      KocelTradeValidationResult result;
      
      // Symbol is required
      if(StringLen(cmd.symbol) == 0)
      {
         result.valid = false;
         result.error_code = "INVALID_SYMBOL";
         result.error_message = "Symbol is required for market order.";
         return result;
      }
      
      // Side must be BUY or SELL
      if(cmd.side != KOCEL_TRADE_BUY && cmd.side != KOCEL_TRADE_SELL)
      {
         result.valid = false;
         result.error_code = "INVALID_SIDE";
         result.error_message = "Side must be BUY or SELL.";
         return result;
      }
      
      // Volume must be positive
      if(cmd.volume <= 0)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = "Volume must be positive.";
         return result;
      }
      
      // Resolve the canonical Kocel symbol against the symbols this broker exposes.
      KocelSymbolResolution resolution = g_kocel_symbol_resolver.Resolve(cmd.symbol);
      if(resolution.code == KOCEL_SYMBOL_RESOLVE_AMBIGUOUS)
      {
         result.valid = false;
         result.error_code = "SYMBOL_AMBIGUOUS";
         result.error_message = resolution.message;
         return result;
      }
      if(resolution.code != KOCEL_SYMBOL_RESOLVE_OK || resolution.resolved == "")
      {
         result.valid = false;
         result.error_code = "SYMBOL_NOT_FOUND";
         result.error_message = resolution.message != ""
            ? resolution.message
            : StringFormat("Symbol %s is not available in this MT5 terminal.", cmd.symbol);
         return result;
      }

      const string symbol = resolution.resolved;
      result.resolved_symbol = symbol;

      // Check trading is allowed for the resolved symbol
      long trade_mode = SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
      if(trade_mode == SYMBOL_TRADE_MODE_DISABLED)
      {
         result.valid = false;
         result.error_code = "TRADE_DISABLED";
         result.error_message = StringFormat("Trading is disabled for %s in this MT5 terminal.", symbol);
         return result;
      }
      if(trade_mode == SYMBOL_TRADE_MODE_CLOSEONLY)
      {
         result.valid = false;
         result.error_code = "TRADE_DISABLED";
         result.error_message = StringFormat("%s is close-only in this MT5 terminal.", symbol);
         return result;
      }

      // Check volume constraints against the resolved symbol
      double min_volume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      double max_volume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
      double volume_step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

      if(cmd.volume < min_volume)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume is below the minimum for %s (%.2f)", symbol, min_volume);
         return result;
      }

      if(max_volume > 0 && cmd.volume > max_volume)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume exceeds the maximum for %s (%.2f)", symbol, max_volume);
         return result;
      }

      if(volume_step > 0 && MathAbs(MathMod(cmd.volume, volume_step)) > 0.0000001)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume for %s must be a multiple of %.4f", symbol, volume_step);
         return result;
      }

      const ENUM_ORDER_TYPE order_type = cmd.side == KOCEL_TRADE_BUY ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      const double price = order_type == ORDER_TYPE_BUY ? SymbolInfoDouble(symbol, SYMBOL_ASK) : SymbolInfoDouble(symbol, SYMBOL_BID);
      double required_margin = 0.0;
      if(!OrderCalcMargin(order_type, symbol, cmd.volume, price, required_margin) ||
         required_margin > AccountInfoDouble(ACCOUNT_MARGIN_FREE))
      {
         result.valid = false;
         result.error_code = "INSUFFICIENT_MARGIN";
         result.error_message = "Trade rejected because available free margin is insufficient.";
         return result;
      }

      const double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      const long stops_level = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      const long freeze_level = SymbolInfoInteger(symbol, SYMBOL_TRADE_FREEZE_LEVEL);
      const double minimum_distance = MathMax(stops_level, freeze_level) * point;
      if(minimum_distance > 0 && cmd.stop_loss > 0)
      {
         if(order_type == ORDER_TYPE_BUY && price - cmd.stop_loss < minimum_distance)
         {
            result.valid = false;
            result.error_code = "INVALID_STOP_LEVEL";
            result.error_message = "Stop Loss is inside the broker minimum stop distance.";
            return result;
         }
         if(order_type == ORDER_TYPE_SELL && cmd.stop_loss - price < minimum_distance)
         {
            result.valid = false;
            result.error_code = "INVALID_STOP_LEVEL";
            result.error_message = "Stop Loss is inside the broker minimum stop distance.";
            return result;
         }
      }

      result.valid = true;
      return result;
   }
   
   /**
    * Validates a close position command
    */
   static KocelTradeValidationResult ValidateClosePosition(const KocelTradeCommand &cmd)
   {
      KocelTradeValidationResult result;
      
      if(cmd.position_ticket <= 0)
      {
         result.valid = false;
         result.error_code = "INVALID_TICKET";
         result.error_message = "Position ticket must be positive.";
         return result;
      }
      
      // Check position exists
      if(!PositionSelectByTicket(cmd.position_ticket))
      {
         result.valid = false;
         result.error_code = "POSITION_NOT_FOUND";
         result.error_message = "Position does not exist or is not accessible.";
         return result;
      }
      
      result.valid = true;
      return result;
   }
   
   /**
    * Validates a modify position command
    */
   static KocelTradeValidationResult ValidateModifyPosition(const KocelTradeCommand &cmd)
   {
      KocelTradeValidationResult result;
      
      if(cmd.position_ticket <= 0)
      {
         result.valid = false;
         result.error_code = "INVALID_TICKET";
         result.error_message = "Position ticket must be positive.";
         return result;
      }
      
      // Check position exists
      if(!PositionSelectByTicket(cmd.position_ticket))
      {
         result.valid = false;
         result.error_code = "POSITION_NOT_FOUND";
         result.error_message = "Position does not exist or is not accessible.";
         return result;
      }
      
      const string symbol = PositionGetString(POSITION_SYMBOL);
      const double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      const long stops_level = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
      const long freeze_level = SymbolInfoInteger(symbol, SYMBOL_TRADE_FREEZE_LEVEL);
      const double minimum_distance = MathMax(stops_level, freeze_level) * point;
      const ENUM_POSITION_TYPE position_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      const double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
      const double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
      if(minimum_distance > 0 && position_type == POSITION_TYPE_BUY)
      {
         if(cmd.stop_loss > 0 && bid - cmd.stop_loss < minimum_distance)
         {
            result.valid = false;
            result.error_code = "INVALID_STOP_LEVEL";
            result.error_message = "Stop Loss is inside the broker minimum stop distance.";
            return result;
         }
         if(cmd.take_profit > 0 && cmd.take_profit - ask < minimum_distance)
         {
            result.valid = false;
            result.error_code = "INVALID_STOP_LEVEL";
            result.error_message = "Take Profit is inside the broker minimum stop distance.";
            return result;
         }
      }
      if(minimum_distance > 0 && position_type == POSITION_TYPE_SELL)
      {
         if(cmd.stop_loss > 0 && cmd.stop_loss - ask < minimum_distance)
         {
            result.valid = false;
            result.error_code = "INVALID_STOP_LEVEL";
            result.error_message = "Stop Loss is inside the broker minimum stop distance.";
            return result;
         }
         if(cmd.take_profit > 0 && bid - cmd.take_profit < minimum_distance)
         {
            result.valid = false;
            result.error_code = "INVALID_STOP_LEVEL";
            result.error_message = "Take Profit is inside the broker minimum stop distance.";
            return result;
         }
      }

      result.valid = true;
      return result;
   }

   static KocelTradeValidationResult ValidatePartialClose(const KocelTradeCommand &cmd)
   {
      KocelTradeValidationResult result;
      if(cmd.position_ticket <= 0 || !PositionSelectByTicket(cmd.position_ticket))
      {
         result.valid = false;
         result.error_code = "POSITION_NOT_FOUND";
         result.error_message = "Position does not exist or is not accessible.";
         return result;
      }
      const string symbol = PositionGetString(POSITION_SYMBOL);
      const double position_volume = PositionGetDouble(POSITION_VOLUME);
      const double min_volume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      const double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
      if(cmd.volume <= 0 || cmd.volume > position_volume + 0.0000001 || cmd.volume < min_volume)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = "Close volume must be positive and no greater than the position volume.";
         return result;
      }
      if(step > 0 && MathAbs(MathMod(cmd.volume, step)) > 0.0000001)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Close volume must be a multiple of %.4f.", step);
         return result;
      }
      result.valid = true;
      return result;
   }

   static KocelTradeValidationResult ValidateBreakEven(const KocelTradeCommand &cmd)
   {
      if(cmd.position_ticket <= 0 || !PositionSelectByTicket(cmd.position_ticket))
      {
         KocelTradeValidationResult result;
         result.valid = false;
         result.error_code = "POSITION_NOT_FOUND";
         result.error_message = "Position does not exist or is not accessible.";
         return result;
      }
      KocelTradeCommand break_even = cmd;
      break_even.stop_loss = PositionGetDouble(POSITION_PRICE_OPEN);
      break_even.take_profit = PositionGetDouble(POSITION_TP);
      return ValidateModifyPosition(break_even);
   }
   
   /**
    * Validates a cancel pending order command
    */
   static KocelTradeValidationResult ValidateCancelPendingOrder(const KocelTradeCommand &cmd)
   {
      KocelTradeValidationResult result;
      
      if(cmd.order_ticket <= 0)
      {
         result.valid = false;
         result.error_code = "INVALID_TICKET";
         result.error_message = "Order ticket must be positive.";
         return result;
      }
      
      // Check order exists
      if(!OrderSelect(cmd.order_ticket))
      {
         result.valid = false;
         result.error_code = "ORDER_NOT_FOUND";
         result.error_message = "Pending order does not exist or is not accessible.";
         return result;
      }
      
      result.valid = true;
      return result;
   }
   
   /**
    * Main validation dispatcher
    */
   static KocelTradeValidationResult Validate(const KocelTradeCommand &cmd)
   {
      KocelTradeValidationResult result;
      
      if(cmd.operation == KOCEL_TRADE_OPEN_MARKET)
         return ValidateOpenMarket(cmd);
      else if(cmd.operation == KOCEL_TRADE_CLOSE_POSITION)
         return ValidateClosePosition(cmd);
      else if(cmd.operation == KOCEL_TRADE_MODIFY_POSITION)
         return ValidateModifyPosition(cmd);
      else if(cmd.operation == KOCEL_TRADE_PARTIAL_CLOSE)
         return ValidatePartialClose(cmd);
      else if(cmd.operation == KOCEL_TRADE_BREAK_EVEN)
         return ValidateBreakEven(cmd);
      else if(cmd.operation == KOCEL_TRADE_CANCEL_PENDING)
         return ValidateCancelPendingOrder(cmd);
      
      result.valid = false;
      result.error_code = "UNKNOWN_OPERATION";
      result.error_message = "Unknown trade operation.";
      return result;
   }
};

#endif
