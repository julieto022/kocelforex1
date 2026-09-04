#ifndef KOCEL_SYMBOL_RESOLVER_MQH
#define KOCEL_SYMBOL_RESOLVER_MQH

/**
 * Broker-independent MT5 symbol resolution.
 *
 * Kocel sends canonical market symbols (EURUSD, BTCUSD, XAUUSD, US30).
 * Brokers expose their own naming (EURUSDm, BTCUSD.pro, XAUUSD#, US30.raw...).
 * This resolver inspects the symbols actually present in the connected terminal
 * and never assumes a broker, a suffix or a symbol length.
 */

#define KOCEL_SYMBOL_RESOLVE_OK          0
#define KOCEL_SYMBOL_RESOLVE_NOT_FOUND   1
#define KOCEL_SYMBOL_RESOLVE_AMBIGUOUS   2

struct KocelSymbolResolution
{
   int    code;              // KOCEL_SYMBOL_RESOLVE_*
   string requested;         // canonical symbol as sent by Kocel
   string resolved;          // broker symbol to trade
   int    match_count;       // candidates found in the winning tier
   string message;           // safe, human readable diagnostic
};

struct KocelSymbolCacheEntry
{
   string requested;
   string resolved;
};

class CKocelSymbolResolver
{
private:
   KocelSymbolCacheEntry m_cache[];
   string                m_cache_scope;   // login|server, guards against broker/account switches

   static string Upper(const string value)
   {
      string copy = value;
      StringToUpper(copy);
      StringTrimLeft(copy);
      StringTrimRight(copy);
      return copy;
   }

   /** Uppercased, separators removed. Used only for a safe equality comparison. */
   static string Normalize(const string value)
   {
      const string upper = Upper(value);
      string out = "";
      for(int i = 0; i < StringLen(upper); i++)
      {
         const ushort ch = StringGetCharacter(upper, i);
         const bool is_digit = (ch >= '0' && ch <= '9');
         const bool is_alpha = (ch >= 'A' && ch <= 'Z');
         if(is_digit || is_alpha)
            out += ShortToString(ch);
      }
      return out;
   }

   /** True when the extra text around a canonical symbol looks like a broker suffix/prefix. */
   static bool IsSuffixToken(const string token)
   {
      const int len = StringLen(token);
      if(len == 0 || len > 6)
         return false;

      bool seen_separator = false;
      bool seen_alpha = false;
      for(int i = 0; i < len; i++)
      {
         const ushort ch = StringGetCharacter(token, i);
         if(ch >= 'A' && ch <= 'Z')
         {
            seen_alpha = true;
            continue;
         }
         if(ch == '.' || ch == '#' || ch == '_' || ch == '-' || ch == '+' || ch == '!' || ch == '~')
         {
            seen_separator = true;
            continue;
         }
         // Digits (or anything else) would change the instrument identity: EURUSD vs EURUSD5.
         return false;
      }
      return seen_separator || seen_alpha;
   }

   static bool IsSeparatorToken(const string token)
   {
      if(StringLen(token) == 0 || !IsSuffixToken(token))
         return false;
      const ushort first = StringGetCharacter(token, 0);
      return (first == '.' || first == '#' || first == '_' || first == '-' || first == '+' || first == '!' || first == '~');
   }

   /**
    * Ranks a broker symbol against the canonical symbol.
    * 0 = no match, higher is a stronger match.
    *   4 exact
    *   3 canonical + separator suffix  (EURUSD.pro, EURUSD#)
    *   2 canonical + short alpha suffix (EURUSDm, EURUSDmicro)
    *   1 short prefix + canonical      (mEURUSD, .EURUSD)
    */
   static int Rank(const string canonical, const string candidate)
   {
      const string want = Upper(canonical);
      const string have = Upper(candidate);
      if(want == "" || have == "")
         return 0;
      if(want == have)
         return 4;

      const int want_len = StringLen(want);
      const int have_len = StringLen(have);

      if(have_len > want_len && StringSubstr(have, 0, want_len) == want)
      {
         const string suffix = StringSubstr(have, want_len);
         if(IsSuffixToken(suffix))
            return IsSeparatorToken(suffix) ? 3 : 2;
         return 0;
      }

      if(have_len > want_len && StringSubstr(have, have_len - want_len) == want)
      {
         const string prefix = StringSubstr(have, 0, have_len - want_len);
         if(IsSuffixToken(prefix))
            return 1;
      }

      return 0;
   }

   string CacheScope() const
   {
      return IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "|" +
             AccountInfoString(ACCOUNT_SERVER) + "|" +
             AccountInfoString(ACCOUNT_COMPANY);
   }

   bool CacheLookup(const string requested, string &resolved)
   {
      if(m_cache_scope != CacheScope())
      {
         ResetCache();
         return false;
      }
      for(int i = 0; i < ArraySize(m_cache); i++)
      {
         if(m_cache[i].requested == requested)
         {
            // The cached broker symbol must still exist in this terminal.
            if(SymbolSelect(m_cache[i].resolved, true))
            {
               resolved = m_cache[i].resolved;
               return true;
            }
            return false;
         }
      }
      return false;
   }

   void CacheStore(const string requested, const string resolved)
   {
      const string scope = CacheScope();
      if(m_cache_scope != scope)
         ResetCache();
      m_cache_scope = scope;

      const int size = ArraySize(m_cache);
      for(int i = 0; i < size; i++)
      {
         if(m_cache[i].requested == requested)
         {
            m_cache[i].resolved = resolved;
            return;
         }
      }
      ArrayResize(m_cache, size + 1);
      m_cache[size].requested = requested;
      m_cache[size].resolved = resolved;
   }

   /** Scans Market Watch first, then the full broker symbol tree. */
   void Scan(const string canonical, const bool selected_only, int &best_rank,
             string &best_symbol, int &best_count) const
   {
      const int total = SymbolsTotal(selected_only);
      for(int i = 0; i < total; i++)
      {
         const string candidate = SymbolName(i, selected_only);
         if(candidate == "")
            continue;

         const int rank = Rank(canonical, candidate);
         if(rank == 0)
            continue;

         if(rank > best_rank)
         {
            best_rank = rank;
            best_symbol = candidate;
            best_count = 1;
         }
         else if(rank == best_rank && Upper(candidate) != Upper(best_symbol))
         {
            best_count++;
            // Deterministic tie-break inside a tier: shortest, then alphabetical.
            const int have = StringLen(candidate);
            const int keep = StringLen(best_symbol);
            if(have < keep || (have == keep && StringCompare(candidate, best_symbol) < 0))
               best_symbol = candidate;
         }
      }
   }

public:
   void ResetCache()
   {
      ArrayFree(m_cache);
      m_cache_scope = "";
   }

   /**
    * Resolves a canonical Kocel symbol to the tradeable broker symbol
    * available in the connected MT5 terminal.
    */
   KocelSymbolResolution Resolve(const string requested_symbol)
   {
      KocelSymbolResolution out;
      out.code = KOCEL_SYMBOL_RESOLVE_NOT_FOUND;
      out.requested = requested_symbol;
      out.resolved = "";
      out.match_count = 0;
      out.message = "";

      const string canonical = Upper(requested_symbol);
      if(canonical == "")
      {
         out.message = "No symbol was supplied.";
         return out;
      }

      // 1) Exact match always wins and is never rewritten.
      if(SymbolSelect(requested_symbol, true))
      {
         out.code = KOCEL_SYMBOL_RESOLVE_OK;
         out.resolved = requested_symbol;
         out.match_count = 1;
         CacheStore(canonical, out.resolved);
         return out;
      }

      // 2) Session cache (invalidated on account/server/broker change).
      string cached = "";
      if(CacheLookup(canonical, cached))
      {
         out.code = KOCEL_SYMBOL_RESOLVE_OK;
         out.resolved = cached;
         out.match_count = 1;
         return out;
      }

      // 3) Dynamic discovery: Market Watch first, then all broker symbols.
      int best_rank = 0;
      int best_count = 0;
      string best_symbol = "";
      Scan(canonical, true, best_rank, best_symbol, best_count);
      if(best_rank < 4)
      {
         int all_rank = 0;
         int all_count = 0;
         string all_symbol = "";
         Scan(canonical, false, all_rank, all_symbol, all_count);
         if(all_rank > best_rank)
         {
            best_rank = all_rank;
            best_symbol = all_symbol;
            best_count = all_count;
         }
         else if(all_rank == best_rank && best_rank > 0 && all_count > best_count)
         {
            best_count = all_count;
            best_symbol = all_symbol;
         }
      }

      if(best_rank == 0 || best_symbol == "")
      {
         out.message = "No compatible MT5 symbol was found for " + requested_symbol + ".";
         return out;
      }

      // 4) Ambiguity: several equally strong candidates. The attached chart symbol
      //    breaks the tie when it is one of them, otherwise refuse to guess.
      if(best_count > 1)
      {
         const string chart = Symbol();
         if(Rank(canonical, chart) == best_rank)
         {
            best_symbol = chart;
         }
         else
         {
            out.code = KOCEL_SYMBOL_RESOLVE_AMBIGUOUS;
            out.match_count = best_count;
            out.message = StringFormat(
               "Multiple matching symbols were found in this MT5 terminal for %s (%d candidates, e.g. %s).",
               requested_symbol, best_count, best_symbol);
            return out;
         }
      }

      if(!SymbolSelect(best_symbol, true))
      {
         out.message = "No compatible MT5 symbol was found for " + requested_symbol + ".";
         return out;
      }

      out.code = KOCEL_SYMBOL_RESOLVE_OK;
      out.resolved = best_symbol;
      out.match_count = 1;
      CacheStore(canonical, best_symbol);
      return out;
   }
};

// Shared resolver instance (validator/executor are static helpers).
CKocelSymbolResolver g_kocel_symbol_resolver;

#endif
