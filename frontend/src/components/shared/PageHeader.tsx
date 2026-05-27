import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <Link to={actionHref}>
          <Button type="button">{actionLabel}</Button>
        </Link>
      ) : null}
    </div>
  );
}
