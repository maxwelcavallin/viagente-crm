"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  FileText,
  Home,
  ListChecks,
  MessagesSquare,
  Smartphone,
  Tag,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/negocios", label: "Negócios", icon: Briefcase },
  { href: "/atendimento", label: "Atendimento", icon: MessagesSquare },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/admin/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { href: "/admin/pipelines", label: "Pipelines", icon: Workflow, adminOnly: true },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: Smartphone, adminOnly: true },
  { href: "/admin/campos", label: "Campos", icon: ListChecks, adminOnly: true },
  { href: "/admin/tags", label: "Tags", icon: Tag, adminOnly: true },
  { href: "/admin/templates", label: "Templates", icon: FileText, adminOnly: true },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook, adminOnly: true },
];

export function SidebarNav({
  role,
  onNavigate,
  className,
}: {
  role: "admin" | "atendente";
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  return (
    <nav className={cn("flex flex-col gap-1 p-3", className)}>
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon size={20} strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
