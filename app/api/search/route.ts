import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const resourceType = searchParams.get("resourceType");

  if (!q) {
    return NextResponse.json({ resources: [], projects: [], tags: [] });
  }

  const like = `%${q}%`;

  const resourceWhere: Record<string, unknown> = {
    OR: [
      { title: { contains: q } },
      { notes: { contains: q } },
      { url: { contains: q } },
      { typeFields: { contains: q } },
    ],
  };
  if (resourceType) resourceWhere.resourceType = resourceType;

  const [resources, projects, tags] = await Promise.all([
    prisma.resource.findMany({
      where: resourceWhere,
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        tags: { include: { tag: true } },
      },
    }),
    prisma.project.findMany({
      where: {
        OR: [{ name: { contains: q } }, { description: { contains: q } }],
      },
      take: 10,
    }),
    prisma.tag.findMany({
      where: { name: { contains: q } },
      take: 10,
      include: { _count: { select: { resources: true } } },
    }),
  ]);

  return NextResponse.json({ resources, projects, tags });
}
