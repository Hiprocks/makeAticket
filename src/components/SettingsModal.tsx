import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Settings } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const settings = useSettingsStore();
    const { register, handleSubmit, setValue, reset } = useForm<Settings>({
        defaultValues: settings
    });

    useEffect(() => {
        if (open) {
            reset(settings);
        }
    }, [open, settings, reset]);

    const onSubmit = (data: Settings) => {
        settings.setConnection(data);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <Tabs defaultValue="connection" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="connection">Connection</TabsTrigger>
                            <TabsTrigger value="defaults">Defaults</TabsTrigger>
                            <TabsTrigger value="data">Data</TabsTrigger>
                        </TabsList>

                        {/* Jira Connection Tab */}
                        <TabsContent value="connection" className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="projectKey">Project key</Label>
                                <Input id="projectKey" placeholder="AEGIS" {...register('projectKey')} />
                                <p className="text-xs text-muted-foreground">
                                    Jira URL and credentials are read from the server .env.
                                </p>
                            </div>
                        </TabsContent>

                        {/* Defaults Tab */}
                        <TabsContent value="defaults" className="space-y-4">
                            <div className="space-y-2">
                                <Label>Default issue type</Label>
                                <Select
                                    onValueChange={(val: 'Epic' | 'Task') => setValue('defaultType', val)}
                                    defaultValue={settings.defaultType}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Task">Task</SelectItem>
                                        <SelectItem value="Epic">Epic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Default sprint</Label>
                                <Select
                                    onValueChange={(val: string) => setValue('defaultSprintId', val)}
                                    defaultValue={settings.defaultSprintId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Active sprint (auto)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Active sprint (auto)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </TabsContent>

                        {/* Data Tab */}
                        <TabsContent value="data" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Button type="button" variant="outline" onClick={() => alert('Not implemented')}>
                                    Load users
                                </Button>
                                <Button type="button" variant="outline" onClick={() => alert('Not implemented')}>
                                    Load sprints
                                </Button>
                            </div>
                            <div className="border-t pt-4 mt-4">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => {
                                        if (confirm('Reset all settings?')) {
                                            settings.resetSettings();
                                            onOpenChange(false);
                                        }
                                    }}
                                >
                                    Reset settings
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
