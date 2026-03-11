"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Quote,
  Plus,
  Trash2,
  ImageIcon,
  Loader2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  TYPE_META,
  RESOURCE_TYPES,
  type ResourceType,
  getTypeFields,
} from "@/lib/resource-types";

export default function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [resourceType, setResourceType] = React.useState<ResourceType>("paper");

  // Base
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");

  // Type fields (stored as flat state)
  const [tf, setTf] = React.useState<Record<string, unknown>>({});

  // Projects & Tags
  const [allProjects, setAllProjects] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [allTags, setAllTags] = React.useState<
    { id: string; name: string; color: string | null }[]
  >([]);
  const [selectedProjectIds, setSelectedProjectIds] = React.useState<string[]>(
    [],
  );
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);

  // Custom fields
  const [customFields, setCustomFields] = React.useState<
    { key: string; value: string; type?: string }[]
  >();

  // Additional links
  const [links, setLinks] = React.useState<{ label: string; url: string }[]>(
    [],
  );

  // Image paste
  const [uploadingImage, setUploadingImage] = React.useState(false);

  const handleImagePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setUploadingImage(true);
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/upload", {
            method: "POST",
            body: form,
          });
          if (res.ok) {
            const data = await res.json();
            updateTf("imageUrl", data.url);
            setThumbnailUrl(data.url);
            toast.success("Image pasted");
          } else {
            toast.error("Upload failed");
          }
        } catch {
          toast.error("Upload failed");
        }
        setUploadingImage(false);
        return;
      }
    }
  };

  React.useEffect(() => {
    params.then(async ({ id }) => {
      const [resource, projects, tags] = await Promise.all([
        fetch(`/api/resources/${id}`).then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/tags").then((r) => r.json()),
      ]);
      setResourceType(resource.resourceType);
      setTitle(resource.title);
      setUrl(resource.url || "");
      setNotes(resource.notes || "");
      setThumbnailUrl(resource.thumbnailUrl || "");
      const parsedTf = JSON.parse(resource.typeFields || "{}");
      setTf(parsedTf);
      // Load links from typeFields
      if (Array.isArray(parsedTf.links)) {
        setLinks(parsedTf.links);
      }
      setAllProjects(projects);
      setAllTags(tags);
      setSelectedProjectIds(
        resource.projects.map((pr: { projectId: string }) => pr.projectId),
      );
      setSelectedTagIds(resource.tags.map((rt: { tagId: string }) => rt.tagId));
      // Parse custom fields into editable rows
      const cf = JSON.parse(resource.customFields || "{}");
      setCustomFields(
        Object.entries(cf).map(([key, value]) => ({
          key,
          value: String(value),
          type: "text",
        })),
      );
      setLoading(false);
    });
  }, [params]);

  const updateTf = (key: string, value: unknown) =>
    setTf((prev) => ({ ...prev, [key]: value }));

  const addLink = () => setLinks((prev) => [...prev, { label: "", url: "" }]);
  const removeLink = (index: number) =>
    setLinks((prev) => prev.filter((_, i) => i !== index));
  const updateLink = (index: number, field: "label" | "url", value: string) =>
    setLinks((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    );

  const handleSave = async () => {
    const { id } = await params;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    // Build custom fields
    const cfObj: Record<string, string> = {};
    for (const f of (customFields ?? [])) {
      if (f.key.trim()) cfObj[f.key.trim()] = f.value;
    }

    // Merge links into typeFields
    const mergedTf = {
      ...tf,
      links: links.filter((l) => l.url.trim()),
    };

    const res = await fetch(`/api/resources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType,
        title: title.trim(),
        url: url.trim() || null,
        notes: notes.trim() || null,
        thumbnailUrl: thumbnailUrl || null,
        typeFields: mergedTf,
        customFields: cfObj,
        projectIds: selectedProjectIds,
        tagIds: selectedTagIds,
      }),
    });
    if (res.ok) {
      toast.success("Saved");
      router.push(`/resources/${(await params).id}`);
      router.refresh();
    } else toast.error("Failed to save");
    setSaving(false);
  };

  const saveRef = React.useRef(handleSave);
  React.useEffect(() => {
    saveRef.current = handleSave;
  });

  // Keyboard shortcut: Cmd/Ctrl+Enter to save
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );

  const meta = TYPE_META[resourceType];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Resource</h1>
          {/* Resource type selector */}
          <div className="flex flex-wrap gap-1 mt-2">
            {RESOURCE_TYPES.map((rt) => {
              const rm = TYPE_META[rt];
              const isActive = resourceType === rt;
              return (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setResourceType(rt)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors border ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <rm.icon className="h-3 w-3" style={{ color: isActive ? undefined : rm.color }} />
                  {rm.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      </div>

      {/* Additional Links */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5" />
            Additional Links
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={addLink}
          >
            <Plus className="h-3 w-3" /> Add Link
          </Button>
        </div>
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add links such as PDF URL, DOI, or related pages.
          </p>
        )}
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={link.label}
              onChange={(e) => updateLink(i, "label", e.target.value)}
              placeholder="Label (e.g. PDF, DOI)"
              className="w-1/3"
            />
            <Input
              value={link.url}
              onChange={(e) => updateLink(i, "url", e.target.value)}
              placeholder="https://..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive"
              onClick={() => removeLink(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Separator />

      {/* Type-specific fields */}
      <div className="space-y-4">
        {(resourceType === "paper" || resourceType === "book") && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Authors</Label>
                <Input
                  value={String(tf.authors || "")}
                  onChange={(e) => updateTf("authors", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={String(tf.year || "")}
                  onChange={(e) =>
                    updateTf("year", parseInt(e.target.value) || null)
                  }
                />
              </div>
            </div>
            {resourceType === "book" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>ISBN</Label>
                  <Input
                    value={String(tf.isbn || "")}
                    onChange={(e) => updateTf("isbn", e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Publisher</Label>
                  <Input
                    value={String(tf.publisher || "")}
                    onChange={(e) =>
                      updateTf("publisher", e.target.value || null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Chapter</Label>
                  <Input
                    value={String(tf.chapter || "")}
                    onChange={(e) =>
                      updateTf("chapter", e.target.value || null)
                    }
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>PDF URL</Label>
              <Input
                value={String(tf.pdfUrl || "")}
                onChange={(e) => updateTf("pdfUrl", e.target.value || null)}
              />
            </div>
          </>
        )}
        {resourceType === "article" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Authors</Label>
                <Input
                  value={String(tf.authors || "")}
                  onChange={(e) => updateTf("authors", e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Publisher</Label>
                <Input
                  value={String(tf.publisher || "")}
                  onChange={(e) =>
                    updateTf("publisher", e.target.value || null)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea
                value={String(tf.summary || "")}
                onChange={(e) => updateTf("summary", e.target.value || null)}
                rows={3}
              />
            </div>
          </>
        )}
        {resourceType === "web_link" && (
          <>
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input
                value={String(tf.siteName || "")}
                onChange={(e) => updateTf("siteName", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={String(tf.description || "")}
                onChange={(e) =>
                  updateTf("description", e.target.value || null)
                }
                rows={3}
              />
            </div>
          </>
        )}
        {resourceType === "image" && (
          <>
            {/* Paste zone */}
            <div
              className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-8 transition-colors hover:border-muted-foreground/50 cursor-pointer"
              onPaste={handleImagePaste}
              tabIndex={0}
            >
              {uploadingImage ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              )}
              <p className="text-sm text-muted-foreground">
                {uploadingImage
                  ? "Uploading..."
                  : "Click here and paste an image (Ctrl+V / ⌘V)"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                or edit the URL below
              </p>
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={String(tf.imageUrl || "")}
                onChange={(e) => updateTf("imageUrl", e.target.value)}
              />
            </div>
            {tf.imageUrl && (
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={String(tf.imageUrl)}
                  alt={String(tf.altText || "")}
                  className="max-h-48 w-full object-contain bg-muted"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <Input
                value={String(tf.altText || "")}
                onChange={(e) => updateTf("altText", e.target.value || null)}
              />
            </div>
          </>
        )}
        {resourceType === "dataset" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Input
                  value={String(tf.format || "")}
                  onChange={(e) => updateTf("format", e.target.value || null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Size</Label>
                <Input
                  value={String(tf.size || "")}
                  onChange={(e) => updateTf("size", e.target.value || null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>License</Label>
              <Input
                value={String(tf.license || "")}
                onChange={(e) => updateTf("license", e.target.value || null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={String(tf.description || "")}
                onChange={(e) =>
                  updateTf("description", e.target.value || null)
                }
                rows={3}
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Notes (Markdown)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="font-mono text-sm"
        />
      </div>

      <Separator />

      {/* Custom Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Custom Fields</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={() =>
              setCustomFields((prev) => [...(prev ?? []), { key: "", value: "", type: "text" }])
            }
          >
            <Plus className="h-3 w-3" /> Add Field
          </Button>
        </div>
        {(customFields ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No custom fields. Click &quot;Add Field&quot; to add one.
          </p>
        )}
        {(customFields ?? []).map((field, i) => (
          <div key={i} className="flex items-start gap-2">
            <Input
              value={field.key}
              onChange={(e) =>
                setCustomFields((prev) =>
                  (prev ?? []).map((f, j) =>
                    j === i ? { ...f, key: e.target.value } : f,
                  ),
                )
              }
              placeholder="Field name"
              className="w-1/3"
            />
            <Select
              value={field.type || "text"}
              onValueChange={(val) =>
                setCustomFields((prev) =>
                  (prev ?? []).map((f, j) =>
                    j === i ? { ...f, type: val } : f,
                  ),
                )
              }
            >
              <SelectTrigger className="w-28 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="long_text">Long text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
              </SelectContent>
            </Select>
            {field.type === "long_text" ? (
              <Textarea
                value={field.value}
                onChange={(e) =>
                  setCustomFields((prev) =>
                    (prev ?? []).map((f, j) =>
                      j === i ? { ...f, value: e.target.value } : f,
                    ),
                  )
                }
                placeholder="Value"
                rows={3}
                className="flex-1 text-sm"
              />
            ) : (
              <Input
                value={field.value}
                type={field.type === "number" ? "number" : "text"}
                onChange={(e) =>
                  setCustomFields((prev) =>
                    (prev ?? []).map((f, j) =>
                      j === i ? { ...f, value: e.target.value } : f,
                    ),
                  )
                }
                placeholder="Value"
                className="flex-1"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive mt-0.5"
              onClick={() =>
                setCustomFields((prev) => (prev ?? []).filter((_, j) => j !== i))
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Separator />

      {/* Projects & Tags */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Projects</Label>
          <div className="flex flex-wrap gap-2">
            {allProjects.map((p) => (
              <Badge
                key={p.id}
                variant={
                  selectedProjectIds.includes(p.id) ? "default" : "outline"
                }
                className="cursor-pointer"
                onClick={() =>
                  setSelectedProjectIds((prev) =>
                    prev.includes(p.id)
                      ? prev.filter((id) => id !== p.id)
                      : [...prev, p.id],
                  )
                }
              >
                {p.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => (
              <Badge
                key={t.id}
                variant={selectedTagIds.includes(t.id) ? "default" : "outline"}
                className="cursor-pointer"
                style={
                  t.color && selectedTagIds.includes(t.id)
                    ? { backgroundColor: t.color, borderColor: t.color }
                    : t.color
                      ? { borderColor: t.color, color: t.color }
                      : undefined
                }
                onClick={() =>
                  setSelectedTagIds((prev) =>
                    prev.includes(t.id)
                      ? prev.filter((id) => id !== t.id)
                      : [...prev, t.id],
                  )
                }
              >
                {t.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-right">
        Tip: Press{" "}
        <kbd className="rounded border px-1 py-0.5 text-xs font-mono bg-muted">⌘</kbd>
        {" "}+{" "}
        <kbd className="rounded border px-1 py-0.5 text-xs font-mono bg-muted">↵</kbd>
        {" "}to save
      </p>
    </div>
  );
}
