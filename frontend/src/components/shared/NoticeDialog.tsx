import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

export function NoticeDialog({
  open,
  title,
  description,
  actionLabel,
  loading,
  onAction,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  loading?: boolean;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-amber-600/30 bg-panel p-5 shadow-panel-lg">
          <Dialog.Title className="font-mono text-base font-medium text-amber-400">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{description}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            {actionLabel && onAction ? (
              <Button type="button" variant="destructive" onClick={onAction} disabled={loading}>
                {loading ? "Working..." : actionLabel}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Close</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
