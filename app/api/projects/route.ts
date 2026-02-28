import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { resources: true } },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description || null,
      customFieldTemplates: body.customFieldTemplates
        ? JSON.stringify(body.customFieldTemplates)
        : "[]",
    },
  });
  return NextResponse.json(project, { status: 201 });
}
