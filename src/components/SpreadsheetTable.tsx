import { useEffect, useState } from 'react';
import type { TicketRow as TicketRowType } from '@/types';
import { TicketRow } from './TicketRow';
import { useTicketStore } from '@/store/useTicketStore';
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Play, Users } from 'lucide-react';
import { PreviewModal } from './PreviewModal';
import { ResultModal } from './ResultModal';
import { SubtaskModal } from './SubtaskModal';
import { UsersModal } from './UsersModal';
import { useTicketCreation } from '@/hooks/useTicketCreation';
import { downloadJson, pickJsonFile } from '@/lib/fileStorage';

export function SpreadsheetTable() {
    const { rows, addRow, deleteRows, replaceRowsFromImport } = useTicketStore();
    const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [activeParentRow, setActiveParentRow] = useState<TicketRowType | null>(null);
    const [usersModalOpen, setUsersModalOpen] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    const { startCreation, startCreationDebug, isCreating, progress, result, resetCreation } = useTicketCreation();

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

    const handleDebugConfirmCreation = () => {
        setPreviewModalOpen(false);
        startCreationDebug();
    };

    const validateBeforeCreate = () => {
        const selected = rows.filter(r => r.selected);
        const missingSummary = selected.filter(r => !r.summary.trim());
        if (missingSummary.length > 0) {
            setValidationMessage('Summary is required for all selected rows.');
            return false;
        }
        setValidationMessage(null);
        return true;
    };

    const handleExportDraft = () => {
        downloadJson('jbc-draft.json', { version: 1, rows });
    };

    const handleImportDraft = async () => {
        try {
            const data = await pickJsonFile();
            const imported = Array.isArray((data as any)?.rows) ? (data as any).rows : data;
            replaceRowsFromImport(Array.isArray(imported) ? imported : []);
        } catch (err: any) {
            alert(`Import failed: ${err.message || err}`);
        }
    };

    const handleAddSubtask = (row: TicketRowType) => {
        setActiveParentRow(row);
        setSubtaskModalOpen(true);
    };

    // Paste is handled per-cell to support multi-row/column pastes.

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
                onDebugConfirm={handleDebugConfirmCreation}
            />

            <ResultModal
                open={resultModalOpen}
                onOpenChange={setResultModalOpen}
                isCreating={isCreating}
                progress={progress}
                result={result}
                onClose={handleCloseResult}
            />
            <UsersModal open={usersModalOpen} onOpenChange={setUsersModalOpen} />

            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground mr-2">
                        Selected tickets: {rows.length}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleExportDraft}>
                        Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleImportDraft}>
                        Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setUsersModalOpen(true)}>
                        <Users className="h-4 w-4 mr-1" /> Users
                    </Button>
                </div>
            </div>
            {validationMessage && (
                <div className="px-4 py-2 text-sm text-amber-700 bg-amber-50 border-b">
                    {validationMessage}
                </div>
            )}

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
                {rows.map((row, index) => (
                    <TicketRow
                        key={row.id}
                        row={row}
                        index={index}
                        onAddSubtask={() => handleAddSubtask(row)}
                        onOpenUsers={() => setUsersModalOpen(true)}
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
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (validateBeforeCreate()) setPreviewModalOpen(true);
                        }}
                    >
                        Preview
                    </Button>
                    <Button
                        className="bg-primary text-white hover:bg-primary/90"
                        onClick={() => {
                            if (validateBeforeCreate()) setPreviewModalOpen(true);
                        }}
                    >
                        <Play className="w-4 h-4 mr-2" /> Start creation
                    </Button>
                </div>
            </div>
        </div>
    );
}
