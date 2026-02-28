import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      projects: { include: { project: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!resource)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(resource);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const data: Record<string, unknown> = {};

  // Base fields
  const baseFields = ["title", "url", "notes", "thumbnailUrl", "resourceType"];
  for (const f of baseFields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  // JSON fields
  if (body.customFields !== undefined)
    data.customFields = JSON.stringify(body.customFields);
  if (body.typeFields !== undefined)
    data.typeFields = JSON.stringify(body.typeFields);

  // Project associations
  if (body.projectIds !== undefined) {
    await prisma.projectResource.deleteMany({ where: { resourceId: id } });
    if (body.projectIds.length > 0) {
      await prisma.projectResource.createMany({
        data: body.projectIds.map((pid: string) => ({
          projectId: pid,
          resourceId: id,
        })),
      });
    }
  }

  // Tag associations
  if (body.tagIds !== undefined) {
    await prisma.resourceTag.deleteMany({ where: { resourceId: id } });
    if (body.tagIds.length > 0) {
      await prisma.resourceTag.createMany({
        data: body.tagIds.map((tid: string) => ({
          resourceId: id,
          tagId: tid,
        })),
      });
    }
  }

  const resource = await prisma.resource.update({
    where: { id },
    data,
    include: {
      projects: { include: { project: true } },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(resource);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.resource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
