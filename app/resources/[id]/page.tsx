import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ResourceDetailClient } from "./resource-detail-client";

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const resource = await prisma.resource.findUnique({
    where: { id },
    include: {
      projects: { include: { project: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!resource) notFound();

  // Fetch all resource titles for wiki-link resolution
  const allResources = await prisma.resource.findMany({
    select: { id: true, title: true },
  });

  const defaultCitationStyle =
    resource.projects[0]?.project?.citationStyle ?? "bibtex";

  return (
    <ResourceDetailClient
      resource={{
        ...resource,
        tags: resource.tags.map((rt) => rt.tag),
        projects: resource.projects.map((pr) => pr.project),
      }}
      allResources={allResources}
      defaultCitationStyle={defaultCitationStyle}
    />
  );
}
