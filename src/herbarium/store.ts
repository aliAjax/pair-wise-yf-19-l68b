import { useSyncExternalStore } from "react";
import type { AppState } from "./types";
import { createInitialState } from "./seed";
import {
  receiveSpecimen,
  resolveSwap,
  shelveSpecimen,
  setIdentifyStatus,
  submitSwap,
  toggleLoan,
  withdrawSwap,
  type ReceiveDraft,
} from "./swapFlow";
import type { SwapDraft } from "./swapRules";

/**
 * 全局状态 + localStorage 持久化：
 * 柜位记录、地点卡、对调历史都来自同一份状态，刷新浏览器后仍在。
 */

const STORAGE_KEY = "herbarium-intake-state-v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.specimens) && Array.isArray(parsed.cabinets) && Array.isArray(parsed.swaps)) {
        return parsed;
      }
    }
  } catch {
    // 存储损坏时回退种子数据
  }
  return createInitialState();
}

let state: AppState = loadState();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式等场景下降级为仅内存
  }
}

function setState(next: AppState) {
  state = next;
  persist();
  listeners.forEach((listener) => listener());
}

export const store = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  submitSwap(draft: SwapDraft) {
    const result = submitSwap(state, draft);
    setState(result.state);
    return result.swap;
  },
  resolveSwap(swapId: string) {
    const result = resolveSwap(state, swapId);
    setState(result.state);
    return { swap: result.swap, effective: result.effective };
  },
  withdrawSwap(swapId: string) {
    const result = withdrawSwap(state, swapId);
    setState(result.state);
  },
  receive(draft: ReceiveDraft) {
    setState(receiveSpecimen(state, draft));
  },
  shelve(specimenId: string, cabinetId: string) {
    setState(shelveSpecimen(state, specimenId, cabinetId));
  },
  setIdentify(specimenId: string, status: AppState["specimens"][number]["identifyStatus"]) {
    setState(setIdentifyStatus(state, specimenId, status));
  },
  toggleLoan(specimenId: string, onLoan: boolean) {
    setState(toggleLoan(state, specimenId, onLoan));
  },
  resetDemo() {
    setState(createInitialState());
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
