"use client";

import * as React from "react";
import { type ResourceItem } from "./types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TYPE_META, type ResourceType, getTypeFields } from "@/lib/resource-types";
import { ExternalLink, ListFilter, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface KanbanBoardViewProps {
  resources: ResourceItem[];
  onStatusChange: (resourceId: string, newStatus: string) => Promise<void>;
  onResourceClick: (resource: ResourceItem) => void;
}

const COLUMNS = [
  { id: "backlog", label: "To Read / Backlog" },
  { id: "reading", label: "Reading / In Progress" },
  { id: "core", label: "Synthesized / Core" },
  { id: "archived", label: "Archived" },
];

export function KanbanBoardView({
  resources,
  onStatusChange,
  onResourceClick,
}: KanbanBoardViewProps) {
  // Local optimistic state for drag and drop
  const [localResources, setLocalResources] = React.useState<ResourceItem[]>(resources);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalResources(resources);
  }, [resources]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    if (!id) return;

    const resource = localResources.find((r) => r.id === id);
    if (resource && resource.status !== columnId) {
      // Optimistic update
      setLocalResources((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: columnId } : r))
      );
      await onStatusChange(id, columnId);
    }
  };

  const handleStatusSelect = async (e: React.MouseEvent, id: string, newStatus: string) => {
    e.stopPropagation();
    // Optimistic update
    setLocalResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    await onStatusChange(id, newStatus);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start w-full min-h-[500px]">
      {COLUMNS.map((col) => {
        const columnResources = localResources.filter(
          (r) => (r.status || "backlog") === col.id
        );

        return (
          <div
            key={col.id}
            className="flex flex-col flex-shrink-0 w-80 bg-muted/40 rounded-lg p-3"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge variant="secondary" className="text-xs">
                {columnResources.length}
              </Badge>
            </div>

            <div className="flex flex-col gap-2 min-h-[100px]">
              {columnResources.map((resource) => {
                const m = TYPE_META[resource.resourceType as ResourceType];
                const tf = getTypeFields<Record<string, unknown>>(resource.typeFields);

                return (
                  <Card
                    key={resource.id}
                    className={`cursor-pointer hover:border-primary/50 transition-colors ${
                      draggedId === resource.id ? "opacity-50" : "opacity-100"
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, resource.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => onResourceClick(resource)}
                  >
                    <CardContent className="p-3 text-sm flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium leading-tight line-clamp-2">
                          {resource.title}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 -mr-1 -mt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {COLUMNS.map((statusCol) => (
                              <DropdownMenuItem
                                key={statusCol.id}
                                disabled={statusCol.id === col.id}
                                onClick={(e) =>
                                  handleStatusSelect(e, resource.id, statusCol.id)
                                }
                              >
                                Move to {statusCol.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {Boolean(tf.authors) && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {String(tf.authors)}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        {m && (
                          <div
                            className="flex items-center gap-1 text-xs"
                            style={{ color: m.color }}
                          >
                            <m.icon className="h-3 w-3" />
                            <span>{m.label}</span>
                          </div>
                        )}
                        {resource.url && (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener"
                            className="text-muted-foreground hover:text-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {columnResources.length === 0 && (
                <div className="flex items-center justify-center p-4 border-2 border-dashed border-muted/50 rounded-lg text-muted-foreground/50 text-sm h-24">
                  Drag items here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
