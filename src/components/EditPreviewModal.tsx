import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { EditRow } from "@/types";

interface EditPreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rows: EditRow[];
    onConfirm: () => void;
}

export function EditPreviewModal({ open, onOpenChange, rows, onConfirm }: EditPreviewModalProps) {
    const diffRows = rows.filter(
        (row) => row.summary !== row.originalSummary || row.description !== row.originalDescription
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Edit preview ({diffRows.length})</DialogTitle>
                </DialogHeader>

                <div className="py-4 flex-1 overflow-y-auto space-y-4">
                    {diffRows.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-8">
                            No changes selected.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {diffRows.map((row) => (
                                <div key={row.id} className="border rounded-md p-3 bg-slate-50">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        {row.key} / {row.type}
                                    </div>
                                    <div className="space-y-3">
                                        {row.summary !== row.originalSummary && (
                                            <div className="text-sm">
                                                <div className="font-medium mb-2">Summary</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Before</div>
                                                        <pre className="text-xs font-mono bg-white border rounded p-2 whitespace-pre-wrap">{row.originalSummary || '-'}</pre>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">After</div>
                                                        <pre className="text-xs font-mono bg-white border rounded p-2 whitespace-pre-wrap">{row.summary || '-'}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {row.description !== row.originalDescription && (
                                            <div className="text-sm">
                                                <div className="font-medium mb-2">Description</div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">Before</div>
                                                        <pre className="text-xs font-mono bg-white border rounded p-2 whitespace-pre-wrap">{row.originalDescription || '-'}</pre>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground mb-1">After</div>
                                                        <pre className="text-xs font-mono bg-white border rounded p-2 whitespace-pre-wrap">{row.description || '-'}</pre>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onConfirm} disabled={diffRows.length === 0}>Confirm update</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
