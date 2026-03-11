"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  Quote,
  Globe,
  Plus,
  Trash2,
  ImageIcon,
  Upload,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  RESOURCE_TYPES,
  TYPE_META,
  type ResourceType,
  detectInputType,
} from "@/lib/resource-types";

interface ImportResult {
  source: "semantic_scholar" | "crossref" | "not_found";
  data: {
    title: string;
    authors: string;
    year: number;
    abstract?: string;
    url: string;
    pdfUrl?: string;
    citationCount?: number;
    fieldsOfStudy?: string[];
    tldr?: string;
    bibtex?: string;
    externalIds?: Record<string, string>;
  } | null;
  error?: string;
}

interface OgResult {
  title: string | null;
  description: string | null;
  siteName: string | null;
  image: string | null;
  favicon: string | null;
  type: string | null;
  publishedDate: string | null;
}

export function NewResourceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get("projectId");

  // Type state
  const [resourceType, setResourceType] = React.useState<ResourceType>("paper");
  const [inputMode, setInputMode] = React.useState<"smart" | "manual">("smart");

  // Smart input
  const [smartInput, setSmartInput] = React.useState("");
  const [detecting, setDetecting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(
    null,
  );
  const [ogResult, setOgResult] = React.useState<OgResult | null>(null);

  // Form state (base)
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");

  // Paper/Book fields
  const [authors, setAuthors] = React.useState("");
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [approach, setApproach] = React.useState("");
  const [keyContributions, setKeyContributions] = React.useState("");
  const [datasets, setDatasets] = React.useState("");
  const [pdfUrl, setPdfUrl] = React.useState("");
  const [abstract, setAbstract] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [citationCount, setCitationCount] = React.useState<number | null>(null);
  const [source, setSource] = React.useState("manual");
  const [externalIds, setExternalIds] = React.useState<Record<
    string,
    string
  > | null>(null);

  // Article fields
  const [publisher, setPublisher] = React.useState("");
  const [publishedDate, setPublishedDate] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [articleType, setArticleType] = React.useState("other");

  // Web Link fields
  const [description, setDescription] = React.useState("");
  const [siteName, setSiteName] = React.useState("");

  // Image fields
  const [imageUrl, setImageUrl] = React.useState("");
  const [altText, setAltText] = React.useState("");

  // Dataset fields
  const [datasetUrl, setDatasetUrl] = React.useState("");
  const [format, setFormat] = React.useState("");
  const [size, setSize] = React.useState("");
  const [license, setLicense] = React.useState("");

  // Book extra fields
  const [isbn, setIsbn] = React.useState("");
  const [edition, setEdition] = React.useState("");
  const [chapter, setChapter] = React.useState("");
  const [pages, setPages] = React.useState("");

  // Project/tag selection
  const [projects, setProjects] = React.useState<
    { id: string; name: string }[]
  >([]);
  const [tags, setTags] = React.useState<
    { id: string; name: string; color: string | null }[]
  >([]);
  const [selectedProjectIds, setSelectedProjectIds] = React.useState<string[]>(
    preselectedProjectId ? [preselectedProjectId] : [],
  );
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Custom fields
  const [customFields, setCustomFields] = React.useState<
    { key: string; value: string; type?: string; label?: string }[]
  >([]);

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
            setImageUrl(data.url);
            setThumbnailUrl(data.url);
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

  React.useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([p, t]) => {
      setProjects(p);
      setTags(t);
      // If preselected project, fetch its custom field templates
      if (preselectedProjectId) {
        const proj = p.find(
          (pr: { id: string }) => pr.id === preselectedProjectId,
        );
        if (proj) {
          try {
            const templates = JSON.parse(proj.customFieldTemplates || "[]");
            if (Array.isArray(templates) && templates.length > 0) {
              setCustomFields(
                templates.map(
                  (t: { key: string; label: string; type: string }) => ({
                    key: t.key,
                    value: "",
                    type: t.type,
                    label: t.label,
                  }),
                ),
              );
            }
          } catch {}
        }
      }
    });
  }, [preselectedProjectId]);

  // Smart input handler
  const handleSmartInput = async () => {
    if (!smartInput.trim()) return;
    setDetecting(true);
    setImportResult(null);
    setOgResult(null);

    const detected = detectInputType(smartInput);

    try {
      if (
        detected.kind === "doi" ||
        detected.kind === "arxiv" ||
        detected.kind === "s2"
      ) {
        // Paper import
        setResourceType("paper");
        const res = await fetch("/api/resources/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: smartInput.trim() }),
        });
        const result: ImportResult = await res.json();
        setImportResult(result);
        if (result.data) {
          setTitle(result.data.title);
          setAuthors(result.data.authors);
          setYear(result.data.year);
          setUrl(result.data.url);
          setPdfUrl(result.data.pdfUrl || "");
          setAbstract(result.data.abstract || "");
          setCitationCount(result.data.citationCount ?? null);
          setSource(result.source);
          setExternalIds(result.data.externalIds || null);
          setApproach(result.data.tldr || "");
          if (result.data.abstract) {
            setNotes(`## Abstract\n\n${result.data.abstract}`);
          }
        }
      } else if (detected.kind === "image_url") {
        // Image URL
        setResourceType("image");
        setImageUrl(detected.url);
        setUrl(detected.url);
        setTitle(detected.url.split("/").pop()?.split("?")[0] || "Image");
        setThumbnailUrl(detected.url);
      } else if (detected.kind === "url") {
        // Fetch OG metadata
        const res = await fetch("/api/resources/fetch-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: detected.url }),
        });
        const og: OgResult = await res.json();
        setOgResult(og);
        setUrl(detected.url);

        // Auto-suggest type
        if (og.type === "article" || og.publishedDate) {
          setResourceType("article");
          if (og.publishedDate) setPublishedDate(og.publishedDate);
        } else {
          setResourceType("web_link");
        }

        if (og.title) setTitle(og.title);
        if (og.description) {
          setDescription(og.description);
          setSummary(og.description);
        }
        if (og.siteName) {
          setSiteName(og.siteName);
          setPublisher(og.siteName);
        }
        if (og.image) setThumbnailUrl(og.image);
      }
    } catch {
      toast.error("Failed to detect input");
    }

    setDetecting(false);
  };

  const buildTypeFields = (): Record<string, unknown> => {
    switch (resourceType) {
      case "paper":
        return {
          authors,
          year,
          approach: approach || null,
          keyContributions: keyContributions || null,
          datasets: datasets || null,
          pdfUrl: pdfUrl || null,
          abstract: abstract || null,
          citationCount,
          source,
          externalIds,
          reference: reference || null,
        };
      case "article":
        return {
          authors: authors || null,
          publishedDate: publishedDate || null,
          publisher: publisher || null,
          summary: summary || null,
          articleType: articleType || "other",
        };
      case "web_link":
        return {
          description: description || null,
          siteName: siteName || null,
        };
      case "image":
        return {
          imageUrl: imageUrl || url,
          altText: altText || null,
        };
      case "dataset":
        return {
          datasetUrl: datasetUrl || null,
          format: format || null,
          size: size || null,
          license: license || null,
          description: description || null,
        };
      case "book":
        return {
          authors,
          year: year || null,
          isbn: isbn || null,
          publisher: publisher || null,
          edition: edition || null,
          chapter: chapter || null,
          pages: pages || null,
          pdfUrl: pdfUrl || null,
          reference: reference || null,
        };
      default:
        return {};
    }
  };

  // Merge links into typeFields on save
  const getTypeFieldsWithLinks = (): Record<string, unknown> => {
    const base = buildTypeFields();
    const filteredLinks = links.filter((l) => l.url.trim());
    if (filteredLinks.length > 0) base.links = filteredLinks;
    return base;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (
      (resourceType === "paper" || resourceType === "book") &&
      !authors.trim()
    ) {
      toast.error("Authors are required for papers and books");
      return;
    }
    setSaving(true);
    // Build custom fields object
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
        thumbnailUrl: thumbnailUrl || null,
        typeFields: getTypeFieldsWithLinks(),
        customFields: Object.keys(cfObj).length > 0 ? cfObj : undefined,
        projectIds: selectedProjectIds,
        tagIds: selectedTagIds,
      }),
    });
    if (res.ok) {
      const resource = await res.json();
      toast.success("Resource added");
      router.push(`/resources/${resource.id}`);
    } else {
      toast.error("Failed to save resource");
    }
    setSaving(false);
  };

  const TypeFields = () => {
    switch (resourceType) {
      case "paper":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Authors *</Label>
                <Input
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author 1, Author 2, ..."
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || year)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Approach / Summary</Label>
              <Textarea
                value={approach}
                onChange={(e) => setApproach(e.target.value)}
                placeholder="Summary of methodology..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Key Contributions</Label>
              <Textarea
                value={keyContributions}
                onChange={(e) => setKeyContributions(e.target.value)}
                placeholder="What are the key contributions?"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datasets</Label>
                <Input
                  value={datasets}
                  onChange={(e) => setDatasets(e.target.value)}
                  placeholder="Datasets used"
                />
              </div>
              <div className="space-y-2">
                <Label>PDF URL</Label>
                <Input
                  value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                <div className="flex items-center gap-1.5">
                  <Quote className="h-3.5 w-3.5" />
                  Reference (BibTeX)
                </div>
              </Label>
              <Textarea
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="@article{...}"
                rows={3}
                className="font-mono text-sm"
              />
            </div>
          </>
        );
      case "article":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Authors</Label>
                <Input
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author names"
                />
              </div>
              <div className="space-y-2">
                <Label>Publisher / Source</Label>
                <Input
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="Blog, newspaper, etc."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Published Date</Label>
                <Input
                  type="date"
                  value={publishedDate}
                  onChange={(e) => setPublishedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Article Type</Label>
                <Select value={articleType} onValueChange={setArticleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["blog", "news", "tutorial", "opinion", "other"].map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary..."
                rows={3}
              />
            </div>
          </>
        );
      case "web_link":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Site Name</Label>
                <Input
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="GitHub, Wikipedia, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Thumbnail URL</Label>
                <Input
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Page description..."
                rows={3}
              />
            </div>
          </>
        );
      case "image":
        return (
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
                or enter a URL below
              </p>
            </div>
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... or paste an image above"
              />
            </div>
            {imageUrl && (
              <div className="overflow-hidden rounded-lg border">
                <img
                  src={imageUrl}
                  alt={altText || title}
                  className="max-h-48 w-full object-contain bg-muted"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <Input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image"
              />
            </div>
          </>
        );
      case "dataset":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dataset URL</Label>
                <Input
                  value={datasetUrl}
                  onChange={(e) => setDatasetUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Input
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  placeholder="CSV, JSON, Parquet..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Size</Label>
                <Input
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. 2.3 GB"
                />
              </div>
              <div className="space-y-2">
                <Label>License</Label>
                <Input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="MIT, CC-BY-4.0..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the dataset..."
                rows={3}
              />
            </div>
          </>
        );
      case "book":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Authors *</Label>
                <Input
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author 1, Author 2"
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value) || year)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Publisher</Label>
                <Input
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Edition</Label>
                <Input
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chapter</Label>
                <Input
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Pages</Label>
                <Input
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="e.g. 45-78"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>PDF URL</Label>
              <Input
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>
                <div className="flex items-center gap-1.5">
                  <Quote className="h-3.5 w-3.5" />
                  Reference
                </div>
              </Label>
              <Textarea
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="@book{...}"
                rows={3}
                className="font-mono text-sm"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
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
          <h1 className="text-xl font-bold tracking-tight">Add Resource</h1>
          <p className="text-xs text-muted-foreground">
            Paste a DOI, URL, or add manually
          </p>
        </div>
      </div>

      {/* Smart Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste a DOI, URL, or link</CardTitle>
          <CardDescription>
            We&apos;ll auto-detect the type and fetch metadata
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={smartInput}
              onChange={(e) => setSmartInput(e.target.value)}
              placeholder="e.g., 10.1109/CVPR.2019.00584 or https://..."
              onKeyDown={(e) => e.key === "Enter" && handleSmartInput()}
              className="flex-1"
            />
            <Button
              onClick={handleSmartInput}
              disabled={detecting || !smartInput.trim()}
            >
              {detecting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-4 w-4" />
              )}
              {detecting ? "Detecting..." : "Detect"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Or{" "}
            <button
              className="underline"
              onClick={() =>
                setInputMode(inputMode === "smart" ? "manual" : "smart")
              }
            >
              {inputMode === "smart"
                ? "add manually instead"
                : "use smart detection"}
            </button>
          </p>
        </CardContent>
      </Card>

      {/* Import Result */}
      {importResult &&
        (importResult.source === "not_found" ? (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-3 py-4">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">Paper not found</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.error || "Try a different identifier."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : importResult.data ? (
          <Card className="border-green-500/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">Import Preview</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {importResult.source === "semantic_scholar"
                    ? "Semantic Scholar"
                    : "CrossRef"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="font-semibold">{importResult.data.title}</p>
              <p className="text-sm text-muted-foreground">
                {importResult.data.authors} · {importResult.data.year}
              </p>
              {importResult.data.tldr && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    TLDR
                  </p>
                  <p className="mt-1 text-sm">{importResult.data.tldr}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null)}

      {/* OG Preview */}
      {ogResult && (
        <Card className="border-blue-500/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">URL Preview</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-3">
              {ogResult.image && (
                <img
                  src={ogResult.image}
                  alt=""
                  className="h-20 w-32 shrink-0 rounded-md object-cover bg-muted"
                />
              )}
              <div>
                <p className="font-semibold">{ogResult.title || url}</p>
                {ogResult.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ogResult.description}
                  </p>
                )}
                {ogResult.siteName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {ogResult.siteName}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Type Selector — inline buttons */}
      <div className="space-y-2">
        <Label className="text-xs">Resource Type</Label>
        <div className="flex flex-wrap gap-1.5">
          {RESOURCE_TYPES.map((t) => {
            const m = TYPE_META[t];
            const isActive = resourceType === t;
            return (
              <button
                key={t}
                onClick={() => setResourceType(t)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Base Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Title *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Resource title"
          />
        </div>
        <div className="space-y-2">
          <Label>URL</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
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
              onClick={() =>
                setLinks((prev) => [...prev, { label: "", url: "" }])
              }
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
                onChange={(e) =>
                  setLinks((prev) =>
                    prev.map((l, j) =>
                      j === i ? { ...l, label: e.target.value } : l,
                    ),
                  )
                }
                placeholder="Label (e.g. PDF, DOI)"
                className="w-1/3"
              />
              <Input
                value={link.url}
                onChange={(e) =>
                  setLinks((prev) =>
                    prev.map((l, j) =>
                      j === i ? { ...l, url: e.target.value } : l,
                    ),
                  )
                }
                placeholder="https://..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() =>
                  setLinks((prev) => prev.filter((_, j) => j !== i))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Type-Specific Fields */}
      <div className="space-y-4">
        <TypeFields />
      </div>

      <Separator />

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes (Markdown)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Your notes..."
          rows={4}
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
              setCustomFields((prev) => [...prev, { key: "", value: "" }])
            }
          >
            <Plus className="h-3 w-3" /> Add Field
          </Button>
        </div>
        {customFields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add custom key-value fields specific to this resource.
          </p>
        )}
        {customFields.map((field, i) => (
          <div key={i} className="space-y-1">
            {field.label ? (
              <Label className="text-xs text-muted-foreground">
                {field.label}
              </Label>
            ) : null}
            <div className="flex items-center gap-2">
              {!field.label && (
                <Input
                  value={field.key}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((f, j) =>
                        j === i ? { ...f, key: e.target.value } : f,
                      ),
                    )
                  }
                  placeholder="Field name"
                  className="w-1/3"
                />
              )}
              {field.type === "long_text" ? (
                <Textarea
                  value={field.value}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((f, j) =>
                        j === i ? { ...f, value: e.target.value } : f,
                      ),
                    )
                  }
                  placeholder={
                    field.label ? `Enter ${field.label.toLowerCase()}` : "Value"
                  }
                  rows={3}
                  className="flex-1"
                />
              ) : (
                <Input
                  value={field.value}
                  onChange={(e) =>
                    setCustomFields((prev) =>
                      prev.map((f, j) =>
                        j === i ? { ...f, value: e.target.value } : f,
                      ),
                    )
                  }
                  placeholder={
                    field.label ? `Enter ${field.label.toLowerCase()}` : "Value"
                  }
                  type={field.type === "number" ? "number" : "text"}
                  className="flex-1"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() =>
                  setCustomFields((prev) => prev.filter((_, j) => j !== i))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Projects & Tags */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Projects</Label>
          <div className="flex flex-wrap gap-2">
            {projects.map((p) => (
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
            {projects.length === 0 && (
              <p className="text-sm text-muted-foreground">No projects yet</p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
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
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">No tags yet</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Resource"}
        </Button>
      </div>
    </div>
  );
}
