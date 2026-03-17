import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ProjectDetailClient } from "./project-detail-client";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      resources: {
        include: {
          resource: {
            include: {
              tags: { include: { tag: true } },
            },
          },
        },
      },
      _count: { select: { resources: true } },
    },
  });

  if (!project) notFound();

  const allTags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  const customFieldTemplates = JSON.parse(
    (project.customFieldTemplates as string) || "[]",
  );

  const resources = project.resources.map((pr) => ({
    ...pr.resource,
    tags: pr.resource.tags.map((rt) => rt.tag),
    customFields: JSON.parse((pr.resource.customFields as string) || "{}"),
    status: pr.status,
    starred: pr.starred,
  }));

  return (
    <ProjectDetailClient
      project={{
        ...project,
        customFieldTemplates,
        citationStyle: project.citationStyle,
      }}
      resources={resources}
      allTags={allTags}
    />
  );
}
