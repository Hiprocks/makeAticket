import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Settings, JiraUser, JiraSprint } from '@/types';
import { getPersistStorage } from '@/lib/indexedDbStorage';

interface SettingsState extends Settings {
    users: JiraUser[];
    sprints: JiraSprint[];
    setConnection: (config: Partial<Settings>) => void;
    setDefaults: (defaults: Partial<Settings>) => void;
    setCache: (data: { users?: JiraUser[]; sprints?: JiraSprint[] }) => void;
    updateLastSubtaskTypes: (types: string[]) => void;
    resetSettings: () => void;
    clearCache: () => void;
}

const defaultSettings: Settings = {
    projectKey: '',
    defaultType: 'Task',
    defaultSprintId: '',
    users: [],
    sprints: [],
    lastSubtaskTypes: [],
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            ...defaultSettings,
            setConnection: (config) => set((state) => ({ ...state, ...config })),
            setDefaults: (defaults) => set((state) => ({ ...state, ...defaults })),
            setCache: (data) => set((state) => ({ ...state, ...data })),
            updateLastSubtaskTypes: (types) => set({ lastSubtaskTypes: types }),
            resetSettings: () => set(defaultSettings),
            clearCache: () => set({ users: [], sprints: [] }),
        }),
        {
            name: 'jbc-settings',
            storage: createJSONStorage(() => getPersistStorage()),
        }
    )
);
