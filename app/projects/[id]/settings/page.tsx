"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface CustomFieldTemplate {
  key: string;
  label: string;
  type: string;
  options?: string[];
}

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [templates, setTemplates] = React.useState<CustomFieldTemplate[]>([]);
  const [citationStyle, setCitationStyle] = React.useState("bibtex");
  const [projectColor, setProjectColor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name);
        setDescription(data.description || "");
        setTemplates(JSON.parse(data.customFieldTemplates || "[]"));
        setCitationStyle(data.citationStyle || "bibtex");
        setProjectColor(data.color || null);
        setLoading(false);
      });
  }, [projectId]);

  const addTemplate = () => {
    setTemplates((prev) => [...prev, { key: "", label: "", type: "text" }]);
  };

  const updateTemplate = (
    index: number,
    field: keyof CustomFieldTemplate,
    value: string,
  ) => {
    setTemplates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      // Auto-populate key from label
      if (field === "label") {
        copy[index].key = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      }
      return copy;
    });
  };

  const removeTemplate = (index: number) => {
    setTemplates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        customFieldTemplates: templates.filter((t) => t.key && t.label),
        citationStyle,
        color: projectColor,
      }),
    });
    if (res.ok) {
      toast.success("Settings saved");
      router.push(`/projects/${projectId}`);
      router.refresh();
    } else {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Project Settings
          </h1>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Project Color</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                "#3b82f6",
                "#f97316",
                "#22c55e",
                "#8b5cf6",
                "#ec4899",
                "#06b6d4",
                "#eab308",
                "#ef4444",
              ].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-7 w-7 rounded-full transition-all ${
                    projectColor === c
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : "hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: c,
                    ...(projectColor === c ? { ringColor: c } : {}),
                  }}
                  onClick={() => setProjectColor(c)}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Citation Style */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Citation Style</CardTitle>
          <CardDescription>
            Default citation format for AI-generated references in this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="citationStyle">Style</Label>
            <Select value={citationStyle} onValueChange={setCitationStyle}>
              <SelectTrigger id="citationStyle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bibtex">BibTeX</SelectItem>
                <SelectItem value="ieee">IEEE</SelectItem>
                <SelectItem value="chicago">
                  Chicago 17th (Author-Date, Curtin)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Custom Field Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custom Field Templates</CardTitle>
          <CardDescription>
            Define fields that will be suggested for every resource in this
            project. Resources can also have additional one-off fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No custom fields defined yet.
            </p>
          )}
          {templates.map((template, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input
                      placeholder="e.g., mIoU (%)"
                      value={template.label}
                      onChange={(e) =>
                        updateTemplate(i, "label", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select
                      value={template.type}
                      onValueChange={(v) => updateTemplate(i, "type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Key:{" "}
                  <code className="rounded bg-muted px-1">
                    {template.key || "..."}
                  </code>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-5 h-8 w-8 text-destructive"
                onClick={() => removeTemplate(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addTemplate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Field
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-2">
        <Link href={`/projects/${projectId}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
