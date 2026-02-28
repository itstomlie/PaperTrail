"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  RESOURCE_TYPES,
  TYPE_META,
  type ResourceType,
} from "@/lib/resource-types";

interface SearchResult {
  resources: Array<{
    id: string;
    resourceType: string;
    title: string;
    url: string | null;
    typeFields: string;
    tags: { tag: { id: string; name: string; color: string | null } }[];
  }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
    _count: { resources: number };
  }>;
}

export function SearchClient() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const router = useRouter();

  const [query, setQuery] = React.useState(initialQ);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [results, setResults] = React.useState<SearchResult | null>(null);
  const [loading, setLoading] = React.useState(false);

  const doSearch = React.useCallback(async (q: string, type: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ q: q.trim() });
    if (type !== "all") params.set("resourceType", type);
    const res = await fetch(`/api/search?${params}`);
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (initialQ) doSearch(initialQ, typeFilter);
  }, [initialQ, doSearch, typeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, typeFilter);
    router.replace(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="mt-1 text-muted-foreground">
          Search across all resources, projects, and tags
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {/* Type filter */}
      <Tabs
        value={typeFilter}
        onValueChange={(v) => {
          setTypeFilter(v);
          doSearch(query, v);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All Types</TabsTrigger>
          {RESOURCE_TYPES.map((t) => {
            const m = TYPE_META[t];
            return (
              <TabsTrigger key={t} value={t} className="gap-1.5">
                <m.icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                {m.pluralLabel}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {results && (
        <div className="space-y-6">
          {/* Resources */}
          {results.resources.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Resources ({results.resources.length})
              </h2>
              <div className="space-y-2">
                {results.resources.map((r) => {
                  const meta = TYPE_META[r.resourceType as ResourceType];
                  const tf = JSON.parse(r.typeFields || "{}");
                  return (
                    <Link key={r.id} href={`/resources/${r.id}`}>
                      <Card className="transition-colors hover:bg-accent/50">
                        <CardContent className="flex items-center gap-3 py-3">
                          {meta && (
                            <meta.icon
                              className="h-4 w-4 shrink-0"
                              style={{ color: meta.color }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {r.title}
                            </p>
                            {tf.authors && (
                              <p className="truncate text-xs text-muted-foreground">
                                {tf.authors}
                                {tf.year ? ` · ${tf.year}` : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {r.tags.map(({ tag }) => (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                className="text-xs"
                                style={
                                  tag.color
                                    ? {
                                        borderColor: tag.color,
                                        color: tag.color,
                                      }
                                    : undefined
                                }
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projects */}
          {results.projects.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Projects ({results.projects.length})
              </h2>
              <div className="space-y-2">
                {results.projects.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`}>
                    <Card className="transition-colors hover:bg-accent/50">
                      <CardContent className="py-3">
                        <p className="text-sm font-medium">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground">
                            {p.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {results.tags.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Tags ({results.tags.length})
              </h2>
              <div className="flex flex-wrap gap-2">
                {results.tags.map((t) => (
                  <Badge
                    key={t.id}
                    variant="outline"
                    className="text-sm"
                    style={
                      t.color
                        ? { borderColor: t.color, color: t.color }
                        : undefined
                    }
                  >
                    {t.name} ({t._count.resources})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {results.resources.length === 0 &&
            results.projects.length === 0 &&
            results.tags.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}
        </div>
      )}
    </div>
  );
}
