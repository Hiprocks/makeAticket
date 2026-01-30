import { useEffect, useState } from 'react';
import type { TicketRow as TicketRowType } from '@/types';
import { TicketRow } from './TicketRow';
import { useTicketStore } from '@/store/useTicketStore';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Play } from 'lucide-react';
import { PreviewModal } from './PreviewModal';
import { ResultModal } from './ResultModal';
import { SubtaskModal } from './SubtaskModal';
import { useTicketCreation } from '@/hooks/useTicketCreation';

export function SpreadsheetTable() {
    const { rows, addRow, deleteRows } = useTicketStore();
    const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [activeParentRow, setActiveParentRow] = useState<TicketRowType | null>(null);

    const { startCreation, isCreating, progress, result, resetCreation } = useTicketCreation();

    // Auto-open result modal when creation starts or ends
    useEffect(() => {
        if (isCreating || result) {
            setResultModalOpen(true);
        }
    }, [isCreating, result]);

    const handleCloseResult = () => {
        setResultModalOpen(false);
        resetCreation();
    };

    const handleConfirmCreation = () => {
        setPreviewModalOpen(false);
        startCreation();
    };

    const handleAddSubtask = (row: TicketRowType) => {
        setActiveParentRow(row);
        setSubtaskModalOpen(true);
    };

    // Paste Logic
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Only handle paste if we aren't focused on an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const text = e.clipboardData?.getData('text');
            if (!text) return;

            const pastedRows = text.split('\n').filter(line => line.trim());
            pastedRows.forEach(line => {
                const parts = line.split('\t');
                addRow(undefined, {
                    summary: parts[0] || '',
                    description: parts[1] || ''
                });
            });

            e.preventDefault();
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [addRow]);

    return (
        <div className="flex flex-col h-full bg-white relative">
            <SubtaskModal
                open={subtaskModalOpen}
                onOpenChange={setSubtaskModalOpen}
                parentRow={activeParentRow}
            />

            <PreviewModal
                open={previewModalOpen}
                onOpenChange={setPreviewModalOpen}
                rows={rows}
                onConfirm={handleConfirmCreation}
            />

            <ResultModal
                open={resultModalOpen}
                onOpenChange={setResultModalOpen}
                isCreating={isCreating}
                progress={progress}
                result={result}
                onClose={handleCloseResult}
            />

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground mr-2">
                        Selected tickets: {rows.length}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => alert('Save draft')}>
                        Save draft
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => alert('Export CSV')}>
                        Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => alert('Import CSV')}>
                        Import CSV
                    </Button>
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[40px_100px_1fr_1fr_120px_100px_120px_120px_120px_80px] gap-0 border-b bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0 z-10">
                <div className="p-2 text-center">Sel</div>
                <div className="p-2">Type</div>
                <div className="p-2">Summary</div>
                <div className="p-2">Description</div>
                <div className="p-2">Assignee</div>
                <div className="p-2">Sprint</div>
                <div className="p-2">Start</div>
                <div className="p-2">Due</div>
                <div className="p-2">Parent</div>
                <div className="p-2 text-center">Action</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-auto">
                {rows.map((row) => (
                    <TicketRow
                        key={row.id}
                        row={row}
                        onAddSubtask={() => handleAddSubtask(row)}
                    />
                ))}

                {/* Add Row Button area */}
                <div className="p-2 border-b">
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-muted-foreground hover:text-primary"
                        onClick={() => addRow()}
                    >
                        <Plus className="w-4 h-4 mr-2" /> Add row
                    </Button>
                </div>
            </div>

            {/* Footer Toolbar */}
            <div className="flex items-center justify-between p-4 border-t bg-slate-50">
                <Button variant="destructive" size="sm" onClick={deleteRows}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete selected
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setPreviewModalOpen(true)}>Preview</Button>
                    <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setPreviewModalOpen(true)}>
                        <Play className="w-4 h-4 mr-2" /> Start creation
                    </Button>
                </div>
            </div>
        </div>
    );
}
