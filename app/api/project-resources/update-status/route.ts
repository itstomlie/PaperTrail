import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const { projectId, resourceId, status } = await request.json();

  if (!projectId || !resourceId || typeof status !== "string") {
    return NextResponse.json(
      { error: "projectId, resourceId, and status (string) are required" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.projectResource.update({
      where: {
        projectId_resourceId: { projectId, resourceId },
      },
      data: { status },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
