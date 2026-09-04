#ifndef KOCEL_TRADE_TYPES_MQH
#define KOCEL_TRADE_TYPES_MQH

#include "../Core/KocelConstants.mqh"

// Trade command operations
#define KOCEL_TRADE_OPEN_MARKET       "OPEN_MARKET"
#define KOCEL_TRADE_CLOSE_POSITION    "CLOSE_POSITION"
#define KOCEL_TRADE_MODIFY_POSITION   "MODIFY_POSITION"
#define KOCEL_TRADE_CANCEL_PENDING    "CANCEL_PENDING_ORDER"

// Trade sides
#define KOCEL_TRADE_BUY               "BUY"
#define KOCEL_TRADE_SELL              "SELL"

// Trade command status
#define KOCEL_TRADE_STATUS_PENDING    "PENDING"
#define KOCEL_TRADE_STATUS_SENT       "SENT"
#define KOCEL_TRADE_STATUS_EXECUTING  "EXECUTING"
#define KOCEL_TRADE_STATUS_EXECUTED   "EXECUTED"
#define KOCEL_TRADE_STATUS_FAILED     "FAILED"
#define KOCEL_TRADE_STATUS_REJECTED   "REJECTED"
#define KOCEL_TRADE_STATUS_EXPIRED    "EXPIRED"
#define KOCEL_TRADE_STATUS_CANCELLED  "CANCELLED"

// Received from Kocel backend
struct KocelTradeCommand
{
   string command_id;
   string operation;      // OPEN_MARKET, CLOSE_POSITION, MODIFY_POSITION, CANCEL_PENDING_ORDER
   string symbol;
   string side;           // BUY or SELL
   double volume;
   double stop_loss;
   double take_profit;
   long   position_ticket;
   long   order_ticket;
   string client_request_id;
   string requested_at;
};

// Sent to Kocel backend
struct KocelTradeResult
{
   string command_id;
   string client_request_id;  // Echo from command for idempotency
   string status;         // EXECUTED, FAILED, REJECTED
   long   mt5_ticket;     // Position or order ticket after execution
   long   deal_ticket;    // Deal ticket if filled
   double executed_volume;
   double executed_price;
   string executed_symbol;   // Broker symbol actually traded in MT5
   string error_code;
   string message;
};

// Poll response from backend
struct KocelCommandPollResponse
{
   KocelTradeCommand commands[];
   string last_poll_at;
};

// Validation result
struct KocelTradeValidationResult
{
   bool   valid;
   string error_code;
   string error_message;
   string resolved_symbol;   // Broker symbol resolved for this terminal
};

#endif
