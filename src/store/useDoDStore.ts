/**
 * DoD Automation Store
 * Manages state for DoD extraction and Jira ticket creation workflow
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';
import { indexedDbStorage } from '../lib/indexedDbStorage';
import type {
  DoDItem,
  DoDExtractionResult,
  DoDCreatedTicket,
  DoDAutomationRecord,
} from '../types';

interface DoDStore {
  // Step 1: Confluence Input
  pageUrl: string;
  pageId: string;
  pageTitle: string;
  pageHtml: string;

  // Step 2: DoD Review
  extractionResult: DoDExtractionResult | null;
  reviewedItems: DoDItem[];

  // Step 3: Task Creation
  creationProgress: {
    total: number;
    current: number;
    status: 'idle' | 'creating' | 'completed' | 'failed';
  };
  createdTickets: DoDCreatedTicket[];

  // History
  records: DoDAutomationRecord[];

  // Current step (1, 2, or 3)
  currentStep: 1 | 2 | 3;

  // Actions
  setPageUrl: (url: string) => void;
  setPageId: (id: string) => void;
  setPageData: (title: string, html: string) => void;
  setExtractionResult: (result: DoDExtractionResult) => void;
  setReviewedItems: (items: DoDItem[]) => void;
  updateReviewedItem: (id: string, updates: Partial<DoDItem>) => void;
  deleteReviewedItem: (id: string) => void;
  setCurrentStep: (step: 1 | 2 | 3) => void;
  startCreation: (totalCount: number) => void;
  updateCreationProgress: (current: number) => void;
  completeCreation: () => void;
  failCreation: () => void;
  addCreatedTicket: (ticket: DoDCreatedTicket) => void;
  saveRecord: () => void;
  resetWorkflow: () => void;
}

export const useDoDStore = create<DoDStore>()(
  persist(
    (set, get) => ({
      // Initial state
      pageUrl: '',
      pageId: '',
      pageTitle: '',
      pageHtml: '',
      extractionResult: null,
      reviewedItems: [],
      creationProgress: {
        total: 0,
        current: 0,
        status: 'idle',
      },
      createdTickets: [],
      records: [],
      currentStep: 1,

      // Actions
      setPageUrl: (url) => set({ pageUrl: url }),

      setPageId: (id) => set({ pageId: id }),

      setPageData: (title, html) =>
        set({ pageTitle: title, pageHtml: html }),

      setExtractionResult: (result) =>
        set({
          extractionResult: result,
          reviewedItems: result.items,
          currentStep: 2,
        }),

      setReviewedItems: (items) => set({ reviewedItems: items }),

      updateReviewedItem: (id, updates) =>
        set((state) => ({
          reviewedItems: state.reviewedItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),

      deleteReviewedItem: (id) =>
        set((state) => ({
          reviewedItems: state.reviewedItems.filter((item) => item.id !== id),
        })),

      setCurrentStep: (step) => set({ currentStep: step }),

      startCreation: (totalCount) =>
        set({
          creationProgress: {
            total: totalCount,
            current: 0,
            status: 'creating',
          },
          createdTickets: [],
          currentStep: 3,
        }),

      updateCreationProgress: (current) =>
        set((state) => ({
          creationProgress: {
            ...state.creationProgress,
            current,
          },
        })),

      completeCreation: () =>
        set((state) => ({
          creationProgress: {
            ...state.creationProgress,
            status: 'completed',
          },
        })),

      failCreation: () =>
        set((state) => ({
          creationProgress: {
            ...state.creationProgress,
            status: 'failed',
          },
        })),

      addCreatedTicket: (ticket) =>
        set((state) => ({
          createdTickets: [...state.createdTickets, ticket],
        })),

      saveRecord: () => {
        const state = get();
        const successCount = state.createdTickets.filter(
          (t) => t.status === 'success'
        ).length;
        const failCount = state.createdTickets.filter(
          (t) => t.status === 'failed'
        ).length;

        // Group by Epic to count unique Epics
        const uniqueEpics = new Set(
          state.createdTickets
            .filter((t) => t.epicKey)
            .map((t) => t.epicKey)
        );

        const record: DoDAutomationRecord = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          pageTitle: state.pageTitle,
          pageUrl: state.pageUrl,
          epicCount: uniqueEpics.size,
          taskCount: state.createdTickets.length,
          successCount,
          failCount,
          tickets: state.createdTickets,
        };

        set((state) => ({
          records: [record, ...state.records],
        }));
      },

      resetWorkflow: () =>
        set({
          pageUrl: '',
          pageId: '',
          pageTitle: '',
          pageHtml: '',
          extractionResult: null,
          reviewedItems: [],
          creationProgress: {
            total: 0,
            current: 0,
            status: 'idle',
          },
          createdTickets: [],
          currentStep: 1,
        }),
    }),
    {
      name: 'jbc-dod',
      storage: createJSONStorage(() => indexedDbStorage),
    }
  )
);
