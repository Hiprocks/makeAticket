import { Settings } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface HeaderProps {
    onOpenSettings: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
    return (
        <header className="flex h-16 items-center justify-between border-b px-6 bg-background">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold">
                    J
                </div>
                <h1 className="text-xl font-semibold">Jira Bulk Creator</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                <Settings className="h-5 w-5" />
            </Button>
        </header>
    );
}
