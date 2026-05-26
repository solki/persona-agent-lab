export const PROPOSED_MEMORY_NOTIFICATION_EVENT = "proposed-memory-notifications:changed";

export function NotificationBadge({
  count,
  label = "Pending feedback memory approval",
  compact = false
}: {
  count: number;
  label?: string;
  compact?: boolean;
}) {
  if (count <= 0) {
    return null;
  }

  const display = count > 99 ? "99+" : String(count);

  if (compact) {
    return (
      <span
        aria-label={`${label}: ${display}`}
        title={label}
        className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-red-600"
      />
    );
  }

  return (
    <span
      aria-label={`${label}: ${display}`}
      title={label}
      className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
    >
      {display}
    </span>
  );
}

export function notifyProposedMemoryNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROPOSED_MEMORY_NOTIFICATION_EVENT));
  }
}
