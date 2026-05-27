export function FormField({
  label,
  error,
  help,
  children
}: {
  label: string;
  error?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {help}
      </span>
      {children}
      {error ? <p className="font-mono text-[11px] text-destructive">{error}</p> : null}
    </label>
  );
}
