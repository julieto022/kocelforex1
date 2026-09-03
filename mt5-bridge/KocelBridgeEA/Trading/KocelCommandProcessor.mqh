#ifndef KOCEL_COMMAND_PROCESSOR_MQH
#define KOCEL_COMMAND_PROCESSOR_MQH

#include "../Core/KocelConstants.mqh"
#include "../Core/KocelJson.mqh"
#include "../Core/KocelLogger.mqh"
#include "../Network/KocelBridgeClient.mqh"
#include "KocelTradeTypes.mqh"
#include "KocelTradeExecutor.mqh"

/**
 * Result waiting to be reported to Kocel (reporting retries never re-execute the trade).
 */
struct KocelPendingResult
{
   KocelTradeResult result;
   datetime         next_attempt;
   int              attempts;
};

/**
 * Phase 3.4 command pipeline:
 *   poll response -> JSON parsing -> KocelTradeCommand -> CKocelTradeExecutor::Execute()
 *   -> real MT5 execution -> ReportCommandResult() with safe retry.
 */
class CKocelCommandProcessor
{
private:
   string             m_handled[];   // command ids already executed in this EA session
   KocelPendingResult m_queue[];     // results awaiting successful delivery

   bool IsHandled(const string command_id) const
   {
      for(int i = ArraySize(m_handled) - 1; i >= 0; i--)
         if(m_handled[i] == command_id)
            return true;
      return false;
   }

   void MarkHandled(const string command_id)
   {
      const int size = ArraySize(m_handled);
      if(size >= KOCEL_COMMAND_HISTORY_LIMIT)
      {
         for(int i = 1; i < size; i++)
            m_handled[i - 1] = m_handled[i];
         m_handled[size - 1] = command_id;
         return;
      }
      ArrayResize(m_handled, size + 1);
      m_handled[size] = command_id;
   }

   void RemoveFromQueue(const int index)
   {
      const int size = ArraySize(m_queue);
      for(int i = index + 1; i < size; i++)
         m_queue[i - 1] = m_queue[i];
      ArrayResize(m_queue, size - 1);
   }

   bool ParseCommand(const string json, KocelTradeCommand &cmd) const
   {
      cmd.command_id = "";
      cmd.operation = "";
      cmd.symbol = "";
      cmd.side = "";
      cmd.volume = 0.0;
      cmd.stop_loss = 0.0;
      cmd.take_profit = 0.0;
      cmd.position_ticket = 0;
      cmd.order_ticket = 0;
      cmd.client_request_id = "";
      cmd.requested_at = "";

      if(!KocelJsonGetString(json, "commandId", cmd.command_id) || cmd.command_id == "")
         return false;
      if(!KocelJsonGetString(json, "operation", cmd.operation) || cmd.operation == "")
         return false;

      KocelJsonGetString(json, "symbol", cmd.symbol);
      KocelJsonGetString(json, "side", cmd.side);
      KocelJsonGetString(json, "clientRequestId", cmd.client_request_id);
      KocelJsonGetString(json, "requestedAt", cmd.requested_at);
      KocelJsonGetDouble(json, "volume", cmd.volume);
      KocelJsonGetDouble(json, "stopLoss", cmd.stop_loss);
      KocelJsonGetDouble(json, "takeProfit", cmd.take_profit);
      KocelJsonGetLong(json, "positionTicket", cmd.position_ticket);
      KocelJsonGetLong(json, "orderTicket", cmd.order_ticket);
      return true;
   }

   void Enqueue(const KocelTradeResult &result)
   {
      const int size = ArraySize(m_queue);
      ArrayResize(m_queue, size + 1);
      m_queue[size].result = result;
      m_queue[size].attempts = 0;
      m_queue[size].next_attempt = 0;
   }

   bool Report(const KocelTradeResult &result, CKocelBridgeClient &bridge, CKocelLogger &logger)
   {
      string response_message = "";
      const bool ok = bridge.ReportCommandResult(
         result.command_id,
         result.status,
         result.mt5_ticket,
         result.deal_ticket,
         result.executed_volume,
         result.executed_price,
         result.executed_symbol,
         result.error_code,
         result.message,
         response_message
      );

      if(ok)
      {
         logger.Info("Trade command completed successfully.");
         return true;
      }

      logger.Error("Failed to report execution result (" + response_message + ").");
      logger.Info("Result reporting will retry safely.");
      return false;
   }

public:
   void Reset()
   {
      ArrayFree(m_handled);
      ArrayFree(m_queue);
   }

   int PendingResultCount() const { return ArraySize(m_queue); }

   /**
    * Parses the poll payload and executes every new command.
    * Returns the number of commands executed in this pass.
    */
   int ProcessPollData(const string data, CKocelBridgeClient &bridge, CKocelLogger &logger)
   {
      string commands_array = "";
      if(!KocelJsonGetArray(data, "commands", commands_array))
      {
         logger.Debug("Command poll response contained no command list.");
         return 0;
      }

      string items[];
      const int count = KocelJsonSplitObjects(commands_array, items);
      if(count <= 0)
      {
         logger.Debug("No trade commands pending.");
         return 0;
      }

      int executed = 0;
      for(int i = 0; i < count; i++)
      {
         KocelTradeCommand cmd;
         if(!ParseCommand(items[i], cmd))
         {
            logger.Error("Trade command could not be parsed and was skipped.");
            continue;
         }

         if(IsHandled(cmd.command_id))
         {
            logger.Debug("Trade command " + cmd.command_id + " was already executed; skipping.");
            continue;
         }

         logger.Info("Trade command received from Kocel.");
         logger.Info("Command ID: " + cmd.command_id);
         logger.Info("Operation: " + cmd.operation);
         if(cmd.symbol != "")
            logger.Info("Requested symbol: " + cmd.symbol);
         if(cmd.side != "")
            logger.Info("Side: " + cmd.side);
         if(cmd.volume > 0)
            logger.Info("Volume: " + DoubleToString(cmd.volume, 2));

         logger.Info("Validating trade command...");

         // Guard rails that must be checked before any MT5 trading call.
         KocelTradeResult result;
         bool blocked = false;
         if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
         {
            result.command_id = cmd.command_id;
            result.client_request_id = cmd.client_request_id;
            result.status = KOCEL_TRADE_STATUS_REJECTED;
            result.error_code = "TRADE_NOT_ALLOWED";
            result.message = "Algo trading is disabled in this MT5 terminal.";
            blocked = true;
         }
         else if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) || !AccountInfoInteger(ACCOUNT_TRADE_EXPERT))
         {
            result.command_id = cmd.command_id;
            result.client_request_id = cmd.client_request_id;
            result.status = KOCEL_TRADE_STATUS_REJECTED;
            result.error_code = "ACCOUNT_TRADE_DISABLED";
            result.message = "This MT5 account does not permit expert trading.";
            blocked = true;
         }

         if(!blocked)
         {
            logger.Info("Resolving MT5 symbol...");
            if(cmd.operation == KOCEL_TRADE_OPEN_MARKET)
               logger.Info("Executing " + cmd.side + " command...");
            else
               logger.Info("Executing " + cmd.operation + " command...");

            // Mark before execution: a crash/retry must never place a second order.
            MarkHandled(cmd.command_id);
            result = CKocelTradeExecutor::Execute(cmd);
            if(result.executed_symbol != "")
               logger.Info("MT5 symbol resolved: " + result.executed_symbol);
            if(result.executed_symbol != "" && cmd.operation == KOCEL_TRADE_OPEN_MARKET)
               logger.Info("MT5 symbol: " + result.executed_symbol);
            executed++;
         }
         else
         {
            MarkHandled(cmd.command_id);
            logger.Error("Trade command execution failed.");
            logger.Error("Reason: " + result.message);
         }

         if(result.status == KOCEL_TRADE_STATUS_EXECUTED)
         {
            logger.Info("MT5 trade executed successfully.");
            if(result.mt5_ticket > 0)
               logger.Info("Ticket: " + IntegerToString(result.mt5_ticket));
            if(result.executed_price > 0)
               logger.Info("Price: " + DoubleToString(result.executed_price, 5));
         }
         else
         {
            logger.Error("Trade command execution failed.");
            if(result.error_code != "")
               logger.Error("Error code: " + result.error_code);
            if(result.message != "")
               logger.Error("Reason: " + result.message);
         }

         logger.Info("Reporting execution result to Kocel...");
         if(!Report(result, bridge, logger))
            Enqueue(result);
      }

      ArrayFree(items);
      return executed;
   }

   /** Retries deliveries that failed earlier. Never re-executes a trade. */
   void RetryPendingResults(CKocelBridgeClient &bridge, CKocelLogger &logger)
   {
      const datetime now = TimeLocal();
      for(int i = ArraySize(m_queue) - 1; i >= 0; i--)
      {
         if(m_queue[i].next_attempt != 0 && now < m_queue[i].next_attempt)
            continue;

         if(Report(m_queue[i].result, bridge, logger))
         {
            RemoveFromQueue(i);
            continue;
         }

         m_queue[i].attempts++;
         int delay = KOCEL_COMMAND_RESULT_RETRY_SECONDS * m_queue[i].attempts;
         if(delay > KOCEL_MAX_BACKOFF_SECONDS)
            delay = KOCEL_MAX_BACKOFF_SECONDS;
         m_queue[i].next_attempt = now + delay;
      }
   }
};

#endif
