import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getTypeFields,
  type PaperTypeFields,
  type BookTypeFields,
} from "@/lib/resource-types";

export async function POST(request: Request) {
  const { resourceId } = await request.json();
  if (!resourceId) {
    return NextResponse.json({ error: "resourceId required" }, { status: 400 });
  }

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
  });
  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  // Only paper and book support PDF extraction
  if (!["paper", "book"].includes(resource.resourceType)) {
    return NextResponse.json(
      { error: "PDF extraction not supported for this resource type" },
      { status: 400 },
    );
  }

  const tf = getTypeFields<PaperTypeFields | BookTypeFields>(
    resource.typeFields,
  );
  if (!tf.pdfUrl) {
    return NextResponse.json({ error: "No PDF URL" }, { status: 400 });
  }

  try {
    // Update status to pending
    const currentTf = { ...tf, pdfExtractionStatus: "pending" };
    await prisma.resource.update({
      where: { id: resourceId },
      data: { typeFields: JSON.stringify(currentTf) },
    });

    const pdfRes = await fetch(tf.pdfUrl);
    if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);

    const buffer = Buffer.from(await pdfRes.arrayBuffer());

    // Extract text using pdf-parse v2
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.pages
      .map((p: { text: string }) => p.text)
      .join("\n\n");

    // Store extracted text in typeFields
    const updatedTf = {
      ...tf,
      pdfTextContent: text,
      pdfExtractionStatus: "success",
    };
    await prisma.resource.update({
      where: { id: resourceId },
      data: { typeFields: JSON.stringify(updatedTf) },
    });

    return NextResponse.json({ ok: true, length: text.length });
  } catch (error) {
    console.error("PDF extraction error:", error);
    const failedTf = { ...tf, pdfExtractionStatus: "failed" };
    await prisma.resource.update({
      where: { id: resourceId },
      data: { typeFields: JSON.stringify(failedTf) },
    });
    return NextResponse.json(
      { error: "PDF extraction failed" },
      { status: 500 },
    );
  }
}
