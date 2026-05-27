import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <h2 className="font-mono text-sm font-medium text-muted-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground/70">{body}</p>
      </CardContent>
    </Card>
  );
}
