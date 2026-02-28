import {
  FileText,
  Newspaper,
  Link2,
  ImageIcon,
  Database,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

// ─── Resource Type IDs ───────────────────────────────────────────────

export const RESOURCE_TYPES = [
  "paper",
  "article",
  "web_link",
  "image",
  "dataset",
  "book",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

// ─── Type metadata ───────────────────────────────────────────────────

interface TypeMeta {
  id: ResourceType;
  label: string;
  pluralLabel: string;
  icon: LucideIcon;
  color: string;
}

export const TYPE_META: Record<ResourceType, TypeMeta> = {
  paper: {
    id: "paper",
    label: "Paper",
    pluralLabel: "Papers",
    icon: FileText,
    color: "#3b82f6",
  },
  article: {
    id: "article",
    label: "Article",
    pluralLabel: "Articles",
    icon: Newspaper,
    color: "#f97316",
  },
  web_link: {
    id: "web_link",
    label: "Web Link",
    pluralLabel: "Web Links",
    icon: Link2,
    color: "#06b6d4",
  },
  image: {
    id: "image",
    label: "Image",
    pluralLabel: "Images",
    icon: ImageIcon,
    color: "#8b5cf6",
  },
  dataset: {
    id: "dataset",
    label: "Dataset",
    pluralLabel: "Datasets",
    icon: Database,
    color: "#22c55e",
  },
  book: {
    id: "book",
    label: "Book / Chapter",
    pluralLabel: "Books",
    icon: BookOpen,
    color: "#ec4899",
  },
};

// ─── Feature matrix ──────────────────────────────────────────────────

type Feature =
  | "doi_import"
  | "reference_management"
  | "pdf_extraction"
  | "ai_chat"
  | "og_preview"
  | "image_preview"
  | "thumbnail";

const FEATURE_MATRIX: Record<Feature, ResourceType[]> = {
  doi_import: ["paper"],
  reference_management: ["paper", "book"],
  pdf_extraction: ["paper", "book"],
  ai_chat: ["paper", "article", "book"],
  og_preview: ["article", "web_link"],
  image_preview: ["image"],
  thumbnail: ["article", "web_link", "image"],
};

export function supportsFeature(
  resourceType: ResourceType,
  feature: Feature,
): boolean {
  return FEATURE_MATRIX[feature]?.includes(resourceType) ?? false;
}

// ─── Type field helpers ──────────────────────────────────────────────

export interface PaperTypeFields {
  authors: string;
  year: number;
  approach?: string | null;
  keyContributions?: string | null;
  datasets?: string | null;
  pdfUrl?: string | null;
  pdfTextContent?: string | null;
  pdfExtractionStatus?: string | null;
  abstract?: string | null;
  citationCount?: number | null;
  source?: string | null;
  externalIds?: Record<string, string> | null;
  reference?: string | null;
}

export interface ArticleTypeFields {
  authors?: string | null;
  publishedDate?: string | null;
  publisher?: string | null;
  summary?: string | null;
  articleType?: string | null;
}

export interface WebLinkTypeFields {
  description?: string | null;
  siteName?: string | null;
  favicon?: string | null;
}

export interface ImageTypeFields {
  imageUrl: string;
  altText?: string | null;
  sourceAttribution?: string | null;
  dimensions?: { width?: number; height?: number } | null;
  relatedResourceId?: string | null;
}

export interface DatasetTypeFields {
  datasetUrl?: string | null;
  format?: string | null;
  size?: string | null;
  license?: string | null;
  samples?: number | null;
  description?: string | null;
  relatedPaperIds?: string[] | null;
}

export interface BookTypeFields {
  authors: string;
  year?: number | null;
  isbn?: string | null;
  publisher?: string | null;
  edition?: string | null;
  chapter?: string | null;
  pages?: string | null;
  pdfUrl?: string | null;
  pdfTextContent?: string | null;
  pdfExtractionStatus?: string | null;
  reference?: string | null;
}

export function getTypeFields<T = Record<string, unknown>>(
  typeFieldsJson: string | null | undefined,
): T {
  try {
    return JSON.parse(typeFieldsJson || "{}") as T;
  } catch {
    return {} as T;
  }
}

// ─── Input detection ─────────────────────────────────────────────────

export type DetectedInputType =
  | { kind: "doi"; identifier: string }
  | { kind: "arxiv"; identifier: string }
  | { kind: "s2"; identifier: string }
  | { kind: "image_url"; url: string }
  | { kind: "url"; url: string }
  | { kind: "manual" };

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff)(\?.*)?$/i;

export function detectInputType(input: string): DetectedInputType {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "manual" };

  // DOI
  if (/^10\.\d{4,}\//.test(trimmed))
    return { kind: "doi", identifier: trimmed };
  if (trimmed.includes("doi.org/")) {
    const doi = trimmed.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    return { kind: "doi", identifier: doi };
  }

  // arXiv
  if (/^\d{4}\.\d{4,}(v\d+)?$/.test(trimmed))
    return { kind: "arxiv", identifier: trimmed };
  if (trimmed.includes("arxiv.org")) {
    const match = trimmed.match(/(\d{4}\.\d{4,}(v\d+)?)/);
    if (match) return { kind: "arxiv", identifier: match[1] };
  }

  // Semantic Scholar
  if (trimmed.includes("semanticscholar.org/paper/"))
    return { kind: "s2", identifier: trimmed };

  // Image URL
  if (trimmed.startsWith("http") && IMAGE_EXTENSIONS.test(trimmed))
    return { kind: "image_url", url: trimmed };

  // Generic URL
  if (/^https?:\/\//.test(trimmed)) return { kind: "url", url: trimmed };

  return { kind: "manual" };
}
