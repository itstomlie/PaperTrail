import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: Request) {
  const { projectId, resourceId, used } = await request.json();

  if (!projectId || !resourceId || typeof used !== "boolean") {
    return NextResponse.json(
      { error: "projectId, resourceId, and used (boolean) are required" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.projectResource.update({
      where: {
        projectId_resourceId: { projectId, resourceId },
      },
      data: { used },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
