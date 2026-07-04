"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SidebarNav } from "@/components/sidebar-nav";

export function MobileNavDrawer({ role }: { role: "admin" | "atendente" }) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="left">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Abrir menu"
        className="lg:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu strokeWidth={1.75} />
      </Button>
      <DrawerContent className="[--drawer-content-width:15rem]">
        <DrawerHeader>
          <DrawerTitle>CRM Viagente</DrawerTitle>
        </DrawerHeader>
        <SidebarNav role={role} onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}
