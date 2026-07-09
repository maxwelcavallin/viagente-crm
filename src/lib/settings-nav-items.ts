import {
  CalendarClock,
  FileText,
  ListChecks,
  Smartphone,
  Tag,
  Upload,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type SettingsNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { href: "/configuracoes/usuarios", label: "Usuários", icon: Users },
  { href: "/configuracoes/pipelines", label: "Pipelines e Etapas", icon: Workflow },
  { href: "/configuracoes/campos", label: "Campos Customizados", icon: ListChecks },
  { href: "/configuracoes/tags", label: "Tags", icon: Tag },
  { href: "/configuracoes/whatsapp", label: "WhatsApp — Canais e Acesso", icon: Smartphone },
  { href: "/configuracoes/templates", label: "Templates de Mensagem", icon: FileText },
  { href: "/configuracoes/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/configuracoes/importacao", label: "Importação de Dados", icon: Upload },
  { href: "/configuracoes/google-agenda", label: "Google Agenda", icon: CalendarClock },
];
