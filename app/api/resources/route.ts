import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const resourceType = searchParams.get("resourceType");

  const where: Record<string, unknown> = {};
  if (projectId) where.projects = { some: { projectId } };
  if (resourceType) where.resourceType = resourceType;

  const resources = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      projects: { include: { project: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(resources);
}

export async function POST(request: Request) {
  const body = await request.json();

  const resource = await prisma.resource.create({
    data: {
      resourceType: body.resourceType || "paper",
      title: body.title,
      url: body.url || null,
      notes: body.notes || null,
      customFields: body.customFields
        ? JSON.stringify(body.customFields)
        : "{}",
      typeFields: body.typeFields ? JSON.stringify(body.typeFields) : "{}",
      thumbnailUrl: body.thumbnailUrl || null,
      projects: body.projectIds?.length
        ? {
            create: body.projectIds.map((pid: string) => ({
              projectId: pid,
            })),
          }
        : undefined,
      tags: body.tagIds?.length
        ? {
            create: body.tagIds.map((tid: string) => ({
              tagId: tid,
            })),
          }
        : undefined,
    },
    include: {
      projects: { include: { project: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(resource, { status: 201 });
}
