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
