import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { tauriConnections, tauriSystem } from "../../lib/tauri";
import { useComposioRefetchOnReturn } from "../../hooks/use-composio-refetch-on-return";
import { AppCard, fallbackLogo } from "./browse-app-card";

interface BrowseAppsSectionProps {
  connectedToolkits: Set<string>;
}

const PAGE_SIZE = 100;

export function BrowseAppsSection({ connectedToolkits }: BrowseAppsSectionProps) {
  const { t } = useTranslation("integrations");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [connecting, setConnecting] = useState<string | null>(null);
  const markWaitingForAuth = useComposioRefetchOnReturn();

  const { data: apiApps } = useQuery({
    queryKey: ["composio-apps"],
    queryFn: () => tauriConnections.listApps(),
    staleTime: 1000 * 60 * 60,
  });

  const catalog = useMemo(() => {
    if (!apiApps || apiApps.length === 0) return [];
    return apiApps.map((a) => ({
      toolkit: a.toolkit,
      name: a.name,
      description: a.description,
      logoUrl: a.logo_url || fallbackLogo(a.toolkit),
      categories: a.categories ?? [],
    }));
  }, [apiApps]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const app of catalog) {
      for (const cat of app.categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [catalog]);

  const available = useMemo(() => {
    let filtered = catalog.filter(
      (app) => !connectedToolkits.has(app.toolkit),
    );
    if (category !== "all") {
      filtered = filtered.filter((app) =>
        app.categories.includes(category),
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [catalog, connectedToolkits, category, search]);

  const isSearching = search.trim().length > 0;
  const visibleApps = isSearching ? available : available.slice(0, visible);
  const hasMore = !isSearching && visible < available.length;

  const handleConnect = useCallback(
    async (toolkit: string) => {
      setConnecting(toolkit);
      try {
        const { redirect_url } = await tauriConnections.connectApp(toolkit);
        tauriSystem.openUrl(redirect_url);
        markWaitingForAuth(toolkit);
      } catch {
        // Error already shown via invoke toast
      } finally {
        setConnecting(null);
      }
    },
    [markWaitingForAuth],
  );

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">
          {t("browse.title")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("browse.count", { count: available.length })}
        </span>
      </div>

      {/* Search + Category filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("browse.searchPlaceholder")}
            className="w-full h-9 pl-9 pr-3 rounded-full border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
        </div>
        {categories.length > 0 && (
          <div className="relative">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              className="h-9 pl-3 pr-8 rounded-full border border-border bg-background text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="all">{t("browse.allCategories")}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, " ")}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Grid */}
      {available.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t("browse.noResults")}
        </p>
      )}
      {available.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleApps.map((app) => (
              <AppCard
                key={app.toolkit}
                app={app}
                connecting={connecting === app.toolkit}
                onConnect={handleConnect}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="inline-flex items-center gap-1 h-8 px-4 rounded-full border border-border bg-background text-foreground text-xs font-medium hover:bg-secondary transition-colors duration-200"
              >
                {t("browse.loadMoreWithRemaining", { count: available.length - visible })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

