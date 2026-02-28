"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileText, FolderOpen, Search, Plus } from "lucide-react";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd+K → search
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // Cmd+N → new paper
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        router.push("/resources/new");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [router]);

  const navigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search resources, projects, or type a command..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => navigate("/resources/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Resource
          </CommandItem>
          <CommandItem onSelect={() => navigate("/projects")}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Browse Projects
          </CommandItem>
          <CommandItem onSelect={() => navigate("/search")}>
            <Search className="mr-2 h-4 w-4" />
            Search Resources
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
