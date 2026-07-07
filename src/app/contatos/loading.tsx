import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ContatosLoading() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contatos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Contatos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-9 w-full max-w-sm" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
