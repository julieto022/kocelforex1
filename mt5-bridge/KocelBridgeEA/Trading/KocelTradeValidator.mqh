#ifndef KOCEL_TRADE_VALIDATOR_MQH
#define KOCEL_TRADE_VALIDATOR_MQH

#include "../Core/KocelConstants.mqh"
#include "KocelTradeTypes.mqh"

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
      
      // Check symbol exists
      if(SymbolSelect(cmd.symbol, true) == false)
      {
         result.valid = false;
         result.error_code = "SYMBOL_NOT_FOUND";
         result.error_message = "Symbol is not available in this terminal.";
         return result;
      }
      
      // Check market is open for this symbol
      if(!SymbolInfoInteger(cmd.symbol, SYMBOL_TRADE_MODE))
      {
         result.valid = false;
         result.error_code = "MARKET_CLOSED";
         result.error_message = "Market is closed for this symbol.";
         return result;
      }
      
      // Check trading is allowed
      if(SymbolInfoInteger(cmd.symbol, SYMBOL_TRADE_EXCEPTIONS) & SYMBOL_TRADE_MODE_CLOSEONLY)
      {
         result.valid = false;
         result.error_code = "TRADE_DISABLED";
         result.error_message = "Trading is disabled for this symbol.";
         return result;
      }
      
      // Check volume constraints
      double min_volume = SymbolInfoDouble(cmd.symbol, SYMBOL_VOLUME_MIN);
      double max_volume = SymbolInfoDouble(cmd.symbol, SYMBOL_VOLUME_MAX);
      double volume_step = SymbolInfoDouble(cmd.symbol, SYMBOL_VOLUME_STEP);
      
      if(cmd.volume < min_volume)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume is below minimum (%.2f)", min_volume);
         return result;
      }
      
      if(cmd.volume > max_volume)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume exceeds maximum (%.2f)", max_volume);
         return result;
      }
      
      // Check volume step
      if(MathMod(cmd.volume, volume_step) != 0)
      {
         result.valid = false;
         result.error_code = "INVALID_VOLUME";
         result.error_message = StringFormat("Volume must be multiple of %.4f", volume_step);
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
