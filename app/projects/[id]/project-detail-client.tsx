"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AddResourceSheet } from "@/components/add-resource-sheet";
import {
  Plus,
  ArrowUpDown,
  Settings,
  Search,
  LayoutGrid,
  List,
  Columns3,
  ExternalLink,
  BookOpen,
  Users,
  Calendar,
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
  { key: "used", label: "Used", defaultVisible: true },
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
  used?: boolean;
}

interface Props {
  project: {
    id: string;
    name: string;
    description: string | null;
    customFieldTemplates: { name: string; type: string }[];
    _count: { resources: number };
  };
  resources: ResourceItem[];
  allTags: Tag[];
}

// ─── Component ────────────────────────────────────────────────────

export function ProjectDetailClient({ project, resources, allTags }: Props) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<string>("createdAt");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = React.useState<"table" | "gallery">(() => {
    if (typeof window === "undefined") return "table";
    return (
      (localStorage.getItem("papertrail-view-mode") as "table" | "gallery") ||
      "table"
    );
  });
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(() =>
    loadVisibleColumns(),
  );
  const [selectedResource, setSelectedResource] =
    React.useState<ResourceItem | null>(null);
  const [showAddSheet, setShowAddSheet] = React.useState(false);

  // Used status tracking
  const [usedMap, setUsedMap] = React.useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    resources.forEach((r) => {
      map[r.id] = r.used ?? false;
    });
    return map;
  });

  const toggleUsed = async (resourceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !usedMap[resourceId];
    setUsedMap((prev) => ({ ...prev, [resourceId]: newVal }));
    try {
      const res = await fetch("/api/project-resources/toggle-used", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          resourceId,
          used: newVal,
        }),
      });
      if (!res.ok) {
        setUsedMap((prev) => ({ ...prev, [resourceId]: !newVal }));
        toast.error("Failed to toggle used status");
      }
    } catch {
      setUsedMap((prev) => ({ ...prev, [resourceId]: !newVal }));
      toast.error("Failed to toggle used status");
    }
  };

  // Persist view mode
  const handleViewMode = (mode: "table" | "gallery") => {
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
      const tfA = getTypeFields<Record<string, unknown>>(a.typeFields);
      const tfB = getTypeFields<Record<string, unknown>>(b.typeFields);
      let cmp = 0;
      switch (sortField) {
        case "used":
          cmp = (usedMap[a.id] ? 1 : 0) - (usedMap[b.id] ? 1 : 0);
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
  }, [resources, typeFilter, search, sortField, sortDir, usedMap]);

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
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "gallery" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-none rounded-r-md"
            onClick={() => handleViewMode("gallery")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>

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
                {isCol("used") && (
                  <TableHead className="w-10">
                    <SortHeader field="used" label="Used" />
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
                    {isCol("used") && (
                      <TableCell>
                        <button
                          onClick={(e) => toggleUsed(resource.id, e)}
                          className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                            usedMap[resource.id]
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30 hover:border-muted-foreground/60"
                          }`}
                        >
                          {usedMap[resource.id] && (
                            <Check className="h-3 w-3" />
                          )}
                        </button>
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
      ) : (
        /* ──── Gallery View ──── */
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((resource) => {
            const m = TYPE_META[resource.resourceType as ResourceType];
            const tf = getTypeFields<Record<string, unknown>>(
              resource.typeFields,
            );
            const isImage = resource.resourceType === "image";
            const imageUrl = isImage
              ? (tf.imageUrl as string) || resource.url
              : null;

            return (
              <Card
                key={resource.id}
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 overflow-hidden"
                onClick={() => setSelectedResource(resource)}
              >
                {/* Image preview for image resources */}
                {imageUrl && (
                  <div className="h-28 bg-muted overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={resource.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                {/* Slim color bar for non-image resources */}
                {!imageUrl && (
                  <div
                    className="h-1"
                    style={{ backgroundColor: m?.color || "#888" }}
                  />
                )}
                <CardContent className="p-3 space-y-1.5">
                  {/* Title + URL icon */}
                  <div className="flex items-start gap-1.5">
                    {m && (
                      <m.icon
                        className="h-3.5 w-3.5 mt-0.5 shrink-0"
                        style={{ color: m.color }}
                      />
                    )}
                    <h3 className="font-medium text-sm leading-tight line-clamp-2 flex-1">
                      {resource.title}
                    </h3>
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener"
                        className="text-muted-foreground hover:text-blue-500 shrink-0 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                        title="Open page"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Notes preview */}
                  {resource.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {resource.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ──── Resource Detail Sidebar (Sheet) ──── */}
      <Sheet
        open={!!selectedResource}
        onOpenChange={(open) => {
          if (!open) setSelectedResource(null);
        }}
      >
        <SheetContent
          side="right"
          className="sm:max-w-lg w-full overflow-y-auto"
        >
          {selectedResource && (
            <ResourceSidebar
              resource={selectedResource}
              projectId={project.id}
              onNavigate={() => {
                router.push(`/resources/${selectedResource.id}`);
                setSelectedResource(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add Resource Sheet */}
      <AddResourceSheet
        projectId={project.id}
        open={showAddSheet}
        onOpenChange={setShowAddSheet}
        onResourceAdded={() => router.refresh()}
      />
    </div>
  );
}

// ─── Sidebar Component ────────────────────────────────────────────

function ResourceSidebar({
  resource,
  onNavigate,
  projectId,
}: {
  resource: ResourceItem;
  onNavigate: () => void;
  projectId: string;
}) {
  const m = TYPE_META[resource.resourceType as ResourceType];
  const tf = getTypeFields<Record<string, unknown>>(resource.typeFields);
  const customFields = resource.customFields || {};

  // Dynamic field visibility
  const SIDEBAR_FIELDS_KEY = `papertrail-sidebar-fields-${projectId}`;
  const ALL_FIELDS = [
    { id: "authors", label: "Authors" },
    { id: "year", label: "Year" },
    { id: "url", label: "Page URL" },
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

  return (
    <>
      <SheetHeader className="pb-0">
        <div className="flex items-center gap-2">
          {m && (
            <Badge
              variant="outline"
              className="gap-1 text-xs"
              style={{ color: m.color, borderColor: m.color }}
            >
              <m.icon className="h-3 w-3" />
              {m.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <SheetTitle className="text-lg leading-tight flex-1">
            {resource.title}
          </SheetTitle>
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
        <SheetDescription className="sr-only">
          Resource details for {resource.title}
        </SheetDescription>
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

        {/* Custom Fields */}
        {isField("customFields") && Object.keys(customFields).length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Custom Fields
              </p>
              <dl className="space-y-1.5">
                {Object.entries(customFields).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="font-medium text-right">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}

        {/* Notes preview */}
        {isField("notes") && resource.notes && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Notes
              </p>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">
                {resource.notes}
              </p>
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
      {typeof value === "string" ? <p className="text-sm">{value}</p> : value}
    </div>
  );
}
