import { prisma } from "@/lib/db";
import Link from "next/link";
import { FolderOpen, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TYPE_META,
  RESOURCE_TYPES,
  type ResourceType,
} from "@/lib/resource-types";

export default async function DashboardPage() {
  const [projects, recentResources, totalResources, totalTags, typeCounts] =
    await Promise.all([
      prisma.project.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { _count: { select: { resources: true } } },
      }),
      prisma.resource.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          projects: { include: { project: true } },
          tags: { include: { tag: true } },
        },
      }),
      prisma.resource.count(),
      prisma.tag.count(),
      Promise.all(
        RESOURCE_TYPES.map(async (type) => ({
          type,
          count: await prisma.resource.count({
            where: { resourceType: type },
          }),
        })),
      ),
    ]);

  const nonZeroCounts = typeCounts.filter((tc) => tc.count > 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Your research library at a glance
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/resources/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Resource
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Resources</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{totalResources}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{projects.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tags</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{totalTags}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>By Type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {nonZeroCounts.map(({ type, count }) => {
                const meta = TYPE_META[type as ResourceType];
                return (
                  <Badge
                    key={type}
                    variant="secondary"
                    className="gap-1 text-xs"
                    style={{ color: meta.color }}
                  >
                    <meta.icon className="h-3 w-3" />
                    {count}
                  </Badge>
                );
              })}
              {nonZeroCounts.length === 0 && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Overview */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Projects</h2>
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {projects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="mb-1 text-sm font-medium">No projects yet</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Create a project to start organising your resources
              </p>
              <Link href="/projects">
                <Button size="sm" variant="outline">
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {project.description && (
                      <CardDescription className="line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">
                      {project._count.resources}{" "}
                      {project._count.resources === 1
                        ? "resource"
                        : "resources"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Resources */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Resources</h2>
        {recentResources.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="mb-1 text-sm font-medium">No resources yet</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Import your first paper or add a resource to get started
              </p>
              <Link href="/resources/new">
                <Button size="sm" variant="outline">
                  Add Resource
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentResources.map((resource) => {
              const meta = TYPE_META[resource.resourceType as ResourceType];
              const TypeIcon = meta?.icon;
              const tf = JSON.parse(resource.typeFields || "{}");
              const subtitle = tf.authors
                ? `${tf.authors}${tf.year ? ` · ${tf.year}` : ""}`
                : resource.url || "";

              return (
                <Link key={resource.id} href={`/resources/${resource.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="flex items-center justify-between py-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {TypeIcon && (
                          <TypeIcon
                            className="h-4 w-4 shrink-0"
                            style={{ color: meta.color }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {resource.title}
                          </p>
                          {subtitle && (
                            <p className="truncate text-xs text-muted-foreground">
                              {subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="ml-4 flex flex-shrink-0 items-center gap-2">
                        {resource.tags.map(({ tag }) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-xs"
                            style={
                              tag.color
                                ? { borderColor: tag.color, color: tag.color }
                                : undefined
                            }
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
