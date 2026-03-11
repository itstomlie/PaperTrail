"use client";

import * as React from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Trash2,
  ExternalLink,
  FileText,
  Bot,
  Copy,
  ChevronDown,
  Calendar,
  Users,
  BookOpen,
  Quote,
  Sparkles,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  TYPE_META,
  type ResourceType,
  getTypeFields,
  supportsFeature,
  type PaperTypeFields,
  type ArticleTypeFields,
  type BookTypeFields,
  type WebLinkTypeFields,
  type ImageTypeFields,
  type DatasetTypeFields,
} from "@/lib/resource-types";

interface Tag {
  id: string;
  name: string;
  color: string | null;
}
interface Project {
  id: string;
  name: string;
}

interface ResourceData {
  id: string;
  resourceType: string;
  title: string;
  url: string | null;
  notes: string | null;
  customFields: string;
  typeFields: string;
  thumbnailUrl: string | null;
  tags: Tag[];
  projects: Project[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Props {
  resource: ResourceData;
  allResources: { id: string; title: string }[];
}

export function ResourceDetailClient({ resource, allResources }: Props) {
  const router = useRouter();
  const [notes, setNotes] = React.useState(resource.notes || "");
  const [notesMode, setNotesMode] = React.useState<"edit" | "preview">(
    "preview",
  );
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [showAiChat, setShowAiChat] = React.useState(false);
  const [generatingCitation, setGeneratingCitation] = React.useState(false);
  const [currentReference, setCurrentReference] = React.useState<string | null>(
    null,
  );

  const rt = resource.resourceType as ResourceType;
  const meta = TYPE_META[rt];
  const TypeIcon = meta.icon;
  const tf = getTypeFields<
    PaperTypeFields &
      ArticleTypeFields &
      BookTypeFields &
      WebLinkTypeFields &
      ImageTypeFields &
      DatasetTypeFields
  >(resource.typeFields);
  const customFields = JSON.parse(resource.customFields || "{}");

  // Initialize reference from typeFields
  React.useEffect(() => {
    setCurrentReference(tf.reference || null);
  }, [tf.reference]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${resource.title}"?`)) return;
    const res = await fetch(`/api/resources/${resource.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Deleted");
      router.push("/");
      router.refresh();
    } else toast.error("Failed to delete");
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    const res = await fetch(`/api/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    if (res.ok) toast.success("Notes saved");
    else toast.error("Failed to save notes");
    setSavingNotes(false);
  };

  const generateCitation = async () => {
    setGeneratingCitation(true);
    try {
      const res = await fetch("/api/ai/generate-citation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          citationStyle: "bibtex",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentReference(data.citation);
        toast.success(data.cached ? "Citation loaded" : "Citation generated!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to generate citation");
      }
    } catch {
      toast.error("Failed to generate citation");
    }
    setGeneratingCitation(false);
  };

  const copyReference = async (format: string) => {
    const ref = tf.reference;
    if (!ref) {
      toast.error("No reference data available");
      return;
    }
    try {
      const { Cite } = await import("@citation-js/core");
      await import("@citation-js/plugin-bibtex");
      await import("@citation-js/plugin-csl");
      const cite = new Cite(ref);
      let output: string;
      if (format === "bibtex") output = cite.format("bibtex");
      else
        output = cite.format("bibliography", {
          format: "text",
          template: format,
          lang: "en-US",
        });
      await navigator.clipboard.writeText(output);
      toast.success(`Copied as ${format.toUpperCase()}`);
    } catch {
      await navigator.clipboard.writeText(ref);
      toast.success("Copied raw reference");
    }
  };

  const resolveWikiLinks = (text: string) =>
    text.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
      const linked = allResources.find(
        (r) => r.title.toLowerCase() === title.toLowerCase(),
      );
      return linked ? `[${title}](/resources/${linked.id})` : match;
    });

  // Metadata cards per type
  const MetadataCards = () => {
    const cards: React.ReactNode[] = [];

    if (rt === "paper" || rt === "book") {
      if (tf.approach)
        cards.push(
          <InfoCard key="approach" label="Approach" value={tf.approach} />,
        );
      if (tf.keyContributions)
        cards.push(
          <InfoCard
            key="kc"
            label="Key Contributions"
            value={tf.keyContributions}
          />,
        );
      if (tf.datasets)
        cards.push(<InfoCard key="ds" label="Datasets" value={tf.datasets} />);
      if (rt === "book") {
        const parts = [
          tf.publisher,
          tf.edition && `${tf.edition} ed.`,
          tf.isbn && `ISBN: ${tf.isbn}`,
          tf.chapter && `Ch. ${tf.chapter}`,
          tf.pages && `pp. ${tf.pages}`,
        ].filter(Boolean);
        if (parts.length)
          cards.push(
            <InfoCard
              key="bookinfo"
              label="Book Details"
              value={parts.join(" · ")}
            />,
          );
      }
    }
    if (rt === "article") {
      if (tf.summary)
        cards.push(
          <InfoCard key="summary" label="Summary" value={tf.summary} />,
        );
      const parts = [
        tf.publisher,
        tf.articleType && tf.articleType !== "other" && tf.articleType,
        tf.publishedDate,
      ].filter(Boolean);
      if (parts.length)
        cards.push(
          <InfoCard
            key="artinfo"
            label="Article Details"
            value={parts.join(" · ")}
          />,
        );
    }
    if (rt === "web_link") {
      if (tf.description)
        cards.push(
          <InfoCard key="desc" label="Description" value={tf.description} />,
        );
      if (tf.siteName)
        cards.push(<InfoCard key="site" label="Site" value={tf.siteName} />);
    }
    if (rt === "dataset") {
      if (tf.description)
        cards.push(
          <InfoCard key="desc" label="Description" value={tf.description} />,
        );
      const parts = [
        tf.format && `Format: ${tf.format}`,
        tf.size && `Size: ${tf.size}`,
        tf.license && `License: ${tf.license}`,
      ].filter(Boolean);
      if (parts.length)
        cards.push(
          <InfoCard
            key="dsinfo"
            label="Dataset Details"
            value={parts.join(" · ")}
          />,
        );
    }

    if (Object.keys(customFields).length > 0) {
      cards.push(
        <Card key="cf">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custom Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {Object.entries(customFields).map(([key, value]) => (
                <div key={key} className="text-sm">
                  <dt className="text-muted-foreground text-xs mb-0.5">
                    {key}
                  </dt>
                  <dd className="font-medium">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {String(value)}
                      </ReactMarkdown>
                    </div>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>,
      );
    }

    // Reference / Generate Citation — available for ALL resource types
    if (currentReference) {
      cards.push(
        <Card key="ref">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Reference
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                  >
                    <Copy className="h-3 w-3" /> Copy as{" "}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {[
                    { key: "bibtex", label: "BibTeX" },
                    { key: "ieee", label: "IEEE" },
                    { key: "apa", label: "APA 7th" },
                  ].map((fmt) => (
                    <DropdownMenuItem
                      key={fmt.key}
                      onClick={() => copyReference(fmt.key)}
                    >
                      {fmt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs font-mono">
              {currentReference}
            </pre>
          </CardContent>
        </Card>,
      );
    } else {
      cards.push(
        <Card key="gen-ref">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              No citation available yet. Generate one using AI.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={generateCitation}
              disabled={generatingCitation}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generatingCitation ? "Generating..." : "Generate Citation"}
            </Button>
          </CardContent>
        </Card>,
      );
    }

    return <>{cards}</>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 h-8 w-8 shrink-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight leading-tight flex items-center gap-2">
              {resource.title}
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
            </h1>

            {/* Additional Links */}
            {(() => {
              const tfAny = tf as unknown as Record<string, unknown>;
              const tfLinks = Array.isArray(tfAny.links)
                ? (tfAny.links as { label: string; url: string }[])
                : [];
              return tfLinks.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {tfLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline rounded-md border px-2 py-0.5"
                    >
                      <Link2 className="h-3 w-3" />
                      {link.label || new URL(link.url).hostname}
                    </a>
                  ))}
                </div>
              ) : null;
            })()}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                style={{ color: meta.color, borderColor: meta.color }}
              >
                <TypeIcon className="mr-1 h-3 w-3" /> {meta.label}
              </Badge>
              {tf.authors && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {tf.authors}
                </span>
              )}
              {tf.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {tf.year}
                </span>
              )}
              {tf.citationCount != null && (
                <Badge variant="secondary" className="text-xs">
                  {tf.citationCount} citations
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {tf.pdfUrl && (
            <a href={tf.pdfUrl} target="_blank" rel="noopener">
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText className="h-4 w-4" />
                PDF
              </Button>
            </a>
          )}
          {supportsFeature(rt, "ai_chat") && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAiChat(!showAiChat)}
            >
              <Bot className="h-4 w-4" />
              Ask AI
            </Button>
          )}
          <Link href={`/resources/${resource.id}/edit`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tags & Projects */}
      <div className="flex flex-wrap gap-2">
        {resource.projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Badge variant="secondary" className="gap-1">
              <BookOpen className="h-3 w-3" />
              {p.name}
            </Badge>
          </Link>
        ))}
        {resource.tags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
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

      {/* Image preview for image type */}
      {rt === "image" && tf.imageUrl && (
        <div className="overflow-hidden rounded-lg border">
          <img
            src={tf.imageUrl as string}
            alt={(tf.altText as string) || resource.title}
            className="w-full object-contain bg-muted max-h-[500px]"
          />
        </div>
      )}

      {/* Thumbnail for article/web_link */}
      {(rt === "article" || rt === "web_link") && resource.thumbnailUrl && (
        <div className="overflow-hidden rounded-lg border">
          <img
            src={resource.thumbnailUrl}
            alt=""
            className="w-full max-h-48 object-cover bg-muted"
          />
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Metadata */}
        <div className="space-y-4 lg:col-span-2">
          <MetadataCards />
        </div>

        {/* Right: Notes */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Notes
                </CardTitle>
                <div className="flex gap-2">
                  <Tabs
                    value={notesMode}
                    onValueChange={(v) => setNotesMode(v as "edit" | "preview")}
                  >
                    <TabsList className="h-7">
                      <TabsTrigger value="preview" className="text-xs px-2 h-5">
                        Preview
                      </TabsTrigger>
                      <TabsTrigger value="edit" className="text-xs px-2 h-5">
                        Edit
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {notesMode === "edit" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={saveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? "Saving..." : "Save"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {notesMode === "edit" ? (
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Write your notes here... Use [[Title]] to link to other resources."
                  className="min-h-[400px] font-mono text-sm"
                />
              ) : notes ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {resolveWikiLinks(notes)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No notes yet. Click &quot;Edit&quot; to start writing.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Chat Panel */}
      {showAiChat && (
        <AiChatPanel
          resourceId={resource.id}
          resourceTitle={resource.title}
          onClose={() => setShowAiChat(false)}
        />
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm">{value}</p>
      </CardContent>
    </Card>
  );
}

function AiChatPanel({
  resourceId,
  resourceTitle,
  onClose,
}: {
  resourceId: string;
  resourceTitle: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = React.useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, scope: "resource", resourceId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.answer },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to reach the AI service." },
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed right-0 top-0 z-50 flex h-screen w-[420px] flex-col border-l border-border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">Ask AI</p>
          <p className="text-xs text-muted-foreground line-clamp-1">
            About: {resourceTitle}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setMessages([])}
          >
            New Chat
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Ask questions about this resource.
              <br />
              AI answers are grounded to its content only.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "ml-8 rounded-lg bg-primary p-3 text-primary-foreground text-sm"
                : "mr-8 rounded-lg bg-muted p-3 text-sm"
            }
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {loading && (
          <div className="mr-8 rounded-lg bg-muted p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 animate-pulse rounded-full bg-foreground/50" />
              Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            rows={2}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="self-end"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
