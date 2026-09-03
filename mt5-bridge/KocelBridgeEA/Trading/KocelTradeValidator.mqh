#ifndef KOCEL_TRADE_VALIDATOR_MQH
#define KOCEL_TRADE_VALIDATOR_MQH

#include "../Core/KocelConstants.mqh"
#include "KocelTradeTypes.mqh"
#include "../MT5/KocelSymbolResolver.mqh"

CKocelSymbolResolver g_kocel_symbol_resolver;

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
      result.valid = false;
      result.resolved_symbol = "";
      result.error_code = "";
      result.error_message = "";
      
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
      
      KocelSymbolResolution resolution = g_kocel_symbol_resolver.Resolve(cmd.symbol);
      if(resolution.code == KOCEL_SYMBOL_RESOLVE_NOT_FOUND)
      {
         result.error_code = "SYMBOL_NOT_FOUND";
         result.error_message = "No compatible MT5 symbol was found for " + cmd.symbol + ".";
         return result;
      }
      if(resolution.code == KOCEL_SYMBOL_RESOLVE_AMBIGUOUS)
      {
         result.error_code = "SYMBOL_AMBIGUOUS";
         result.error_message = "Multiple matching symbols were found for " + cmd.symbol + " in this MT5 terminal.";
         return result;
      }

      result.resolved_symbol = resolution.resolved;
      const string symbol = result.resolved_symbol;
      
      // Check market is open for this symbol
      const long trade_mode = SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
      if(trade_mode == SYMBOL_TRADE_MODE_DISABLED)
      {
         result.error_code = "MARKET_CLOSED";
         result.error_message = "Market is closed for this symbol.";
         return result;
      }
      
      // Check trading is allowed
      if(trade_mode == SYMBOL_TRADE_MODE_CLOSEONLY)
      {
         result.error_code = "TRADE_DISABLED";
         result.error_message = "Trading is disabled for this symbol.";
         return result;
      }

      if((cmd.side == KOCEL_TRADE_BUY && trade_mode == SYMBOL_TRADE_MODE_SHORTONLY) ||
         (cmd.side == KOCEL_TRADE_SELL && trade_mode == SYMBOL_TRADE_MODE_LONGONLY))
      {
         result.error_code = "TRADE_DISABLED";
         result.error_message = "The requested side is not permitted for this symbol.";
         return result;
      }
      
      // Check volume constraints
      double min_volume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      double max_volume = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
      double volume_step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

      if(min_volume <= 0 || max_volume < min_volume || volume_step <= 0)
      {
         result.error_code = "INVALID_VOLUME";
         result.error_message = "Volume rules are unavailable for " + symbol + ".";
         return result;
      }
      
      if(cmd.volume < min_volume)
      {
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume %.4f is not valid for %s; minimum is %.4f.", cmd.volume, symbol, min_volume);
         return result;
      }
      
      if(cmd.volume > max_volume)
      {
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume %.4f is not valid for %s; maximum is %.4f.", cmd.volume, symbol, max_volume);
         return result;
      }
      
      // Check volume step
      const double step_remainder = MathMod(cmd.volume, volume_step);
      if(step_remainder > 0.00000001 && volume_step - step_remainder > 0.00000001)
      {
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume %.4f is not valid for %s; volume step is %.4f.", cmd.volume, symbol, volume_step);
         return result;
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
      
      result.valid = true;
      return result;
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
      else if(cmd.operation == KOCEL_TRADE_CANCEL_PENDING)
         return ValidateCancelPendingOrder(cmd);
      
      result.valid = false;
      result.error_code = "UNKNOWN_OPERATION";
      result.error_message = "Unknown trade operation.";
      return result;
   }
};

#endif
