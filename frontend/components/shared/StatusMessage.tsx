export function StatusMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-line bg-white p-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
