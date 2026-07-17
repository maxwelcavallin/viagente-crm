import {
  CalendarClock,
  FileText,
  KeyRound,
  ListChecks,
  ListOrdered,
  Smile,
  Tag,
  Upload,
  Users,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LinkedinIcon } from "@/components/icons/linkedin-icon";
import { WhatsappIcon } from "@/components/icons/whatsapp-icon";

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
  { href: "/configuracoes/automacoes", label: "Automações", icon: Zap },
  { href: "/configuracoes/sequencias", label: "Sequências", icon: ListOrdered },
  { href: "/configuracoes/nps", label: "Pós-venda / NPS", icon: Smile },
  { href: "/configuracoes/whatsapp", label: "Conexão de canais", icon: WhatsappIcon },
  { href: "/configuracoes/linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { href: "/configuracoes/templates", label: "Templates de Mensagem", icon: FileText },
  { href: "/configuracoes/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/configuracoes/importacao", label: "Importação de Dados", icon: Upload },
  { href: "/configuracoes/google-agenda", label: "Google Agenda", icon: CalendarClock },
  { href: "/configuracoes/api", label: "API", icon: KeyRound },
];
