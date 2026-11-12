import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/kocel/page-header";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/kocel/states";
import { StatusBadge } from "@/components/kocel/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getMarketSymbols } from "@/lib/functions/market-history.functions";
import {
  createStrategy,
  deleteStrategy,
  updateStrategy,
} from "@/lib/functions/strategy-management.functions";
import { getStrategyDefinitions } from "@/lib/trading/strategies/registry";
import { customRulesSchema, defaultCustomRules } from "@/lib/trading/strategies/custom-rules";
import { useConnections } from "@/lib/use-connections";
import { getStrategies, StrategyServiceError } from "@/services/strategies";
import type { Strategy } from "@/services/types";

export const Route = createFileRoute("/_app/strategies")({
  component: StrategiesPage,
});

const categoryOptions = [
  "Scalping",
  "Day Trading",
  "Swing Trading",
  "Position Trading",
  "Trend Following",
  "Range Trading",
  "Breakout",
  "Price Action",
  "Custom",
];
const supportedTimeframes = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"] as const;
const maxSpecificSymbols = 500;
const backtestableEngines = getStrategyDefinitions().filter(
  ({ slug }) => !["nfp-news-trading", "carry", "algorithmic-hft", "scalping"].includes(slug),
);

type StrategyForm = {
  name: string;
  category: string;
  description: string;
  shortDescription: string;
  engineSlug: string;
  customRulesJson: string;
  targetSymbols: string[];
};

const emptyForm = (): StrategyForm => ({
  name: "",
  category: "Custom",
  description: "",
  shortDescription: "",
  engineSlug: backtestableEngines[0]?.slug ?? "momentum",
  customRulesJson: JSON.stringify(defaultCustomRules, null, 2),
  targetSymbols: ["*"],
});

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function strategyErrorCode(error: unknown) {
  return error instanceof StrategyServiceError ? error.code : "UNKNOWN_ERROR";
}

function parseCustomRules(value: string) {
  let configuration: unknown;
  try {
    configuration = JSON.parse(value);
  } catch {
    throw new Error("Custom rules must be valid JSON.");
  }
  const parsed = customRulesSchema.safeParse(configuration);
  if (!parsed.success) {
    throw new Error(
      `Invalid custom rules: ${parsed.error.issues[0]?.message ?? "check the schema."}`,
    );
  }
  return parsed.data;
}

function strategyErrorDescription(error: unknown) {
  switch (strategyErrorCode(error)) {
    case "AUTH_REQUIRED":
      return "Sign in to view the Kocel strategy library.";
    case "TABLE_NOT_FOUND":
      return "The strategy table is not available in the configured Supabase project.";
    case "COLUMN_NOT_FOUND":
      return "The strategy database schema is incomplete. Apply the strategy library migration.";
    case "RLS_DENIED":
      return "Your account is not permitted to read the active strategy definitions.";
    case "SUPABASE_CONNECTION_ERROR":
      return "The Supabase project could not be reached. Try again shortly.";
    default:
      return "The strategy library could not be loaded. Try again shortly.";
  }
}

function StrategyDetails({
  strategy,
  onBacktest,
}: {
  strategy: Strategy | null;
  onBacktest: () => void;
}) {
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      {strategy && (
        <>
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>{strategy.name}</DialogTitle>
              <StatusBadge tone="info" size="sm">
                {strategy.category}
              </StatusBadge>
            </div>
            <DialogDescription>{strategy.short_description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <section>
              <h3 className="font-semibold text-foreground">Definition</h3>
              <p className="mt-1.5 leading-6 text-muted-foreground">{strategy.description}</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">Runtime configuration</h3>
              <p className="mt-1.5 leading-6 text-muted-foreground">
                This strategy uses Kocel’s supported runtime evaluator. The Bridge EA receives and
                executes validated trade commands; custom text is not compiled into an MQL5 program.
              </p>
            </section>
            <Button onClick={onBacktest}>Backtest strategy</Button>
          </div>
        </>
      )}
    </DialogContent>
  );
}

function StrategiesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { active } = useConnections();
  const strategiesQuery = useQuery({ queryKey: ["strategies"], queryFn: getStrategies });
  const symbolsQuery = useQuery({
    queryKey: ["market-symbols", active?.id],
    queryFn: () => getMarketSymbols({ data: { connectionId: active!.id } }),
    enabled: Boolean(active?.id),
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Strategy | null>(null);
  const [form, setForm] = useState<StrategyForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredStrategies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (strategiesQuery.data ?? []).filter((strategy) => {
      const matchesCategory = category === "All" || strategy.category === category;
      const searchableText = [
        strategy.name,
        strategy.category,
        strategy.description,
        strategy.short_description,
      ]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [category, search, strategiesQuery.data]);
  const categories = useMemo(
    () =>
      [
        ...new Set([
          ...categoryOptions,
          ...(strategiesQuery.data ?? []).map((item) => item.category),
        ]),
      ].sort((left, right) => left.localeCompare(right)),
    [strategiesQuery.data],
  );

  const refreshStrategies = async () => {
    await queryClient.invalidateQueries({ queryKey: ["strategies"] });
  };
  const saveMutation = useMutation({
    mutationFn: async () => {
      const customRules =
        form.engineSlug === "custom-rules" ? parseCustomRules(form.customRulesJson) : undefined;
      if (editingStrategy) {
        await updateStrategy({
          data: {
            strategyId: editingStrategy.id,
            name: form.name,
            category: form.category,
            description: form.description,
            shortDescription: form.shortDescription,
            engineSlug: form.engineSlug,
            ...(customRules ? { customRules } : {}),
            targetSymbols: form.targetSymbols,
          },
        });
        return;
      }
      await createStrategy({
        data: {
          name: form.name,
          category: form.category,
          description: form.description,
          shortDescription: form.shortDescription,
          engineSlug: form.engineSlug,
          ...(customRules ? { customRules } : {}),
          targetSymbols: form.targetSymbols,
          timeframes: [...supportedTimeframes],
          markets: ["account_symbols"],
        },
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditingStrategy(null);
      toast.success(editingStrategy ? "Strategy updated." : "Strategy created.");
      await refreshStrategies();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (strategy: Strategy) => deleteStrategy({ data: { strategyId: strategy.id } }),
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success("Strategy removed from your library.");
      await refreshStrategies();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openCreate() {
    setEditingStrategy(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(strategy: Strategy) {
    const configuration = strategy.configuration ?? {};
    setEditingStrategy(strategy);
    setForm({
      name: strategy.name,
      category: strategy.category,
      description: strategy.description,
      shortDescription: strategy.short_description,
      engineSlug:
        typeof configuration["runtimeStrategySlug"] === "string"
          ? configuration["runtimeStrategySlug"]
          : strategy.slug,
      customRulesJson: JSON.stringify(configuration["customRules"] ?? defaultCustomRules, null, 2),
      targetSymbols: stringArray(configuration["targetSymbols"]).length
        ? stringArray(configuration["targetSymbols"])
        : ["*"],
    });
    setDialogOpen(true);
  }

  function openBacktest(strategy: Strategy) {
    const targets = stringArray(strategy.configuration?.["targetSymbols"]);
    const symbol = targets.length === 1 && targets[0] !== "*" ? targets[0] : undefined;
    navigate({
      to: "/backtest",
      search: { strategyId: strategy.id, ...(symbol ? { symbol } : {}) },
    });
  }

  function toggleSymbol(symbol: string, checked: boolean) {
    setForm((current) => {
      if (symbol === "*") return { ...current, targetSymbols: checked ? ["*"] : [] };
      const selected = current.targetSymbols.includes("*")
        ? (symbolsQuery.data?.map((item) => item.symbol) ?? [])
        : current.targetSymbols;
      if (current.targetSymbols.includes("*") && selected.length > maxSpecificSymbols) {
        toast.info(
          `This account has more than ${maxSpecificSymbols} symbols. Turn off “All account symbols” before selecting a specific subset.`,
        );
        return current;
      }
      const next = checked
        ? [...new Set([...selected, symbol])]
        : selected.filter((item) => item !== symbol);
      if (next.length > maxSpecificSymbols) {
        toast.info(
          `Select up to ${maxSpecificSymbols} specific symbols, or use all account symbols.`,
        );
        return current;
      }
      return { ...current, targetSymbols: next };
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Strategies"
        description="Build and manage reusable strategy configurations for your MT5 bots and historical tests."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            New strategy
          </Button>
        }
      />

      {strategiesQuery.isLoading ? (
        <CardsSkeleton count={6} />
      ) : strategiesQuery.isError ? (
        <div className="panel">
          <ErrorState
            description={strategyErrorDescription(strategiesQuery.error)}
            errorCode={strategyErrorCode(strategiesQuery.error)}
            onRetry={() => void strategiesQuery.refetch()}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search strategies"
                className="pl-9"
                placeholder="Search strategies"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="sm:w-60">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {["All", ...categories].map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredStrategies.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon={Search}
                title="No matching strategies"
                description="Try a different search or create a strategy of your own."
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredStrategies.map((strategy) => (
                <article key={strategy.id} className="panel flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{strategy.name}</h2>
                    <StatusBadge tone="info" size="sm">
                      {strategy.category}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground/80">
                    {strategy.short_description}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {strategy.description}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedStrategy(strategy)}
                    >
                      <BookOpen className="mr-2 size-4" />
                      View definition
                    </Button>
                    <Button size="sm" onClick={() => openBacktest(strategy)}>
                      Backtest
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${strategy.name}`}
                      onClick={() => openEdit(strategy)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${strategy.name}`}
                      onClick={() => setDeleteTarget(strategy)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingStrategy(null);
            saveMutation.reset();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStrategy ? "Edit strategy" : "Create strategy"}</DialogTitle>
            <DialogDescription>
              Choose a supported Kocel runtime so the strategy can be analyzed by bots and replayed
              by Backtest. The custom-rules runtime is a validated declarative ruleset; it is
              interpreted by the same engine for live bot analysis and historical tests. The EA
              receives validated trade commands, never executable strategy code.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.targetSymbols.length) {
                toast.error("Choose at least one symbol or enable all account symbols.");
                return;
              }
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="strategy-name">Name</Label>
                <Input
                  id="strategy-name"
                  value={form.name}
                  maxLength={80}
                  required
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm({ ...form, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Runtime engine</Label>
              <Select
                value={form.engineSlug}
                onValueChange={(value) => setForm({ ...form, engineSlug: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a supported strategy engine" />
                </SelectTrigger>
                <SelectContent>
                  {backtestableEngines.map((engine) => (
                    <SelectItem key={engine.slug} value={engine.slug}>
                      {engine.slug === "custom-rules" ? "Custom rules (version 1)" : engine.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.engineSlug === "custom-rules" && (
              <div className="space-y-1.5">
                <Label htmlFor="strategy-custom-rules">Custom runtime rules (JSON)</Label>
                <Textarea
                  id="strategy-custom-rules"
                  value={form.customRulesJson}
                  maxLength={4000}
                  rows={12}
                  spellCheck={false}
                  onChange={(event) => setForm({ ...form, customRulesJson: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Each side requires 1–8 conditions. Compare a supported indicator to another
                  indicator or a number. Example:{" "}
                  <code>{'{"left":"rsi14","operator":"gt","right":55}'}</code>. Stop and target
                  levels use ATR multiples.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="strategy-summary">Short description</Label>
              <Input
                id="strategy-summary"
                value={form.shortDescription}
                maxLength={240}
                onChange={(event) => setForm({ ...form, shortDescription: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="strategy-description">Definition and notes</Label>
              <Textarea
                id="strategy-description"
                value={form.description}
                maxLength={4000}
                rows={4}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Symbols</legend>
              <p className="text-xs text-muted-foreground">
                Select specific symbols from this account’s Market Watch or allow all of them.
              </p>
              <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.targetSymbols.includes("*")}
                    onCheckedChange={(checked) => toggleSymbol("*", checked === true)}
                  />
                  All account symbols
                </label>
                {symbolsQuery.data?.map((item) => (
                  <label key={item.symbol} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={
                        form.targetSymbols.includes("*") || form.targetSymbols.includes(item.symbol)
                      }
                      onCheckedChange={(checked) => toggleSymbol(item.symbol, checked === true)}
                    />
                    <span className="truncate">{item.symbol}</span>
                  </label>
                ))}
                {!symbolsQuery.isLoading && !symbolsQuery.data?.length && (
                  <p className="text-xs text-muted-foreground">
                    Connect the Bridge EA to populate account symbols. All symbols remains
                    available.
                  </p>
                )}
              </div>
            </fieldset>
            <Button type="submit" disabled={saveMutation.isPending || !form.name.trim()}>
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingStrategy ? "Save strategy" : "Create strategy"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedStrategy !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStrategy(null);
        }}
      >
        <StrategyDetails
          strategy={selectedStrategy}
          onBacktest={() => selectedStrategy && openBacktest(selectedStrategy)}
        />
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this strategy?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.is_builtin
                ? "This hides the built-in strategy from your library only; it does not affect other users or existing bots."
                : "This permanently deletes your strategy. Strategies used by bots or analysis history cannot be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
