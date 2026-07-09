import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS_NAV_ITEMS } from "@/lib/settings-nav-items";

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full transition-colors hover:bg-muted">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <Icon size={20} strokeWidth={1.75} className="text-muted-foreground" />
                  <CardTitle className="text-base">{item.label}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
