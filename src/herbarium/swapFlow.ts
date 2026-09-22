// 柜位对调 —— 流转层（登记 / 批准生效 / 驳回 / 撤回，状态机与持久化）
import { useSyncExternalStore } from "react";
import { loadState, resetState, saveState } from "./data";
import type { HerbariumState, PositionEvent, Specimen, SwapLeg, SwapOrder } from "./types";
import {
  canWithdraw,
  checkSwap,
  nowText,
  recheckPendingOrder,
  type CheckResult,
  type SwapDraft,
} from "./swapRules";

export interface SubmitOutcome {
  ok: boolean;
  order?: SwapOrder;
  result: CheckResult;
}

function makeOrderId(seq: number): string {
  return `SW-${String(seq).padStart(4, "0")}`;
}

/** 纯流转：由当前状态与申请产出下一状态，不碰存储与 React，便于整体复用 */
export function reducer(state: HerbariumState, action: SwapAction): HerbariumState {
  switch (action.type) {
    case "submit": {
      const result = checkSwap(state.specimens, state.swaps, action.draft);
      if (!result.ok) return state;

      const a = state.specimens.find((s) => s.id === action.draft.specimenAId)!;
      const b = state.specimens.find((s) => s.id === action.draft.specimenBId)!;
      const legs: [SwapLeg, SwapLeg] = [
        { specimenId: a.id, specimenNo: a.collectionNo, fromCode: a.positionCode!, toCode: action.draft.targetA.trim() },
        { specimenId: b.id, specimenNo: b.collectionNo, fromCode: b.positionCode!, toCode: action.draft.targetB.trim() },
      ];
      const order: SwapOrder = {
        id: makeOrderId(state.swapSeq),
        status: "待审",
        credential: action.draft.credential.trim(),
        operator: action.draft.operator.trim(),
        legs,
        createdAt: nowText(),
        decidedAt: null,
        rejectReasons: [],
      };
      return { ...state, swapSeq: state.swapSeq + 1, swaps: [order, ...state.swaps] };
    }

    case "approve": {
      const order = state.swaps.find((o) => o.id === action.orderId);
      if (!order || order.status !== "待审") return state;

      // 生效瞬间复核：任一条件不再满足则驳回，原柜位一律不动
      const recheck = recheckPendingOrder(state.specimens, state.swaps, order);
      if (!recheck.ok) {
        return reducer(state, { type: "reject", orderId: order.id, reasons: recheck.reasons });
      }

      const at = nowText();
      const move = new Map(order.legs.map((leg) => [leg.specimenId, leg.toCode]));
      const specimens = state.specimens.map((s): Specimen => {
        const toCode = move.get(s.id);
        if (!toCode || s.positionCode === toCode) return s;
        const event: PositionEvent = {
          at,
          from: s.positionCode,
          to: toCode,
          reason: `柜位对调 ${order.id}（凭据 ${order.credential}）`,
        };
        return { ...s, positionCode: toCode, positionHistory: [...s.positionHistory, event] };
      });
      const swaps = state.swaps.map((o): SwapOrder =>
        o.id === order.id ? { ...o, status: "已生效", decidedAt: at, rejectReasons: [] } : o,
      );
      return { ...state, specimens, swaps };
    }

    case "reject": {
      const at = nowText();
      const swaps = state.swaps.map((o): SwapOrder =>
        o.id === action.orderId && o.status === "待审"
          ? { ...o, status: "已驳回", decidedAt: at, rejectReasons: action.reasons }
          : o,
      );
      return { ...state, swaps };
    }

    case "withdraw": {
      const at = nowText();
      const swaps = state.swaps.map((o): SwapOrder =>
        o.id === action.orderId && canWithdraw(o)
          ? { ...o, status: "已撤回", decidedAt: at, rejectReasons: [] }
          : o,
      );
      return { ...state, swaps };
    }

    case "addSpecimen": {
      const id = `sp-${String(Date.now()).slice(-6)}`;
      const s: Specimen = {
        id,
        collectionNo: action.input.collectionNo,
        species: action.input.species,
        locality: action.input.locality,
        altitude: action.input.altitude,
        habitat: action.input.habitat,
        collector: action.input.collector,
        pressStatus: action.input.pressStatus,
        identification: action.input.identification,
        positionCode: null,
        loaned: false,
        needsPhoto: false,
        remark: action.input.remark,
        createdAt: nowText(),
        positionHistory: [],
      };
      return { ...state, specimens: [s, ...state.specimens] };
    }

    case "reset":
      return action.state ?? resetState();
  }
}

export interface NewSpecimenInput {
  collectionNo: string;
  species: string;
  locality: string;
  altitude: number | null;
  habitat: string;
  collector: string;
  pressStatus: Specimen["pressStatus"];
  identification: Specimen["identification"];
  remark: string;
}

export type SwapAction =
  | { type: "submit"; draft: SwapDraft }
  | { type: "approve"; orderId: string }
  | { type: "reject"; orderId: string; reasons: string[] }
  | { type: "withdraw"; orderId: string }
  | { type: "addSpecimen"; input: NewSpecimenInput }
  | { type: "reset"; state?: HerbariumState };

/** React 侧入口：持有持久化状态并暴露调换流转动作 */
export function createSwapStore(initial: HerbariumState) {
  let state = initial;
  const listeners = new Set<() => void>();

  function dispatch(action: SwapAction): SubmitOutcome | SwapOrder | undefined {
    if (action.type === "submit") {
      const result = checkSwap(state.specimens, state.swaps, action.draft);
      if (!result.ok) return { ok: false, result };
      state = reducer(state, action);
      const created = state.swaps[0];
      persist();
      listeners.forEach((l) => l());
      return { ok: true, order: created, result };
    }

    const before = state;
    state = reducer(state, action);
    if (state !== before) {
      persist();
      listeners.forEach((l) => l());
    }
    if (action.type === "approve") return state.swaps.find((o) => o.id === action.orderId);
    return undefined;
  }

  function persist() {
    saveState(state);
  }

  function getState(): HerbariumState {
    return state;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { dispatch, getState, subscribe, persist };
}

export type SwapStore = ReturnType<typeof createSwapStore>;

// 模块级单例：浏览器刷新后从 localStorage 重新载入，调换历史与柜位记录仍在
let store: SwapStore | null = null;

export function getStore(): SwapStore {
  if (!store) store = createSwapStore(loadState());
  return store;
}

/** 读取当前馆藏与调换单状态，并在其变更时重渲染 */
export function useHerbariumState(): HerbariumState {
  const s = getStore();
  return useSyncExternalStore(
    (onChange) => s.subscribe(onChange),
    () => s.getState(),
  );
}

export function useSwapStore(): SwapStore {
  return getStore();
}

export { loadState };
