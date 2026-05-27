import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
