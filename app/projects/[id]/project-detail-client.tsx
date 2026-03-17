"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AddResourceSheet } from "@/components/add-resource-sheet";
import { KanbanBoardView } from "@/components/resource-views/kanban-board-view";
import { SummaryFeedView } from "@/components/resource-views/summary-feed-view";
import {
  Plus,
  ArrowUpDown,
  Settings,
  Search,
  LayoutGrid,
  List,
  Columns3,
  LayoutList,
  ExternalLink,
  BookOpen,
  Users,
  Calendar,
  Link2,
  Download,
  Loader2,
  Star,
  ChevronDown,
  Copy,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  RESOURCE_TYPES,
  TYPE_META,
  type ResourceType,
  getTypeFields,
} from "@/lib/resource-types";

// ─── Column definitions ──────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "starred", label: "Fav", defaultVisible: true },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "type", label: "Type", defaultVisible: true },
  { key: "title", label: "Title", defaultVisible: true },
  { key: "details", label: "Details", defaultVisible: true },
  { key: "tags", label: "Tags", defaultVisible: true },
  { key: "added", label: "Added", defaultVisible: true },
  { key: "notes", label: "Notes", defaultVisible: false },
  { key: "url", label: "Page URL", defaultVisible: false },
];

const STORAGE_KEY = "papertrail-visible-columns";

function loadVisibleColumns(): Set<string> {
  if (typeof window === "undefined") {
    return new Set(
      ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
    );
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
}

// ─── Types ────────────────────────────────────────────────────────

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface ResourceItem {
  id: string;
  resourceType: string;
  title: string;
  url: string | null;
  notes?: string | null;
  typeFields: string;
  tags: Tag[];
  customFields: Record<string, unknown>;
  createdAt: string | Date;
  status: string;
  starred?: boolean;
}

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    customFieldTemplates: {
      key: string;
      name: string;
      label: string;
      type: string;
      options?: string[];
    }[];
    citationStyle: string;
    _count: { resources: number };
  };
  resources: ResourceItem[];
  allTags: Tag[];
}

// ─── Component ────────────────────────────────────────────────────

export function ProjectDetailClient({ project, resources, allTags }: Props) {
  const router = useRouter();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("createdAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = React.useState<"table" | "board" | "split" | "summary">(() => {
    if (typeof window === "undefined") return "table";
    return (
      (localStorage.getItem("papertrail-view-mode") as "table" | "board" | "split" | "summary") ||
      "table"
    );
  });
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() =>
    loadVisibleColumns(),
  );
  const [selectedResource, setSelectedResource] =
    React.useState<ResourceItem | null>(null);
  const [showAddSheet, setShowAddSheet] = React.useState(false);

  // Status tracking
  const [statusMap, setStatusMap] = React.useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    resources.forEach((r) => {
      map[r.id] = r.status || "backlog";
    });
    return map;
  });

  const updateStatus = async (resourceId: string, newStatus: string) => {
    const oldStatus = statusMap[resourceId];
    if (oldStatus === newStatus) return;
    setStatusMap((prev) => ({ ...prev, [resourceId]: newStatus }));
    try {
      const res = await fetch("/api/project-resources/update-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          resourceId,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        setStatusMap((prev) => ({ ...prev, [resourceId]: oldStatus }));
        toast.error("Failed to update status");
      }
    } catch {
      setStatusMap((prev) => ({ ...prev, [resourceId]: oldStatus }));
      toast.error("Failed to update status");
    }
  };

  // Starred status tracking
  const [starredMap, setStarredMap] = React.useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {};
      resources.forEach((r) => {
        map[r.id] = r.starred ?? false;
      });
      return map;
    },
  );

  const toggleStarred = async (resourceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !starredMap[resourceId];
    setStarredMap((prev) => ({ ...prev, [resourceId]: newVal }));
    try {
      const res = await fetch("/api/project-resources/toggle-starred", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          resourceId,
          starred: newVal,
        }),
      });
      if (!res.ok) {
        setStarredMap((prev) => ({ ...prev, [resourceId]: !newVal }));
        toast.error("Failed to toggle favorite status");
      }
    } catch {
      setStarredMap((prev) => ({ ...prev, [resourceId]: !newVal }));
      toast.error("Failed to toggle favorite status");
    }
  };

  // Persist view mode
  const handleViewMode = (mode: "table" | "board" | "split" | "summary") => {
    setViewMode(mode);
    localStorage.setItem("papertrail-view-mode", mode);
  };

  // Global paste listener for quick import
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Skip if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      // Check if it looks like a URL, DOI, or arXiv ID
      if (
        text.startsWith("http://") ||
        text.startsWith("https://") ||
        text.startsWith("10.") ||
        text.match(/^\d{4}\.\d{4,5}/)
      ) {
        e.preventDefault();
        setShowAddSheet(true);
        // Small delay to let sheet open, then dispatch a custom event
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("papertrail-paste-import", { detail: text }),
          );
        }, 100);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Persist column choices
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Count per type
  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    resources.forEach((r) => {
      counts[r.resourceType] = (counts[r.resourceType] || 0) + 1;
    });
    return counts;
  }, [resources]);

  // Filtered & sorted
  const filteredResources = React.useMemo(() => {
    let result = [...resources];
    if (typeFilter !== "all")
      result = result.filter((r) => r.resourceType === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => {
        const tf = getTypeFields<Record<string, unknown>>(r.typeFields);
        return (
          r.title.toLowerCase().includes(q) ||
          String(tf.authors || "")
            .toLowerCase()
            .includes(q)
        );
      });
    }
    result.sort((a, b) => {
      // Always put starred items first unless we're explicitly sorting by starred (which does it natively)
      if (sortField !== "starred" && starredMap[a.id] !== starredMap[b.id]) {
        return starredMap[a.id] ? -1 : 1;
      }

      const tfA = getTypeFields<Record<string, unknown>>(a.typeFields);
      const tfB = getTypeFields<Record<string, unknown>>(b.typeFields);
      let cmp = 0;
      switch (sortField) {
        case "starred":
          cmp = (starredMap[a.id] ? 1 : 0) - (starredMap[b.id] ? 1 : 0);
          break;
        case "status":
          cmp = (statusMap[a.id] || "backlog").localeCompare(statusMap[b.id] || "backlog");
          break;
        case "type":
          cmp = a.resourceType.localeCompare(b.resourceType);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "details": {
          const dA = String(tfA.authors || tfA.siteName || tfA.format || "");
          const dB = String(tfB.authors || tfB.siteName || tfB.format || "");
          cmp = dA.localeCompare(dB);
          break;
        }
        case "tags":
          cmp = a.tags.length - b.tags.length;
          break;
        case "notes":
          cmp = (a.notes || "").localeCompare(b.notes || "");
          break;
        case "url":
          cmp = (a.url || "").localeCompare(b.url || "");
          break;
        case "added":
        default:
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [resources, typeFilter, search, sortField, sortDir, statusMap, starredMap]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-2 h-8"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown
        className={`h-3 w-3 ${sortField === field ? "text-foreground" : "text-muted-foreground/50"}`}
      />
    </Button>
  );

  const isCol = (key: string) => visibleColumns.has(key);

  if (!isMounted) {
    return null;
  }

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    try {
      const res = await fetch(`/api/resources/${resourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Resource deleted");
        setSelectedResource(null);
        router.refresh();
      } else {
        toast.error("Failed to delete resource");
      }
    } catch {
      toast.error("Failed to delete resource");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
          <Badge variant="secondary" className="mt-2">
            {project._count.resources}{" "}
            {project._count.resources === 1 ? "resource" : "resources"}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowAddSheet(true)}
          >
            <Plus className="h-4 w-4" />
            Add Resource
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              const { utils, writeFile } = await import("xlsx");
              // Collect all custom field keys across resources
              const allCfKeys = new Set<string>();
              resources.forEach((r) => {
                Object.keys(r.customFields || {}).forEach((k) =>
                  allCfKeys.add(k),
                );
              });
              const cfKeysArr = [...allCfKeys];

              const rows = resources.map((r) => {
                const tf = getTypeFields<Record<string, unknown>>(r.typeFields);
                const row: Record<string, unknown> = {
                  Title: r.title,
                  Type:
                    TYPE_META[r.resourceType as ResourceType]?.label ||
                    r.resourceType,
                  URL: r.url || "",
                  Authors: tf.authors || "",
                  Year: tf.year || "",
                  Tags: r.tags.map((t) => t.name).join(", "),
                  Notes: r.notes || "",
                  Added: new Date(r.createdAt).toLocaleDateString(),
                };
                // Add custom fields as columns
                cfKeysArr.forEach((k) => {
                  row[k] =
                    r.customFields?.[k] != null
                      ? String(r.customFields[k])
                      : "";
                });
                return row;
              });

              const ws = utils.json_to_sheet(rows);
              const wb = utils.book_new();
              utils.book_append_sheet(wb, ws, "Resources");
              writeFile(wb, `${project.name} - Resources.xlsx`);
              toast.success("Exported to Excel");
            }}
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Link href={`/projects/${project.id}/settings`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature 4: Type Filter Button Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={typeFilter === "all" ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setTypeFilter("all")}
        >
          All ({resources.length})
        </Button>
        {RESOURCE_TYPES.filter((t) => typeCounts[t]).map((t) => {
          const m = TYPE_META[t];
          const active = typeFilter === t;
          return (
            <Button
              key={t}
              variant={active ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTypeFilter(t)}
            >
              <m.icon
                className="h-3.5 w-3.5"
                style={active ? undefined : { color: m.color }}
              />
              {m.pluralLabel} ({typeCounts[t]})
            </Button>
          );
        })}
      </div>

      {/* Toolbar: Search + View Toggle + Columns */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="pl-9"
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-md border">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-none rounded-l-md"
            onClick={() => handleViewMode("table")}
            title="Table View"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "board" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-none"
            onClick={() => handleViewMode("board")}
            title="Kanban Board View"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-none"
            onClick={() => handleViewMode("split")}
            title="Split Reader View"
          >
            <Columns3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "summary" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-none rounded-r-md"
            onClick={() => handleViewMode("summary")}
            title="Summary Feed View"
          >
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>

        {/* Sort dropdown for clear visibility in non-table views */}
        {viewMode !== "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowUpDown className="h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[
                { key: "added", label: "Added Date" },
                { key: "title", label: "Title" },
                { key: "type", label: "Resource Type" },
                { key: "status", label: "Status" },
              ].map((opt) => (
                <DropdownMenuCheckboxItem
                  key={opt.key}
                  checked={sortField === opt.key}
                  onCheckedChange={() => toggleSort(opt.key)}
                  className="flex justify-between"
                >
                  <span>{opt.label}</span>
                  {sortField === opt.key && (
                    <span className="text-xs text-muted-foreground ml-4">
                      {sortDir === "asc" ? "Asc" : "Desc"}
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Column visibility dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Columns3 className="h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_COLUMNS.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleColumns.has(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content: Table or Gallery */}
      {filteredResources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              No resources match your filters
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
        /* ──── Table View ──── */
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {isCol("starred") && (
                  <TableHead className="w-10">
                    <SortHeader field="starred" label="" />
                  </TableHead>
                )}
                {isCol("status") && (
                  <TableHead className="w-28 text-center">
                    <SortHeader field="status" label="Status" />
                  </TableHead>
                )}
                {isCol("type") && (
                  <TableHead className="w-8">
                    <SortHeader field="type" label="Type" />
                  </TableHead>
                )}
                {isCol("title") && (
                  <TableHead>
                    <SortHeader field="title" label="Title" />
                  </TableHead>
                )}
                {isCol("details") && (
                  <TableHead>
                    <SortHeader field="details" label="Details" />
                  </TableHead>
                )}
                {isCol("tags") && (
                  <TableHead>
                    <SortHeader field="tags" label="Tags" />
                  </TableHead>
                )}
                {isCol("notes") && (
                  <TableHead>
                    <SortHeader field="notes" label="Notes" />
                  </TableHead>
                )}
                {isCol("url") && (
                  <TableHead>
                    <SortHeader field="url" label="Page URL" />
                  </TableHead>
                )}
                {isCol("added") && (
                  <TableHead>
                    <SortHeader field="added" label="Added" />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((resource) => {
                const m = TYPE_META[resource.resourceType as ResourceType];
                const tf = getTypeFields<Record<string, unknown>>(
                  resource.typeFields,
                );
                const details = tf.authors
                  ? `${tf.authors}${tf.year ? ` · ${tf.year}` : ""}`
                  : tf.siteName || tf.format || "";

                return (
                  <TableRow
                    key={resource.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedResource(resource)}
                  >
                    {isCol("starred") && (
                      <TableCell>
                        <button
                          onClick={(e) => toggleStarred(resource.id, e)}
                          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-yellow-500 transition-colors"
                        >
                          <Star
                            className="h-4 w-4"
                            fill={
                              starredMap[resource.id]
                                ? "rgb(234 179 8)"
                                : "none"
                            }
                            color={
                              starredMap[resource.id]
                                ? "rgb(234 179 8)"
                                : "currentColor"
                            }
                          />
                        </button>
                      </TableCell>
                    )}
                    {isCol("status") && (
                      <TableCell align="center">
                        <Badge
                          variant={statusMap[resource.id] === 'core' ? 'default' : 'secondary'}
                          className="capitalize cursor-pointer w-[90px] justify-center text-center font-medium shadow-none hover:opacity-80"
                          title="Click to change status"
                          onClick={(e) => {
                             e.stopPropagation();
                             const current = statusMap[resource.id] || "backlog";
                             const next = current === 'backlog' ? 'reading' : current === 'reading' ? 'core' : current === 'core' ? 'archived' : 'backlog';
                             updateStatus(resource.id, next);
                          }}
                        >
                          {statusMap[resource.id] || "backlog"}
                        </Badge>
                      </TableCell>
                    )}
                    {isCol("type") && (
                      <TableCell>
                        {m && (
                          <m.icon
                            className="h-4 w-4"
                            style={{ color: m.color }}
                          />
                        )}
                      </TableCell>
                    )}
                    {isCol("title") && (
                      <TableCell className="font-medium max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{resource.title}</span>
                          {resource.url && (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener"
                              className="text-muted-foreground hover:text-blue-500 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                              title="Open page"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isCol("details") && (
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {String(details)}
                      </TableCell>
                    )}
                    {isCol("tags") && (
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {resource.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="text-xs"
                              style={
                                tag.color
                                  ? { borderColor: tag.color, color: tag.color }
                                  : undefined
                              }
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    )}
                    {isCol("notes") && (
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {resource.notes
                          ? resource.notes.slice(0, 80) +
                            (resource.notes.length > 80 ? "…" : "")
                          : "—"}
                      </TableCell>
                    )}
                    {isCol("url") && (
                      <TableCell className="text-sm max-w-[180px] truncate">
                        {resource.url ? (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener"
                            className="text-blue-500 hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {new URL(resource.url).hostname}
                            </span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isCol("added") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(resource.createdAt).toLocaleDateString()}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : viewMode === "board" ? (
        <KanbanBoardView
          resources={filteredResources.map(r => ({...r, status: statusMap[r.id] || "backlog"}))}
          onStatusChange={updateStatus}
          onResourceClick={setSelectedResource}
        />
      ) : viewMode === "summary" ? (
        <SummaryFeedView
          resources={filteredResources.map(r => ({...r, status: statusMap[r.id] || "backlog"}))}
          onResourceClick={setSelectedResource}
        />
      ) : viewMode === "split" ? (
        <div className="flex gap-6 h-[calc(100vh-12rem)] min-h-[600px] border rounded-lg overflow-hidden relative shadow-sm">
          {/* Left Pane - List */}
          <div className="w-1/3 min-w-[320px] max-w-[400px] border-r overflow-y-auto bg-muted/20 p-4 space-y-3">
            {filteredResources.map(r => {
                const m = TYPE_META[r.resourceType as ResourceType];
                const active = selectedResource?.id === r.id;
                const rStatus = statusMap[r.id] || "backlog";
                const isCore = rStatus === "core";
                
                return (
                  <div 
                    key={r.id} 
                    onClick={() => setSelectedResource(r)}
                    className={`p-3.5 rounded-xl cursor-pointer border shadow-sm transition-all ${active ? 'bg-primary/5 border-primary shadow-md ring-1 ring-primary/20' : 'bg-background hover:border-primary/40'}`}
                  >
                    <div className="font-semibold text-sm leading-snug line-clamp-2">{r.title}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs">
                      {m && <div className="flex items-center gap-1 font-medium" style={{color: m.color}}><m.icon className="h-3.5 w-3.5" />{m.label}</div>}
                      <span className="text-muted-foreground/30">•</span>
                      <Badge 
                        variant={isCore ? 'default' : 'secondary'} 
                        className={`capitalize text-[10px] h-4 px-1.5 cursor-pointer hover:opacity-80 transition-opacity ${isCore ? '' : 'bg-muted border-none text-muted-foreground'}`}
                        title="Click to change status"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = rStatus === 'backlog' ? 'reading' : rStatus === 'reading' ? 'core' : rStatus === 'core' ? 'archived' : 'backlog';
                          updateStatus(r.id, next);
                        }}
                      >
                        {rStatus}
                      </Badge>
                      {starredMap[r.id] && (
                        <>
                          <span className="text-muted-foreground/30">•</span>
                          <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
                        </>
                      )}
                    </div>
                  </div>
                )
            })}
            {filteredResources.length === 0 && (
              <div className="text-center text-sm text-muted-foreground p-8">No resources match your filters</div>
            )}
          </div>
          {/* Right Pane - Detail */}
          <div className="flex-1 overflow-y-auto bg-background relative border-l shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
             {selectedResource ? (
                <div className="p-8 max-w-3xl mx-auto pb-24">
                   {selectedResource.resourceType === "image" && (() => {
                     const tf = getTypeFields<Record<string, unknown>>(selectedResource.typeFields);
                     return tf.imageUrl ? (
                       <div className="mb-8 overflow-hidden rounded-lg border bg-muted">
                         <img 
                           src={String(tf.imageUrl)} 
                           alt={String(tf.altText || selectedResource.title)} 
                           className="w-full object-contain max-h-[400px]"
                         />
                       </div>
                     ) : null;
                   })()}
                   <ResourceSidebar
                    resource={selectedResource}
                    project={project}
                    citationStyle={project.citationStyle}
                    onNavigate={() => {
                      router.push(`/resources/${selectedResource.id}`);
                      setSelectedResource(null);
                    }}
                    onUpdate={async (id, updates) => {
                      setSelectedResource((prev) => prev && prev.id === id ? { ...prev, ...updates } : prev);
                      try {
                        const res = await fetch(`/api/resources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
                        if (!res.ok) throw new Error();
                        router.refresh();
                      } catch {
                        toast.error("Failed to save changes");
                        router.refresh();
                      }
                    }}
                    onDelete={handleDeleteResource}
                   />
                </div>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 bg-muted/5">
                   <BookOpen className="h-16 w-16 opacity-10 mb-6" />
                   <p className="font-medium text-lg text-foreground/70">No resource selected</p>
                   <p className="text-sm mt-1 max-w-xs text-center">Select a resource from the list on the left to view its details, fields, and take notes.</p>
                </div>
             )}
          </div>
        </div>
      ) : null}

      {/* ──── Resource Detail Sidebar (Sheet) ──── */}
      <Sheet
        open={!!selectedResource && viewMode !== "split"}
        onOpenChange={(open) => {
          if (!open) setSelectedResource(null);
        }}
      >
        <SheetContent
          side="right"
          className="sm:max-w-lg w-full overflow-y-auto"
        >
          {selectedResource && (
            <>
              <SheetTitle className="sr-only">{selectedResource.title}</SheetTitle>
              <SheetDescription className="sr-only">Resource details for {selectedResource.title}</SheetDescription>
              <ResourceSidebar
                resource={selectedResource}
              project={project}
              citationStyle={project.citationStyle}
              onNavigate={() => {
                router.push(`/resources/${selectedResource.id}`);
                setSelectedResource(null);
              }}
              onUpdate={async (id, updates) => {
                // Optimistic update
                setSelectedResource((prev) =>
                  prev && prev.id === id ? { ...prev, ...updates } : prev,
                );
                // Also update the resource in the main list (so table/gallery updates immediately)
                // Wait, we can't easily update `resources` prop, but calling router.refresh() will fetch new data.
                try {
                  const res = await fetch(`/api/resources/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates),
                  });
                  if (!res.ok) throw new Error();
                  router.refresh();
                } catch {
                  toast.error("Failed to save changes");
                  router.refresh(); // Revert optimistic update
                }
              }}
              onDelete={handleDeleteResource}
            />
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Resource Sheet */}
      <AddResourceSheet
        projectId={project.id}
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onResourceAdded={() => router.refresh()}
        customFieldTemplates={project.customFieldTemplates}
      />
    </div>
  );
}

// ─── Sidebar Component ────────────────────────────────────────────

function ResourceSidebar({
  resource,
  onNavigate,
  project,
  citationStyle,
  onUpdate,
  onDelete,
}: {
  resource: ResourceItem;
  onNavigate: () => void;
  project: Props["project"];
  citationStyle: string;
  onUpdate: (id: string, updates: Partial<ResourceItem>) => void;
  onDelete: (id: string) => void;
}) {
  const m = TYPE_META[resource.resourceType as ResourceType];
  const tf = getTypeFields<Record<string, unknown>>(resource.typeFields);
  const customFields = resource.customFields || {};

  // Dynamic field visibility
  const SIDEBAR_FIELDS_KEY = `papertrail-sidebar-fields-${project.id}`;
  const ALL_FIELDS = [
    { id: "authors", label: "Authors" },
    { id: "year", label: "Year" },
    { id: "url", label: "Page URL" },
    { id: "pdfUrl", label: "PDF URL" },
    { id: "abstract", label: "Abstract" },
    { id: "approach", label: "Approach" },
    { id: "keyContributions", label: "Key Contributions" },
    { id: "summary", label: "Summary" },
    { id: "description", label: "Description" },
    { id: "siteName", label: "Site" },
    { id: "publisher", label: "Publisher" },
    { id: "tags", label: "Tags" },
    { id: "customFields", label: "Custom Fields" },
    { id: "notes", label: "Notes" },
  ];

  const [visibleFields, setVisibleFields] = React.useState<Set<string>>(() => {
    if (typeof window === "undefined")
      return new Set(ALL_FIELDS.map((f) => f.id));
    try {
      const stored = localStorage.getItem(SIDEBAR_FIELDS_KEY);
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set(ALL_FIELDS.map((f) => f.id));
  });

  const toggleField = (id: string) => {
    setVisibleFields((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(SIDEBAR_FIELDS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const isField = (id: string) => visibleFields.has(id);

  const handleCite = async (format: string) => {
    try {
      let ref = tf.reference ? String(tf.reference) : null;
      // If no reference, generate one
      if (!ref) {
        toast.info("Generating citation...");
        const genRes = await fetch("/api/ai/generate-citation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: resource.id,
            citationStyle: "bibtex",
          }),
        });
        if (genRes.ok) {
          const data = await genRes.json();
          ref = data.citation;
        } else {
          toast.error("Failed to generate citation");
          return;
        }
      }
      if (!ref) {
        toast.error("No citation available");
        return;
      }
      const { Cite } = await import("@citation-js/core");
      await import("@citation-js/plugin-bibtex");
      await import("@citation-js/plugin-csl");
      const cite = new Cite(ref);
      let output: string;
      if (format === "bibtex") {
        output = cite.format("bibtex");
      } else {
        output = cite.format("bibliography", {
          format: "text",
          template: format,
          lang: "en-US",
        });
      }
      await navigator.clipboard.writeText(output);
      const label =
        format === "bibtex"
          ? "BibTeX"
          : format === "ieee"
            ? "IEEE"
            : format === "apa"
              ? "APA"
              : format.toUpperCase();
      toast.success(`Copied as ${label}`);
    } catch {
      if (tf.reference) {
        await navigator.clipboard.writeText(String(tf.reference));
        toast.success("Copied raw reference");
      } else {
        toast.error("Failed to copy citation");
      }
    }
  };

  return (
    <>
      <SheetHeader className="pb-0">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-muted"
                style={m ? { color: m.color, borderColor: m.color } : undefined}
              >
                {m && <m.icon className="h-3 w-3" />}
                {m?.label ?? resource.resourceType}
                <span className="text-muted-foreground ml-0.5">▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel className="text-xs">
                Change type
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RESOURCE_TYPES.map((rt) => {
                const rm = TYPE_META[rt];
                return (
                  <DropdownMenuCheckboxItem
                    key={rt}
                    checked={resource.resourceType === rt}
                    onCheckedChange={() => {
                      if (rt !== resource.resourceType) {
                        onUpdate(resource.id, { resourceType: rt });
                      }
                    }}
                    className="text-xs gap-1.5"
                  >
                    <rm.icon className="h-3 w-3" style={{ color: rm.color }} />
                    {rm.label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <h2 className="text-lg font-semibold text-foreground leading-tight flex-1">
            {resource.title}
          </h2>
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener"
              className="text-muted-foreground hover:text-blue-500 shrink-0"
              title="Open page"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </SheetHeader>

      <div className="px-4 pb-6 space-y-5">
        {/* Quick actions */}
        <div className="flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={onNavigate}>
            <ExternalLink className="h-3.5 w-3.5" />
            View Full Page
          </Button>
          <Link href={`/resources/${resource.id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              Edit
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive border"
            onClick={() => onDelete(resource.id)}
            title="Delete resource"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <div className="flex ml-auto group">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-r-none border-r-0 focus-visible:z-10"
              onClick={() => handleCite(citationStyle)}
            >
              <Copy className="h-3.5 w-3.5" />
              Cite
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-1.5 rounded-l-none focus-visible:z-10 border-l border-border/50"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => handleCite("bibtex")}>
                  BibTeX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCite("ieee")}>
                  IEEE
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCite("apa")}>
                  APA
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Separator />

        {/* Field visibility toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Details
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 gap-1 text-xs text-muted-foreground"
              >
                <Settings className="h-3 w-3" />
                Fields
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {ALL_FIELDS.map((field) => (
                <DropdownMenuCheckboxItem
                  key={field.id}
                  checked={isField(field.id)}
                  onCheckedChange={() => toggleField(field.id)}
                  className="text-xs"
                >
                  {field.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Metadata fields */}
        <div className="space-y-3">
          {isField("authors") && !!tf.authors && (
            <SidebarField
              icon={<Users className="h-3.5 w-3.5" />}
              label="Authors"
              value={String(tf.authors)}
            />
          )}
          {isField("year") && !!tf.year && (
            <SidebarField
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Year"
              value={String(tf.year)}
            />
          )}
          {isField("url") && resource.url && (
            <SidebarField
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="Page URL"
              value={
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-500 hover:underline text-sm truncate block"
                >
                  {resource.url}
                </a>
              }
            />
          )}
          {isField("pdfUrl") && !!tf.pdfUrl && (
            <SidebarField
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="PDF URL"
              value={
                <a
                  href={String(tf.pdfUrl)}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-500 hover:underline text-sm truncate block"
                >
                  {String(tf.pdfUrl)}
                </a>
              }
            />
          )}
          {isField("abstract") && !!tf.abstract && (
            <SidebarField label="Abstract" value={String(tf.abstract)} />
          )}
          {isField("approach") && !!tf.approach && (
            <SidebarField label="Approach" value={String(tf.approach)} />
          )}
          {isField("keyContributions") && !!tf.keyContributions && (
            <SidebarField
              label="Key Contributions"
              value={String(tf.keyContributions)}
            />
          )}
          {isField("summary") && !!tf.summary && (
            <SidebarField label="Summary" value={String(tf.summary)} />
          )}
          {isField("description") && !!tf.description && (
            <SidebarField label="Description" value={String(tf.description)} />
          )}
          {isField("siteName") && !!tf.siteName && (
            <SidebarField label="Site" value={String(tf.siteName)} />
          )}
          {isField("publisher") && !!tf.publisher && (
            <SidebarField label="Publisher" value={String(tf.publisher)} />
          )}
        </div>

        {/* Tags */}
        {isField("tags") && resource.tags.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Tags
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {resource.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs"
                    style={
                      tag.color
                        ? { borderColor: tag.color, color: tag.color }
                        : undefined
                    }
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Notes preview */}
        {isField("notes") && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Notes
              </p>
              <EditableText
                value={resource.notes || ""}
                onSave={(val) => onUpdate(resource.id, { notes: val })}
                multiline
                placeholder="Click to add notes..."
              />
            </div>
          </>
        )}

        {/* Custom Fields */}
        {isField("customFields") && (
          <>
            <Separator />
            <div>
              <dl className="space-y-1.5">
                {/* Render predefined templates first */}
                {project.customFieldTemplates.map((template) => {
                  const val =
                    customFields[template.key] ??
                    customFields[template.name] ??
                    "";
                  return (
                    <div key={template.key} className="text-sm">
                      <dt className="text-muted-foreground text-xs mb-0.5">
                        {template.label || template.name}
                      </dt>
                      <dd className="font-medium text-foreground/90">
                        <EditableText
                          value={String(val)}
                          onSave={(newVal) => {
                            const newCf = {
                              ...customFields,
                              [template.key]: newVal,
                            };
                            onUpdate(resource.id, { customFields: newCf });
                          }}
                          placeholder={`Click to edit ${template.label || template.name}...`}
                          multiline={template.type === "long_text"}
                        />
                      </dd>
                    </div>
                  );
                })}
                {/* Render any extra custom fields not in templates */}
                {Object.entries(customFields)
                  .filter(
                    ([key]) =>
                      !project.customFieldTemplates.some(
                        (t) => t.key === key || t.name === key,
                      ),
                  )
                  .map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <dt className="text-muted-foreground text-xs mb-0.5">
                        {key}
                      </dt>
                      <dd className="font-medium text-foreground/90">
                        <EditableText
                          value={String(value)}
                          onSave={(newVal) => {
                            const newCf = { ...customFields, [key]: newVal };
                            onUpdate(resource.id, { customFields: newCf });
                          }}
                          placeholder={`Click to edit ${key}...`}
                        />
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          </>
        )}

        {/* Added date */}
        <Separator />
        <SidebarField
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Added"
          value={new Date(resource.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />
      </div>
    </>
  );
}

function SidebarField({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        {icon}
        {label}
      </div>
      {typeof value === "string" ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        value
      )}
    </div>
  );
}

function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder = "Click to edit...",
}: {
  value: string;
  onSave: (val: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentValue, setCurrentValue] = React.useState(value);

  React.useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          className="w-full text-sm rounded-md border p-2 min-h-[100px] resize-y focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (currentValue !== value) onSave(currentValue);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsEditing(false);
              setCurrentValue(value);
            }
          }}
        />
      );
    }
    return (
      <input
        autoFocus
        className="w-full text-sm rounded-md border p-1.5 focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
        value={currentValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onBlur={() => {
          setIsEditing(false);
          if (currentValue !== value) onSave(currentValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setIsEditing(false);
            if (currentValue !== value) onSave(currentValue);
          }
          if (e.key === "Escape") {
            setIsEditing(false);
            setCurrentValue(value);
          }
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-muted/50 p-1 -ml-1 rounded transition-colors group min-h-[1.5rem]"
      title="Click to edit"
    >
      {value ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
        </div>
      ) : (
        <span className="text-muted-foreground italic text-sm group-hover:text-foreground">
          {placeholder}
        </span>
      )}
    </div>
  );
}
