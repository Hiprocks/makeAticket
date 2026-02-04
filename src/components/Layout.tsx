import { useState } from 'react';
import { Header } from './Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsModal } from './SettingsModal';
import { SpreadsheetTable } from './SpreadsheetTable';
import { HistoryTable } from './HistoryTable';
import { EditTable } from './EditTable';

export function Layout() {
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('create');

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Header onOpenSettings={() => setSettingsOpen(true)} />

            <main className="flex-1 container mx-auto p-6 max-w-[1600px]">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <TabsList>
                            <TabsTrigger value="create">Create</TabsTrigger>
                            <TabsTrigger value="edit">Edit</TabsTrigger>
                            <TabsTrigger value="history">History</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="create" className="flex-1 border rounded-lg bg-background shadow-sm p-0 overflow-hidden flex flex-col">
                        <SpreadsheetTable />
                    </TabsContent>

                    <TabsContent value="edit" className="flex-1 border rounded-lg bg-background shadow-sm p-0 overflow-hidden flex flex-col">
                        <EditTable />
                    </TabsContent>

                    <TabsContent value="history" className="flex-1 border rounded-lg bg-background shadow-sm p-0 overflow-hidden flex flex-col">
                        <HistoryTable />
                    </TabsContent>
                </Tabs>
            </main>

            <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
    );
}
