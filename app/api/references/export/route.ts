import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getTypeFields,
  type PaperTypeFields,
  type BookTypeFields,
} from "@/lib/resource-types";

export async function POST(request: Request) {
  const {
    projectId,
    format = "bibtex",
    includeArticles = false,
  } = await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { resources: { include: { resource: true } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Filter to citable resource types
  const citableTypes = ["paper", "book"];
  if (includeArticles) citableTypes.push("article");

  const citableResources = project.resources
    .map((pr) => pr.resource)
    .filter((r) => citableTypes.includes(r.resourceType));

  if (citableResources.length === 0) {
    return NextResponse.json(
      { error: "No citable resources in this project" },
      { status: 400 },
    );
  }

  // Build references
  const references = citableResources.map((r) => {
    const tf = getTypeFields<PaperTypeFields & BookTypeFields>(r.typeFields);
    return {
      title: r.title,
      type: r.resourceType,
      reference: tf.reference || null,
      authors: tf.authors || "Unknown",
      year: tf.year || null,
    };
  });

  if (format === "bibtex") {
    // Return raw stored references or generate minimal BibTeX
    const bibtexEntries = references.map((ref, i) => {
      if (ref.reference) return ref.reference;
      const key = `ref${i + 1}_${ref.title.slice(0, 20).replace(/\W/g, "")}`;
      const type = ref.type === "book" ? "book" : "article";
      return `@${type}{${key},\n  title = {${ref.title}},\n  author = {${ref.authors}},\n  year = {${ref.year || "n.d."}}\n}`;
    });

    return new NextResponse(bibtexEntries.join("\n\n"), {
      headers: {
        "Content-Type": "application/x-bibtex",
        "Content-Disposition": `attachment; filename="${project.name}_references.bib"`,
      },
    });
  }

  if (format === "markdown") {
    const md = references
      .map(
        (ref, i) =>
          `${i + 1}. ${ref.authors} (${ref.year || "n.d."}). *${ref.title}*.`,
      )
      .join("\n");
    return NextResponse.json({ text: md });
  }

  // Formatted text using citation-js if reference data available
  try {
    const { Cite } = await import("@citation-js/core");
    await import("@citation-js/plugin-bibtex");
    await import("@citation-js/plugin-csl");

    const refsWithData = references.filter((r) => r.reference);
    if (refsWithData.length > 0) {
      const combined = refsWithData.map((r) => r.reference).join("\n\n");
      const cite = new Cite(combined);
      const output = cite.format("bibliography", {
        format: "text",
        template: format,
        lang: "en-US",
      });
      return NextResponse.json({ text: output });
    }
  } catch {
    // Fall through to simple format
  }

  // Fallback: simple text
  const text = references
    .map(
      (ref, i) =>
        `[${i + 1}] ${ref.authors} (${ref.year || "n.d."}). ${ref.title}.`,
    )
    .join("\n");
  return NextResponse.json({ text });
}
