export function isStrategySymbolAllowed(configuration: Record<string, unknown>, symbol: string) {
  const targets = configuration["targetSymbols"];
  if (!Array.isArray(targets) || targets.length === 0 || targets.includes("*")) return true;
  return targets.some(
    (target) => typeof target === "string" && target.toUpperCase() === symbol.toUpperCase(),
  );
}
