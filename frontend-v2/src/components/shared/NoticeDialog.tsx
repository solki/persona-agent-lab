import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

export function NoticeDialog({
  open,
  title,
  description,
  onClose
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-md border border-amber-200 bg-white p-5 shadow-lg">
          <Dialog.Title className="text-lg font-semibold text-amber-900">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{description}</Dialog.Description>
          <div className="mt-5 flex justify-end">
            <Button type="button" onClick={onClose}>Close</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
