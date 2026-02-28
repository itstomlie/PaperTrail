import { NextResponse } from "next/server";

async function fetchSemanticScholar(paperId: string) {
  const fields =
    "title,authors,year,abstract,url,externalIds,openAccessPdf,citationCount,referenceCount,fieldsOfStudy,publicationDate,journal,tldr";
  const res = await fetch(
    `https://api.semanticscholar.org/graph/v1/paper/${paperId}?fields=${fields}`,
    { headers: { "User-Agent": "PaperTrail/1.0" } },
  );
  if (!res.ok) return null;
  return res.json();
}

async function fetchCrossRef(doi: string) {
  const res = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { headers: { "User-Agent": "PaperTrail/1.0 (mailto:user@example.com)" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.message;
}

export async function POST(request: Request) {
  const { identifier } = await request.json();
  if (!identifier?.trim()) {
    return NextResponse.json({ error: "identifier required" }, { status: 400 });
  }

  const input = identifier.trim();

  // Detect identifier type
  let paperId = input;
  if (input.includes("arxiv.org")) {
    const match = input.match(/(\d{4}\.\d{4,}(v\d+)?)/);
    if (match) paperId = `ARXIV:${match[1]}`;
  } else if (input.includes("doi.org")) {
    paperId = input.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
  } else if (input.includes("semanticscholar.org")) {
    const parts = input.split("/");
    paperId = parts[parts.length - 1];
  } else if (/^\d{4}\.\d{4,}(v\d+)?$/.test(input)) {
    paperId = `ARXIV:${input}`;
  }

  // Try Semantic Scholar first
  const s2 = await fetchSemanticScholar(paperId);
  if (s2 && s2.title) {
    const authors =
      s2.authors?.map((a: { name: string }) => a.name).join(", ") || "Unknown";
    return NextResponse.json({
      source: "semantic_scholar",
      data: {
        title: s2.title,
        authors,
        year: s2.year || new Date().getFullYear(),
        abstract: s2.abstract,
        url: s2.url || `https://api.semanticscholar.org/paper/${paperId}`,
        pdfUrl: s2.openAccessPdf?.url || null,
        citationCount: s2.citationCount,
        fieldsOfStudy: s2.fieldsOfStudy,
        tldr: s2.tldr?.text || null,
        externalIds: s2.externalIds || {},
        bibtex: null,
      },
    });
  }

  // Fallback: CrossRef (DOI only)
  if (/^10\.\d{4,}\//.test(paperId)) {
    const cr = await fetchCrossRef(paperId);
    if (cr) {
      const title = cr.title?.[0] || "Untitled";
      const authors =
        cr.author
          ?.map((a: { given?: string; family?: string }) =>
            [a.given, a.family].filter(Boolean).join(" "),
          )
          .join(", ") || "Unknown";
      const year =
        cr["published-print"]?.["date-parts"]?.[0]?.[0] ||
        cr["published-online"]?.["date-parts"]?.[0]?.[0] ||
        new Date().getFullYear();

      return NextResponse.json({
        source: "crossref",
        data: {
          title,
          authors,
          year,
          abstract: cr.abstract?.replace(/<[^>]+>/g, "") || null,
          url: cr.URL || `https://doi.org/${paperId}`,
          pdfUrl:
            cr.link?.find(
              (l: { "content-type": string }) =>
                l["content-type"] === "application/pdf",
            )?.URL || null,
          citationCount: cr["is-referenced-by-count"] || null,
          fieldsOfStudy: cr.subject || [],
          tldr: null,
          externalIds: { DOI: paperId },
          bibtex: null,
        },
      });
    }
  }

  return NextResponse.json({
    source: "not_found",
    data: null,
    error: "Could not find this paper. Try a different identifier.",
  });
}
