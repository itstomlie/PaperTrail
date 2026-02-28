"use client";

import * as React from "react";
import { Search, Loader2, Plus, Trash2, ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  detectInputType,
} from "@/lib/resource-types";

interface AddResourceSheetProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResourceAdded: () => void;
}

export function AddResourceSheet({
  projectId,
  open,
  onOpenChange,
  onResourceAdded,
}: AddResourceSheetProps) {
  const [resourceType, setResourceType] = React.useState<ResourceType>("paper");
  const [smartInput, setSmartInput] = React.useState("");
  const [detecting, setDetecting] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [authors, setAuthors] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Image paste
  const [imageUrl, setImageUrl] = React.useState("");
  const [uploadingImage, setUploadingImage] = React.useState(false);

  // Custom fields
  const [customFields, setCustomFields] = React.useState<
    { key: string; value: string }[]
  >([]);

  const smartInputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setResourceType("paper");
    setSmartInput("");
    setDetecting(false);
    setTitle("");
    setUrl("");
    setAuthors("");
    setNotes("");
    setSaving(false);
    setImageUrl("");
    setUploadingImage(false);
    setCustomFields([]);
  };

  // Listen for global paste event from the project detail page
  React.useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail as string;
      if (text) {
        setSmartInput(text);
        // Auto-trigger detection after a tick
        setTimeout(() => {
          smartInputRef.current?.focus();
        }, 50);
      }
    };
    window.addEventListener("papertrail-paste-import", handler);
    return () => window.removeEventListener("papertrail-paste-import", handler);
  }, []);

  // Auto-detect when smartInput is set via paste event
  const prevSmartInput = React.useRef("");
  React.useEffect(() => {
    if (
      smartInput &&
      smartInput !== prevSmartInput.current &&
      prevSmartInput.current === "" &&
      open
    ) {
      handleSmartInput();
    }
    prevSmartInput.current = smartInput;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smartInput, open]);

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
            setImageUrl(data.url);
            setResourceType("image");
            if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
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

  const handleSmartInput = async () => {
    if (!smartInput.trim()) return;
    setDetecting(true);

    const det = detectInputType(smartInput);

    try {
      if (det.kind === "doi" || det.kind === "arxiv" || det.kind === "s2") {
        setResourceType("paper");
        const res = await fetch("/api/resources/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: smartInput.trim() }),
        });
        const result = await res.json();
        if (result.data) {
          setTitle(result.data.title);
          setAuthors(result.data.authors || "");
          setUrl(result.data.url || "");
        }
      } else if (det.kind === "image_url") {
        setResourceType("image");
        setUrl(det.url);
        setImageUrl(det.url);
        setTitle(det.url.split("/").pop()?.split("?")[0] || "Image");
      } else if (det.kind === "url") {
        const res = await fetch("/api/resources/fetch-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: det.url }),
        });
        const og = await res.json();
        setUrl(det.url);
        if (og.type === "article" || og.publishedDate) {
          setResourceType("article");
        } else {
          setResourceType("web_link");
        }
        if (og.title) setTitle(og.title);
        if (og.description) setNotes(og.description);
      }
    } catch {
      toast.error("Failed to detect input");
    }
    setDetecting(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);

    const typeFields: Record<string, unknown> = {};
    if (authors) typeFields.authors = authors;
    if (resourceType === "image") typeFields.imageUrl = imageUrl || url;

    const cfObj: Record<string, string> = {};
    for (const f of customFields) {
      if (f.key.trim()) cfObj[f.key.trim()] = f.value;
    }

    const res = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType,
        title: title.trim(),
        url: url.trim() || null,
        notes: notes.trim() || null,
        typeFields,
        customFields: Object.keys(cfObj).length > 0 ? cfObj : undefined,
        projectIds: [projectId],
      }),
    });

    if (res.ok) {
      toast.success("Resource added");
      reset();
      onOpenChange(false);
      onResourceAdded();
    } else {
      toast.error("Failed to save");
    }
    setSaving(false);
  };

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { key: "", value: "" }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomField = (
    index: number,
    field: "key" | "value",
    val: string,
  ) => {
    setCustomFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: val } : f)),
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <SheetContent className="sm:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Add Resource</SheetTitle>
          <SheetDescription className="text-xs">
            Paste a DOI, URL, image, or add manually
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4 mt-2">
          {/* Smart Input */}
          <div className="space-y-1.5">
            <Label className="text-xs">Quick Import</Label>
            <div className="flex gap-1.5">
              <Input
                ref={smartInputRef}
                value={smartInput}
                onChange={(e) => setSmartInput(e.target.value)}
                placeholder="DOI, URL, or arXiv ID"
                onKeyDown={(e) => e.key === "Enter" && handleSmartInput()}
                className="flex-1 h-8 text-sm"
              />
              <Button
                onClick={handleSmartInput}
                disabled={detecting || !smartInput.trim()}
                size="sm"
                className="h-8 px-2.5"
              >
                {detecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Resource Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <div className="flex flex-wrap gap-1">
              {RESOURCE_TYPES.map((rt) => {
                const m = TYPE_META[rt];
                const isActive = resourceType === rt;
                return (
                  <button
                    key={rt}
                    onClick={() => setResourceType(rt)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors border ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <m.icon className="h-3 w-3" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image paste zone — show for image type */}
          {resourceType === "image" && (
            <div
              className="relative flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-4 transition-colors hover:border-muted-foreground/50 cursor-pointer"
              onPaste={handleImagePaste}
              tabIndex={0}
            >
              {uploadingImage ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
              )}
              <p className="text-xs text-muted-foreground">
                {uploadingImage
                  ? "Uploading..."
                  : "Click here and paste an image (⌘V)"}
              </p>
              {imageUrl && (
                <div className="mt-2 overflow-hidden rounded border w-full">
                  <img
                    src={imageUrl}
                    alt={title}
                    className="max-h-24 w-full object-contain bg-muted"
                  />
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resource title"
              className="h-8 text-sm"
            />
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>

          {/* Authors — show for paper, article, book */}
          {(resourceType === "paper" ||
            resourceType === "article" ||
            resourceType === "book") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Authors</Label>
              <Input
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                placeholder="Author 1, Author 2"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick notes..."
              rows={3}
              className="text-sm"
              onPaste={handleImagePaste}
            />
          </div>

          {/* Custom Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Custom Fields</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs gap-1"
                onClick={addCustomField}
              >
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>
            {customFields.map((cf, i) => (
              <div key={i} className="flex gap-1.5 items-center">
                <Input
                  value={cf.key}
                  onChange={(e) => updateCustomField(i, "key", e.target.value)}
                  placeholder="Field name"
                  className="h-7 text-xs flex-1"
                />
                <Input
                  value={cf.value}
                  onChange={(e) =>
                    updateCustomField(i, "value", e.target.value)
                  }
                  placeholder="Value"
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeCustomField(i)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              size="sm"
              className="gap-1.5 flex-1"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving..." : "Add Resource"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
