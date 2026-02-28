import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { resources: true } } },
  });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const body = await request.json();
  const tag = await prisma.tag.create({
    data: {
      name: body.name,
      color: body.color || null,
    },
  });
  return NextResponse.json(tag, { status: 201 });
}
