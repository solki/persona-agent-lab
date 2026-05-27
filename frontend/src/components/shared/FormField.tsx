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
    <label className="block space-y-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </label>
  );
}
