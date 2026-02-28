"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen,
  Tags,
  Search,
  Plus,
  Moon,
  Sun,
  Library,
  LayoutDashboard,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PROJECT_COLORS = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#ef4444",
];

function getProjectColor(index: number, customColor?: string | null): string {
  return customColor || PROJECT_COLORS[index % PROJECT_COLORS.length];
}

function getProjectInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

interface SidebarProject {
  id: string;
  name: string;
  color?: string | null;
  _count?: { resources: number };
}

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [projects, setProjects] = React.useState<SidebarProject[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch(() => {});
  }, [pathname]);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderOpen },
    { href: "/tags", label: "Tags", icon: Tags },
    { href: "/search", label: "Search", icon: Search },
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-52 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
          <Library className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-base font-bold tracking-tight">PaperTrail</span>
      </div>

      <Separator />

      {/* New Resource */}
      <div className="px-2.5 py-2.5">
        <Link href="/resources/new">
          <Button
            className="w-full justify-start gap-1.5 h-8 text-xs"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" />
            New Resource
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <Separator className="my-3" />

        {/* Projects */}
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Projects
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/projects">
                <Button variant="ghost" size="icon" className="h-4 w-4">
                  <Plus className="h-2.5 w-2.5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">New Project</TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-0.5">
          {projects.length === 0 && (
            <p className="px-2 py-1.5 text-[10px] text-muted-foreground">
              No projects yet
            </p>
          )}
          {projects.map((project, index) => {
            const isActive = pathname === `/projects/${project.id}`;
            const projectColor = getProjectColor(index, project.color);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <div
                  className="h-4 w-4 shrink-0 rounded flex items-center justify-center text-[8px] font-bold"
                  style={{
                    backgroundColor: projectColor + "20",
                    color: projectColor,
                  }}
                >
                  {getProjectInitial(project.name)}
                </div>
                <span className="truncate flex-1 text-xs">{project.name}</span>
                {project._count && (
                  <span className="text-[10px] text-muted-foreground">
                    {project._count.resources}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <Separator />

      {/* Theme Toggle */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[10px] text-muted-foreground">Theme</span>
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
