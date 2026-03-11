import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const { projectId, resourceId, starred } = await request.json();

  if (!projectId || !resourceId || typeof starred !== "boolean") {
    return NextResponse.json(
      { error: "projectId, resourceId, and starred (boolean) are required" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.projectResource.update({
      where: {
        projectId_resourceId: { projectId, resourceId },
      },
      data: { starred },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
