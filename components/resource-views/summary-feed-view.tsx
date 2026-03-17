"use client";

import * as React from "react";
import { type ResourceItem } from "./types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TYPE_META, type ResourceType, getTypeFields } from "@/lib/resource-types";
import { ExternalLink, Calendar, Users, FileText } from "lucide-react";

interface SummaryFeedViewProps {
  resources: ResourceItem[];
  onResourceClick: (resource: ResourceItem) => void;
}

export function SummaryFeedView({ resources, onResourceClick }: SummaryFeedViewProps) {
  return (
    <div className="flex flex-col gap-4 max-w-3xl mx-auto">
      {resources.map((resource) => {
        const m = TYPE_META[resource.resourceType as ResourceType];
        const tf = getTypeFields<Record<string, unknown>>(resource.typeFields);

        return (
          <Card
            key={resource.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onResourceClick(resource)}
          >
            <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-semibold leading-tight flex items-center gap-2">
                    {resource.title}
                    {resource.url && (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener"
                        className="text-muted-foreground hover:text-blue-500 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-1.5">
                    {m && (
                      <div
                        className="flex items-center gap-1.5 font-medium"
                        style={{ color: m.color }}
                      >
                        <m.icon className="h-4 w-4" />
                        {m.label}
                      </div>
                    )}
                    
                    {Boolean(tf.authors) && (
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        <span className="line-clamp-1">{String(tf.authors)}</span>
                      </div>
                    )}
                    
                    {Boolean(tf.year) && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{String(tf.year)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Badge variant={resource.status === 'core' ? 'default' : 'secondary'} className="capitalize shrink-0">
                  {resource.status || "backlog"}
                </Badge>
              </div>

              {Boolean(resource.notes || tf.abstract || tf.approach) && (
                <div className="text-sm text-muted-foreground/80 line-clamp-3 bg-muted/30 p-3 rounded-md border border-muted mt-2">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />
                    <span className="italic">
                      {resource.notes || String(tf.abstract || tf.approach || "")}
                    </span>
                  </div>
                </div>
              )}

              {resource.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {resource.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-xs font-normal"
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
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
