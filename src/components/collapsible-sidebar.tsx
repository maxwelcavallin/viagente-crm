"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SidebarNav } from "@/components/sidebar-nav";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "sidebar-collapsed";

export function CollapsibleSidebar({ role }: { role: "admin" | "atendente" }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border transition-[width] duration-150 lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex-1 overflow-y-auto">
        <SidebarNav role={role} collapsed={collapsed} />
      </div>
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
        className="flex shrink-0 items-center justify-center gap-2 border-t border-border p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {collapsed ? (
          <ChevronRight size={16} strokeWidth={1.75} />
        ) : (
          <>
            <ChevronLeft size={16} strokeWidth={1.75} />
            <span className="text-xs">Minimizar</span>
          </>
        )}
      </button>
    </aside>
  );
}
