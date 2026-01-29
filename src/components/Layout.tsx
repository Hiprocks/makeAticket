import { useState } from 'react';
import { Header } from './Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsStore } from '@/store/useSettingsStore';

import { SettingsModal } from './SettingsModal';

import { SpreadsheetTable } from './SpreadsheetTable';
import { HistoryTable } from './HistoryTable';
// const HistoryTab = () => <div className="p-4">History Tab Content</div>;



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
                            <TabsTrigger value="create">생성</TabsTrigger>
                            <TabsTrigger value="history">기록</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="create" className="flex-1 border rounded-lg bg-background shadow-sm p-0 overflow-hidden flex flex-col">
                        <SpreadsheetTable />
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
