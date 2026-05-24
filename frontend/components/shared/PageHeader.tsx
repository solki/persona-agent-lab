import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function PageHeader({ title, description, actionHref, actionLabel }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-ink">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <Link className="focus-ring rounded bg-accent px-4 py-2 text-sm font-medium text-white" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </header>
  );
}
