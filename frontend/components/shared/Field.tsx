interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "focus-ring w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink shadow-sm";
