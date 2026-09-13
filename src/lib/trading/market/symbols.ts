export type RuntimeSymbolResolution =
  | { ok: true; requestedSymbol: string; resolvedSymbol: string; candidates: string[] }
  | { ok: false; requestedSymbol: string; candidates: string[]; reason: "SYMBOL_NOT_AVAILABLE" | "SYMBOL_RESOLUTION_AMBIGUOUS" };

function canonical(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Resolves a user-entered symbol only from symbols actually reported by the
 * connected MT5 Bridge. It never invents a broker suffix or uses a global list.
 */
export function resolveRuntimeSymbol(requestedSymbol: string, reportedSymbols: string[]): RuntimeSymbolResolution {
  const requested = requestedSymbol.trim();
  const unique = [...new Set(reportedSymbols.map((symbol) => symbol.trim()).filter(Boolean))];
  const exact = unique.filter((symbol) => canonical(symbol) === canonical(requested));
  if (exact.length === 1) return { ok: true, requestedSymbol: requested, resolvedSymbol: exact[0]!, candidates: unique };

  const compatible = unique.filter((symbol) => {
    const value = canonical(symbol);
    const base = canonical(requested);
    return value.startsWith(base) && /^[A-Z0-9]+(?:[._-][A-Z0-9]+|[A-Z])+$/.test(value.slice(base.length));
  });
  if (compatible.length === 1) return { ok: true, requestedSymbol: requested, resolvedSymbol: compatible[0]!, candidates: unique };
  if (compatible.length > 1) return { ok: false, requestedSymbol: requested, candidates: compatible, reason: "SYMBOL_RESOLUTION_AMBIGUOUS" };
  return { ok: false, requestedSymbol: requested, candidates: unique, reason: "SYMBOL_NOT_AVAILABLE" };
}