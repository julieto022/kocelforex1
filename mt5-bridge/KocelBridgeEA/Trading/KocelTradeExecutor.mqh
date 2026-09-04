#ifndef KOCEL_TRADE_EXECUTOR_MQH
#define KOCEL_TRADE_EXECUTOR_MQH

#include "../Core/KocelConstants.mqh"
#include "KocelTradeTypes.mqh"
#include "KocelTradeValidator.mqh"

/**
 * Trade execution using native MT5 trading APIs
 */
class CKocelTradeExecutor
{
public:
   /**
    * Execute an open market order
    */
   static KocelTradeResult ExecuteOpenMarket(const KocelTradeCommand &cmd)
   {
      KocelTradeResult result;
      result.command_id = cmd.command_id;
      result.client_request_id = cmd.client_request_id;
      
      // Validate first
      KocelTradeValidationResult validation = CKocelTradeValidator::ValidateOpenMarket(cmd);
      if(!validation.valid)
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = validation.error_code;
         result.message = validation.error_message;
         return result;
      }
      
      // Prepare the request
      MqlTradeRequest request = {};
      MqlTradeResult trade_result = {};
      
      request.action = TRADE_ACTION_DEAL;
      request.symbol = cmd.symbol;
      request.volume = cmd.volume;
      request.type = (cmd.side == KOCEL_TRADE_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      request.price = 0;  // Market order - let MT5 fill at current price
      request.tp = cmd.take_profit > 0 ? cmd.take_profit : 0;
      request.sl = cmd.stop_loss > 0 ? cmd.stop_loss : 0;
      request.deviation = 20;  // Points of slippage tolerance
      request.magic = 0x4B4F43;  // Magic number to identify Kocel trades (KOCEL in hex)
      request.comment = "Kocel Manual Trade";
      request.type_filling = ORDER_FILLING_FOK;  // Fill or Kill
      request.type_time = ORDER_TIME_GTC;        // Good Till Cancel
      
      // Execute the order
      if(!OrderSend(request, trade_result))
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = "ORDER_SEND_FAILED";
         result.message = StringFormat("OrderSend failed: %s", GetLastError());
         return result;
      }
      
      // Check execution result
      if(trade_result.retcode != TRADE_RETCODE_DONE && trade_result.retcode != TRADE_RETCODE_DONE_PARTIAL)
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = StringFormat("RETCODE_%d", trade_result.retcode);
         result.message = StringFormat("Execution error: code %d", trade_result.retcode);
         return result;
      }
      
      // Success
      result.status = KOCEL_TRADE_STATUS_EXECUTED;
      result.mt5_ticket = trade_result.order;
      result.deal_ticket = trade_result.deal;
      result.executed_volume = trade_result.volume;
      result.executed_price = trade_result.price;
      result.message = "Order executed successfully";
      
      return result;
   }
   
   /**
    * Execute a close position command
    */
   static KocelTradeResult ExecuteClosePosition(const KocelTradeCommand &cmd)
   {
      KocelTradeResult result;
      result.command_id = cmd.command_id;
      result.client_request_id = cmd.client_request_id;
      
      // Validate
      KocelTradeValidationResult validation = CKocelTradeValidator::ValidateClosePosition(cmd);
      if(!validation.valid)
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = validation.error_code;
         result.message = validation.error_message;
         return result;
      }
      
      // Get position details
      if(!PositionSelectByTicket(cmd.position_ticket))
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = "POSITION_NOT_FOUND";
         result.message = "Cannot select position";
         return result;
      }
      
      string symbol = PositionGetString(POSITION_SYMBOL);
      ENUM_POSITION_TYPE pos_type = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      double volume = PositionGetDouble(POSITION_VOLUME);
      
      // Prepare close request
      MqlTradeRequest request = {};
      MqlTradeResult trade_result = {};
      
      request.action = TRADE_ACTION_DEAL;
      request.position = cmd.position_ticket;
      request.symbol = symbol;
      request.volume = volume;
      request.type = (pos_type == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
      request.price = 0;
      request.deviation = 20;
      request.magic = 0x4B4F43;  // Magic number to identify Kocel trades
      request.comment = "Kocel Close Trade";
      request.type_filling = ORDER_FILLING_FOK;
      request.type_time = ORDER_TIME_GTC;
      
      // Close the position
      if(!OrderSend(request, trade_result))
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = "ORDER_SEND_FAILED";
         result.message = StringFormat("OrderSend failed: %s", GetLastError());
         return result;
      }
      
      if(trade_result.retcode != TRADE_RETCODE_DONE && trade_result.retcode != TRADE_RETCODE_DONE_PARTIAL)
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = StringFormat("RETCODE_%d", trade_result.retcode);
         result.message = StringFormat("Execution error: code %d", trade_result.retcode);
         return result;
      }
      
      result.status = KOCEL_TRADE_STATUS_EXECUTED;
      result.deal_ticket = trade_result.deal;
      result.executed_volume = trade_result.volume;
      result.executed_price = trade_result.price;
      result.message = "Position closed successfully";
      
      return result;
   }
   
   /**
    * Execute a modify position command (modify SL/TP)
    */
   static KocelTradeResult ExecuteModifyPosition(const KocelTradeCommand &cmd)
   {
      KocelTradeResult result;
      result.command_id = cmd.command_id;
      result.client_request_id = cmd.client_request_id;
      
      // Validate
      KocelTradeValidationResult validation = CKocelTradeValidator::ValidateModifyPosition(cmd);
      if(!validation.valid)
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = validation.error_code;
         result.message = validation.error_message;
         return result;
      }
      
      // Get position details
      if(!PositionSelectByTicket(cmd.position_ticket))
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = "POSITION_NOT_FOUND";
         result.message = "Cannot select position";
         return result;
      }
      
      string symbol = PositionGetString(POSITION_SYMBOL);
      
      // Prepare modify request
      MqlTradeRequest request = {};
      MqlTradeResult trade_result = {};
      
      request.action = TRADE_ACTION_SLTP;
      request.position = cmd.position_ticket;
      request.symbol = symbol;
      request.tp = cmd.take_profit > 0 ? cmd.take_profit : 0;
      request.sl = cmd.stop_loss > 0 ? cmd.stop_loss : 0;
      request.magic = 0x4B4F43;  // Magic number to identify Kocel trades
      request.comment = "Kocel Modify SL/TP";
      
      // Send modify request
      if(!OrderSend(request, trade_result))
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = "ORDER_SEND_FAILED";
         result.message = StringFormat("OrderSend failed: %s", GetLastError());
         return result;
      }
      
      if(trade_result.retcode != TRADE_RETCODE_DONE)
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = StringFormat("RETCODE_%d", trade_result.retcode);
         result.message = StringFormat("Execution error: code %d", trade_result.retcode);
         return result;
      }
      
      result.status = KOCEL_TRADE_STATUS_EXECUTED;
      result.message = "Position SL/TP modified successfully";
      
      return result;
   }
   
   /**
    * Execute a cancel pending order command
    */
   static KocelTradeResult ExecuteCancelPendingOrder(const KocelTradeCommand &cmd)
   {
      KocelTradeResult result;
      result.command_id = cmd.command_id;
      result.client_request_id = cmd.client_request_id;
      
      // Validate
      KocelTradeValidationResult validation = CKocelTradeValidator::ValidateCancelPendingOrder(cmd);
      if(!validation.valid)
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = validation.error_code;
         result.message = validation.error_message;
         return result;
      }
      
      // Get order details
      if(!OrderSelect(cmd.order_ticket))
      {
         result.status = KOCEL_TRADE_STATUS_REJECTED;
         result.error_code = "ORDER_NOT_FOUND";
         result.message = "Cannot select order";
         return result;
      }
      
      string symbol = OrderGetString(ORDER_SYMBOL);
      
      // Prepare cancel request
      MqlTradeRequest request = {};
      MqlTradeResult trade_result = {};
      
      request.action = TRADE_ACTION_REMOVE;
      request.order = cmd.order_ticket;
      request.symbol = symbol;
      request.magic = 0x4B4F43;  // Magic number to identify Kocel trades
      request.comment = "Kocel Cancel Order";
      
      // Cancel the order
      if(!OrderSend(request, trade_result))
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = "ORDER_SEND_FAILED";
         result.message = StringFormat("OrderSend failed: %s", GetLastError());
         return result;
      }
      
      if(trade_result.retcode != TRADE_RETCODE_DONE)
      {
         result.status = KOCEL_TRADE_STATUS_FAILED;
         result.error_code = StringFormat("RETCODE_%d", trade_result.retcode);
         result.message = StringFormat("Execution error: code %d", trade_result.retcode);
         return result;
      }
      
      result.status = KOCEL_TRADE_STATUS_EXECUTED;
      result.message = "Pending order cancelled successfully";
      
      return result;
   }
   
   /**
    * Main execution dispatcher
    */
   static KocelTradeResult Execute(const KocelTradeCommand &cmd)
   {
      KocelTradeResult result;
      result.command_id = cmd.command_id;
      result.client_request_id = cmd.client_request_id;
      
      if(cmd.operation == KOCEL_TRADE_OPEN_MARKET)
         return ExecuteOpenMarket(cmd);
      else if(cmd.operation == KOCEL_TRADE_CLOSE_POSITION)
         return ExecuteClosePosition(cmd);
      else if(cmd.operation == KOCEL_TRADE_MODIFY_POSITION)
         return ExecuteModifyPosition(cmd);
      else if(cmd.operation == KOCEL_TRADE_CANCEL_PENDING)
         return ExecuteCancelPendingOrder(cmd);
      
      result.status = KOCEL_TRADE_STATUS_REJECTED;
      result.error_code = "UNKNOWN_OPERATION";
      result.message = "Unknown trade operation.";
      return result;
   }
};

#endif
