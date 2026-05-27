import { Label } from "@/components/ui/label";

export function FormField({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="font-mono text-[11px] text-destructive">{error}</p> : null}
    </label>
  );
}
