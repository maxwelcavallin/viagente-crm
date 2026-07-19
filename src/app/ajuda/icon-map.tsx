import {
  Bell,
  CalendarClock,
  FileText,
  HelpCircle,
  Kanban,
  LayoutDashboard,
  Link2,
  ListChecks,
  Mail,
  MessagesSquare,
  Sparkles,
  Star,
  Tag,
  Terminal,
  Upload,
  UserCog,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { LinkedinIcon } from "@/components/icons/linkedin-icon";

// Nome do ícone vem do banco (help_categories.icon, só o seed script escreve
// esse valor) — mapeado aqui pro componente real. Ícone desconhecido cai no
// HelpCircle genérico em vez de quebrar a página.
const ICONS: Record<string, LucideIcon> = {
  MessagesSquare,
  Kanban,
  Users,
  ListChecks,
  CalendarClock,
  Mail,
  Star,
  Bell,
  LayoutDashboard,
  Linkedin: LinkedinIcon,
  UserCog,
  Workflow,
  Tag,
  FileText,
  Link2,
  Webhook,
  Upload,
  Sparkles,
  Terminal,
};

export function HelpCategoryIcon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name] ?? HelpCircle;
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}
