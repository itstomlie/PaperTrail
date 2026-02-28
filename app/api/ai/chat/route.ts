import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import OpenAI from "openai";
import {
  getTypeFields,
  type PaperTypeFields,
  type BookTypeFields,
  type ArticleTypeFields,
} from "@/lib/resource-types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ─── Paper / Book prompt ──────────────────────────────────────────

function buildPaperPrompt(resource: {
  title: string;
  url: string | null;
  customFields: string;
  notes: string | null;
  typeFields: string;
}) {
  const tf = getTypeFields<PaperTypeFields>(resource.typeFields);
  const cf = JSON.parse(resource.customFields || "{}");
  const cfStr =
    Object.entries(cf)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n") || "  None";

  return `You are a research paper analysis assistant. You help the user understand and explore a specific academic paper.

YOUR STRICT RULES:
1. You may ONLY use the information provided below to answer questions.
2. You must NEVER generate information not explicitly present in the provided content. If not found, say: "I cannot find information about that in this paper's available content."
3. You must NEVER speculate, infer beyond what is written, or draw on external knowledge.
4. When answering, CITE where your answer comes from. Use: [Source: <section name, page number, or "metadata"/"user notes">].
5. Keep answers precise, academic in tone, well-structured. Use markdown formatting.

---

PAPER METADATA:
- Title: ${resource.title}
- Authors: ${tf.authors || "Unknown"}
- Year: ${tf.year || "Unknown"}
- Abstract: ${tf.abstract || "No abstract available."}
- Approach: ${tf.approach || "Not provided."}
- Key Contributions: ${tf.keyContributions || "Not provided."}
- Datasets: ${tf.datasets || "Not provided."}
- URL: ${resource.url || "Not provided."}
- PDF URL: ${tf.pdfUrl || "Not available."}
- Citation Count: ${tf.citationCount ?? "Unknown"}
- Custom Fields:
${cfStr}

---

USER'S NOTES ON THIS PAPER:
${resource.notes || "No notes provided."}

---

EXTRACTED PDF TEXT:
${tf.pdfTextContent || "PDF text not available. Answer based on metadata and notes only."}`;
}

// ─── Article prompt ────────────────────────────────────────────────

function buildArticlePrompt(resource: {
  title: string;
  url: string | null;
  customFields: string;
  notes: string | null;
  typeFields: string;
}) {
  const tf = getTypeFields<ArticleTypeFields>(resource.typeFields);
  const cf = JSON.parse(resource.customFields || "{}");
  const cfStr =
    Object.entries(cf)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n") || "  None";

  return `You are a research resource analysis assistant. You help the user understand and explore a specific article.

YOUR STRICT RULES:
1. You may ONLY use the information provided below to answer questions.
2. You must NEVER generate information that is not explicitly present in the provided content. If the answer is not in the provided content, say: "I cannot find information about that in this article's available content."
3. You must NEVER speculate, infer beyond what is written, or draw on external knowledge.
4. When answering, reference whether your answer comes from the article metadata or the user's notes.
5. Keep your answers precise and well-structured.

---

ARTICLE METADATA:
- Title: ${resource.title}
- Authors: ${tf.authors || "Unknown"}
- Published Date: ${tf.publishedDate || "Unknown"}
- Publisher/Source: ${tf.publisher || "Unknown"}
- Type: ${tf.articleType || "article"}
- Summary: ${tf.summary || "No summary available."}
- URL: ${resource.url || "Not provided."}
- Custom Fields:
${cfStr}

---

USER'S NOTES ON THIS ARTICLE:
${resource.notes || "No notes provided."}`;
}

// ─── Book prompt ──────────────────────────────────────────────────

function buildBookPrompt(resource: {
  title: string;
  url: string | null;
  customFields: string;
  notes: string | null;
  typeFields: string;
}) {
  const tf = getTypeFields<BookTypeFields>(resource.typeFields);
  const cf = JSON.parse(resource.customFields || "{}");
  const cfStr =
    Object.entries(cf)
      .map(([k, v]) => `  - ${k}: ${v}`)
      .join("\n") || "  None";

  return `You are a research resource analysis assistant. You help the user understand and explore a specific book or chapter.

YOUR STRICT RULES:
1. You may ONLY use the information provided below to answer questions.
2. You must NEVER generate information not explicitly present in the provided content. If not found, say: "I cannot find information about that in this book's available content."
3. You must NEVER speculate, infer beyond what is written, or draw on external knowledge.
4. When answering, CITE where your answer comes from. Use: [Source: <section name, page number, or "metadata"/"user notes">].
5. Keep answers precise, academic in tone, well-structured. Use markdown formatting.

---

BOOK METADATA:
- Title: ${resource.title}
- Authors: ${tf.authors || "Unknown"}
- Year: ${tf.year || "Unknown"}
- Publisher: ${tf.publisher || "Not provided."}
- ISBN: ${tf.isbn || "Not provided."}
- Edition: ${tf.edition || "Not provided."}
- Chapter: ${tf.chapter || "Not provided."}
- Pages: ${tf.pages || "Not provided."}
- URL: ${resource.url || "Not provided."}
- PDF URL: ${tf.pdfUrl || "Not available."}
- Custom Fields:
${cfStr}

---

USER'S NOTES:
${resource.notes || "No notes provided."}

---

EXTRACTED PDF TEXT:
${tf.pdfTextContent || "PDF text not available. Answer based on metadata and notes only."}`;
}

// ─── Project prompt ──────────────────────────────────────────────

function buildProjectPrompt(project: {
  name: string;
  description: string | null;
  resources: Array<{
    resource: {
      resourceType: string;
      title: string;
      url: string | null;
      customFields: string;
      notes: string | null;
      typeFields: string;
    };
  }>;
}) {
  const typeCounts: Record<string, number> = {};
  const resourceTexts = project.resources
    .map(({ resource }) => {
      typeCounts[resource.resourceType] =
        (typeCounts[resource.resourceType] || 0) + 1;
      const tf = getTypeFields<Record<string, unknown>>(resource.typeFields);
      const type = resource.resourceType.toUpperCase();
      const meta = Object.entries(tf)
        .filter(([k]) => k !== "pdfTextContent")
        .map(([k, v]) => `- ${k}: ${v ?? "Not provided."}`)
        .join("\n");
      const pdfText = (tf.pdfTextContent as string) || null;

      return `=== ${type}: "${resource.title}" ===
${meta}

USER'S NOTES:
${resource.notes || "No notes provided."}

${pdfText ? `EXTRACTED TEXT:\n${pdfText.slice(0, 8000)}` : ""}`;
    })
    .join("\n\n");

  const countsStr = Object.entries(typeCounts)
    .map(([t, n]) => `${t}: ${n}`)
    .join(", ");

  return `You are a research project analysis assistant. You help the user explore, compare, and synthesise across a collection of research resources within a project.

YOUR STRICT RULES:
1. You may ONLY use the information provided below to answer questions.
2. You must NEVER generate information not explicitly present. If not found, say: "I cannot find information about that in the resources available in this project."
3. You must NEVER speculate or draw on external knowledge.
4. ATTRIBUTE every claim to a specific resource by title and type.
5. When comparing resources, be precise. Present each resource's data individually with clear attribution.
6. Be aware that this project contains different types of resources. Treat each according to its type.
7. Keep answers precise, academic in tone, well-structured. Use markdown tables for comparisons.

---

PROJECT CONTEXT:
- Project Name: ${project.name}
- Description: ${project.description || "No description."}
- Resource Counts: ${countsStr}

---

RESOURCES IN THIS PROJECT:

${resourceTexts}`;
}

export async function POST(request: Request) {
  try {
    const { question, scope, resourceId, projectId, conversationId } =
      await request.json();

    if (!question) {
      return NextResponse.json({ error: "Question required" }, { status: 400 });
    }

    let systemPrompt: string;

    if (scope === "resource" && resourceId) {
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
      });
      if (!resource) {
        return NextResponse.json(
          { error: "Resource not found" },
          { status: 404 },
        );
      }

      // Feature gate
      if (!["paper", "article", "book"].includes(resource.resourceType)) {
        return NextResponse.json(
          { error: "AI chat is not available for this resource type" },
          { status: 400 },
        );
      }

      // Lazy PDF extraction: if paper/book has a pdfUrl and no extracted text yet, try now
      if (["paper", "book"].includes(resource.resourceType)) {
        const tf = getTypeFields<PaperTypeFields & BookTypeFields>(
          resource.typeFields,
        );
        if (
          tf.pdfUrl &&
          !tf.pdfTextContent &&
          tf.pdfExtractionStatus !== "failed"
        ) {
          // Attempt extraction inline
          try {
            const pdfRes = await fetch(tf.pdfUrl);
            if (pdfRes.ok) {
              const buffer = Buffer.from(await pdfRes.arrayBuffer());
              const { PDFParse } = await import("pdf-parse");
              const parser = new PDFParse({ data: new Uint8Array(buffer) });
              const textResult = await parser.getText();
              const text = textResult.pages
                .map((p: { text: string }) => p.text)
                .join("\n\n");

              const updatedTf = {
                ...tf,
                pdfTextContent: text,
                pdfExtractionStatus: "success",
              };
              await prisma.resource.update({
                where: { id: resourceId },
                data: { typeFields: JSON.stringify(updatedTf) },
              });
              // Re-read the updated resource
              const updated = await prisma.resource.findUnique({
                where: { id: resourceId },
              });
              if (updated) {
                Object.assign(resource, updated);
              }
            }
          } catch {
            // Mark as failed so we don't retry every time
            const failedTf = { ...tf, pdfExtractionStatus: "failed" };
            await prisma.resource.update({
              where: { id: resourceId },
              data: { typeFields: JSON.stringify(failedTf) },
            });
          }
        }
      }

      switch (resource.resourceType) {
        case "article":
          systemPrompt = buildArticlePrompt(resource);
          break;
        case "book":
          systemPrompt = buildBookPrompt(resource);
          break;
        default:
          systemPrompt = buildPaperPrompt(resource);
      }
    } else if (scope === "project" && projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          resources: { include: { resource: true } },
        },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }
      systemPrompt = buildProjectPrompt(project);
    } else {
      return NextResponse.json(
        { error: "Invalid scope. Provide resourceId or projectId." },
        { status: 400 },
      );
    }

    // Previous messages
    let previousMessages: { role: "user" | "assistant"; content: string }[] =
      [];
    if (conversationId) {
      const conv = await prisma.aiConversation.findUnique({
        where: { id: conversationId },
      });
      if (conv) {
        previousMessages = JSON.parse(conv.messages as string);
      }
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...previousMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: question },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      temperature: 0.1,
      max_tokens: 3000,
    });

    const answer =
      completion.choices[0]?.message?.content || "No response generated.";

    // Save conversation
    const allMessages = [
      ...previousMessages,
      {
        role: "user",
        content: question,
        timestamp: new Date().toISOString(),
      },
      {
        role: "assistant",
        content: answer,
        timestamp: new Date().toISOString(),
      },
    ];

    let convId = conversationId;
    if (convId) {
      await prisma.aiConversation.update({
        where: { id: convId },
        data: { messages: JSON.stringify(allMessages) },
      });
    } else {
      const conv = await prisma.aiConversation.create({
        data: {
          scope,
          resourceId: scope === "resource" ? resourceId : null,
          projectId: scope === "project" ? projectId : null,
          messages: JSON.stringify(allMessages),
        },
      });
      convId = conv.id;
    }

    return NextResponse.json({ answer, conversationId: convId });
  } catch (error) {
    console.error("AI chat error:", error);
    const message = error instanceof Error ? error.message : "AI service error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
