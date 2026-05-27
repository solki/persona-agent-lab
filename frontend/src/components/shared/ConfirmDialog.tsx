import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading,
  destructive = true,
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onCancel() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-sm border border-border bg-panel p-5 shadow-panel-lg">
          <Dialog.Title className="font-mono text-base font-medium text-foreground">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
              {loading ? "Working..." : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
