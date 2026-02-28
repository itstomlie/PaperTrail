import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import OpenAI from "openai";
import { getTypeFields } from "@/lib/resource-types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { resourceId, citationStyle = "bibtex" } = await request.json();

    if (!resourceId) {
      return NextResponse.json(
        { error: "resourceId is required" },
        { status: 400 },
      );
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );
    }

    const tf = getTypeFields<Record<string, unknown>>(resource.typeFields);

    // If reference already exists, return it
    if (tf.reference) {
      return NextResponse.json({
        citation: tf.reference,
        cached: true,
      });
    }

    // Build metadata context for the AI
    const metadata: string[] = [
      `Title: ${resource.title}`,
      `Resource Type: ${resource.resourceType}`,
    ];

    if (tf.authors) metadata.push(`Authors: ${tf.authors}`);
    if (tf.year) metadata.push(`Year: ${tf.year}`);
    if (resource.url) metadata.push(`URL: ${resource.url}`);
    if (tf.publisher) metadata.push(`Publisher: ${tf.publisher}`);
    if (tf.publishedDate) metadata.push(`Published Date: ${tf.publishedDate}`);
    if (tf.isbn) metadata.push(`ISBN: ${tf.isbn}`);
    if (tf.edition) metadata.push(`Edition: ${tf.edition}`);
    if (tf.siteName) metadata.push(`Site Name: ${tf.siteName}`);
    if (tf.articleType) metadata.push(`Article Type: ${tf.articleType}`);
    if (tf.format) metadata.push(`Format: ${tf.format}`);
    if (tf.license) metadata.push(`License: ${tf.license}`);
    if (tf.chapter) metadata.push(`Chapter: ${tf.chapter}`);
    if (tf.pages) metadata.push(`Pages: ${tf.pages}`);
    if (tf.abstract)
      metadata.push(`Abstract: ${String(tf.abstract).slice(0, 500)}`);

    // Determine style instructions
    const styleInstructions: Record<string, string> = {
      bibtex:
        "Generate a valid BibTeX entry. Use an appropriate entry type (@article, @book, @misc, @inproceedings, @online, etc.) based on the resource type. Include all available fields. Use a sensible citation key based on author surname and year.",
      ieee: "Generate an IEEE-style citation. Follow IEEE citation format strictly.",
      chicago:
        "Generate a Chicago Manual of Style 17th edition (author-date) citation, specifically following Curtin University guidelines.",
    };

    const styleInstruction =
      styleInstructions[citationStyle] || styleInstructions.bibtex;

    const systemPrompt = `You are a precise citation generator. You generate properly formatted academic citations based on the metadata provided.

RULES:
1. Use ONLY the metadata provided. Do NOT fabricate any information.
2. If a field is missing but required by the citation style, omit it gracefully.
3. For URLs, include an accessed date of today's date.
4. Return ONLY the citation text, no explanations or extra text.
5. For BibTeX, always return a complete, valid BibTeX entry.

${styleInstruction}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate a ${citationStyle.toUpperCase()} citation for the following resource:\n\n${metadata.join("\n")}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const citation =
      completion.choices[0]?.message?.content?.trim() ||
      "Failed to generate citation.";

    // Save the generated citation as the reference in typeFields
    const updatedTf = { ...tf, reference: citation };
    await prisma.resource.update({
      where: { id: resourceId },
      data: { typeFields: JSON.stringify(updatedTf) },
    });

    return NextResponse.json({ citation, cached: false });
  } catch (error) {
    console.error("Citation generation error:", error);
    const message =
      error instanceof Error ? error.message : "Citation generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
