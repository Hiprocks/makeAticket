/**
 * DoD Automation Store - v2.0
 * Plan v1.2 기준 상태 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';
import { indexedDbStorage } from '../lib/indexedDbStorage';
import type {
  ConfluenceData,
  DoDExtraction,
  DoDPart,
  PlannedTask,
  ExistingTask,
  CreationResult,
} from '../types';

interface DoDStore {
  // Current step (1, 2, or 3)
  currentStep: 1 | 2 | 3;

  // Step 1: Confluence Data
  confluenceData: ConfluenceData | null;

  // Step 2: DoD Extraction Result
  extraction: DoDExtraction | null;

  // Step 3: Task Creation
  selectedTasks: Set<string>; // 선택된 Task prefix 목록
  creationResults: CreationResult[];
  isCreating: boolean;

  // Actions
  setCurrentStep: (step: 1 | 2 | 3) => void;
  setConfluenceData: (data: ConfluenceData) => void;
  setExtraction: (data: DoDExtraction) => void;
  toggleTask: (prefix: string) => void;
  selectAllTasks: () => void;
  deselectAllTasks: () => void;
  setCreationResults: (results: CreationResult[]) => void;
  setIsCreating: (isCreating: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1 as const,
  confluenceData: null,
  extraction: null,
  selectedTasks: new Set<string>(),
  creationResults: [],
  isCreating: false,
};

export const useDoDStore = create<DoDStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentStep: (step) => set({ currentStep: step }),

      setConfluenceData: (data) =>
        set({
          confluenceData: data,
          currentStep: 1,
        }),

      setExtraction: (data) => {
        console.log('💾 [Store] setExtraction 호출됨');
        console.log('💾 [Store] data:', data);
        console.log('💾 [Store] currentStep을 2로 변경');
        set({
          extraction: data,
          currentStep: 2,
        });
        console.log('💾 [Store] setExtraction 완료');
      },

      toggleTask: (prefix) =>
        set((state) => {
          const newSelected = new Set(state.selectedTasks);
          if (newSelected.has(prefix)) {
            newSelected.delete(prefix);
          } else {
            newSelected.add(prefix);
          }
          return { selectedTasks: newSelected };
        }),

      selectAllTasks: () =>
        set((state) => {
          if (!state.extraction) return {};
          const allPrefixes = state.extraction.plannedTasks.map((t) => t.prefix);
          return { selectedTasks: new Set(allPrefixes) };
        }),

      deselectAllTasks: () =>
        set({ selectedTasks: new Set() }),

      setCreationResults: (results) =>
        set({ creationResults: results, isCreating: false }),

      setIsCreating: (isCreating) =>
        set({ isCreating }),

      reset: () => set(initialState),
    }),
    {
      name: 'jbc-dod-v2',
      storage: createJSONStorage(() => indexedDbStorage),
      // Set은 JSON.stringify가 안 되므로 변환 필요
      partialize: (state) => ({
        ...state,
        selectedTasks: Array.from(state.selectedTasks),
      }),
      // @ts-ignore - Set 복원
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        selectedTasks: new Set(persistedState?.selectedTasks || []),
      }),
    }
  )
);
