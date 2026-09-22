import type { AppState, Specimen, SwapRequest } from "./types";
import { checkSwap, isCabinetLocked, isCabinetOccupied, type SwapDraft } from "./swapRules";

/**
 * 业务文件二：柜位对调流转
 * 只做状态迁移（纯函数），由 store 负责落盘；判定细节委托 swapRules。
 *
 * 流转：登记(pending，锁住两柜两件) → 复核生效 / 撤回(withdrawn)
 * 生效是整批原子操作：条件全部满足才写入，任一不满足保持 pending、原柜位不动。
 */

export class RuleRejectedError extends Error {
  check: ReturnType<typeof checkSwap>;
  constructor(check: ReturnType<typeof checkSwap>) {
    super(check.violations.map((item) => item.message).join("；"));
    this.name = "RuleRejectedError";
    this.check = check;
  }
}

function nextSwapId(state: AppState): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return `SW-${stamp}-${String(state.seq).padStart(3, "0")}`;
}

export function submitSwap(state: AppState, draft: SwapDraft): { state: AppState; swap: SwapRequest } {
  // 登记即判定：条件不满足不允许进入待审
  const check = checkSwap(state, draft);
  if (!check.pass) {
    throw new RuleRejectedError(check);
  }

  const swap: SwapRequest = {
    id: nextSwapId(state),
    specimenAId: draft.specimenAId,
    specimenBId: draft.specimenBId,
    targetCabinetA: draft.targetCabinetA,
    targetCabinetB: draft.targetCabinetB,
    voucher: draft.voucher.trim(),
    note: draft.note?.trim() || undefined,
    status: "pending",
    createdAt: new Date().toISOString(),
    check,
  };

  return {
    state: { ...state, swaps: [...state.swaps, swap], seq: state.seq + 1 },
    swap,
  };
}

/**
 * 审批生效：以当前数据重新复核（外借、占用、鉴定状态可能在待审期间变化）。
 * 全部通过 → 两件标本柜位一次性互换写入；不通过 → 保持待审，挂回最新判定，原柜位不变。
 */
export function resolveSwap(
  state: AppState,
  swapId: string
): { state: AppState; swap: SwapRequest; effective: boolean } {
  const swap = state.swaps.find((item) => item.id === swapId);
  if (!swap || swap.status !== "pending") {
    return { state, swap: swap as SwapRequest, effective: false };
  }

  const check = checkSwap(state, {
    specimenAId: swap.specimenAId,
    specimenBId: swap.specimenBId,
    targetCabinetA: swap.targetCabinetA,
    targetCabinetB: swap.targetCabinetB,
    voucher: swap.voucher,
    note: swap.note,
  }, swap.id);

  if (!check.pass) {
    const updated: SwapRequest = { ...swap, check };
    return {
      state: { ...state, swaps: state.swaps.map((item) => (item.id === swapId ? updated : item)) },
      swap: updated,
      effective: false,
    };
  }

  // 原子写入：同步更新两件标本的柜位记录与流水
  const decidedAt = new Date().toISOString();
  const specimens = state.specimens.map((specimen) => {
    if (specimen.id === swap.specimenAId) {
      return applyMove(specimen, swap.targetCabinetA, swap.id, decidedAt);
    }
    if (specimen.id === swap.specimenBId) {
      return applyMove(specimen, swap.targetCabinetB, swap.id, decidedAt);
    }
    return specimen;
  });

  const effective: SwapRequest = { ...swap, status: "effective", decidedAt, check };
  return {
    state: {
      ...state,
      specimens,
      swaps: state.swaps.map((item) => (item.id === swapId ? effective : item)),
    },
    swap: effective,
    effective: true,
  };
}

function applyMove(specimen: Specimen, to: string, swapId: string, at: string): Specimen {
  return {
    ...specimen,
    pressStatus: "已入库",
    cabinetId: to,
    moves: [
      ...specimen.moves,
      { at, type: "对调", from: specimen.cabinetId, to, swapId },
    ],
  };
}

/** 撤回待审对调：锁住的柜位与标本随 pending 状态消失而释放 */
export function withdrawSwap(state: AppState, swapId: string): { state: AppState; swap: SwapRequest } {
  const swap = state.swaps.find((item) => item.id === swapId);
  if (!swap || swap.status !== "pending") {
    return { state, swap: swap as SwapRequest };
  }
  const withdrawn: SwapRequest = { ...swap, status: "withdrawn", decidedAt: new Date().toISOString() };
  return {
    state: { ...state, swaps: state.swaps.map((item) => (item.id === swapId ? withdrawn : item)) },
    swap: withdrawn,
  };
}

// ---------------- 入库配套动作 ----------------

export interface ReceiveDraft {
  collectionNo: string;
  species: string;
  family: string;
  location: string;
  elevation: number;
  habitat: string;
  collectors: string;
  pressed: boolean;
}

export function receiveSpecimen(state: AppState, draft: ReceiveDraft): AppState {
  const specimen: Specimen = {
    id: `SP-${String(state.seq).padStart(3, "0")}`,
    collectionNo: draft.collectionNo.trim(),
    species: draft.species.trim(),
    family: draft.family.trim(),
    location: draft.location.trim(),
    elevation: draft.elevation,
    habitat: draft.habitat.trim(),
    collectors: draft.collectors.trim(),
    pressStatus: draft.pressed ? "已压制" : "待压制",
    identifyStatus: "待鉴定",
    cabinetId: null,
    onLoan: false,
    receivedAt: new Date().toISOString(),
    moves: [],
  };
  return { ...state, specimens: [specimen, ...state.specimens], seq: state.seq + 1 };
}

export function shelveSpecimen(state: AppState, specimenId: string, cabinetId: string): AppState {
  // 柜位已被占用或被待审对调锁定时，上柜不生效，保持原状态
  if (isCabinetOccupied(state, cabinetId) || isCabinetLocked(state, cabinetId)) {
    return state;
  }
  const at = new Date().toISOString();
  return {
    ...state,
    specimens: state.specimens.map((specimen) =>
      specimen.id === specimenId
        ? {
            ...specimen,
            pressStatus: "已入库",
            cabinetId,
            moves: [...specimen.moves, { at, type: "上柜", from: specimen.cabinetId, to: cabinetId }],
          }
        : specimen
    ),
  };
}

export function setIdentifyStatus(state: AppState, specimenId: string, status: Specimen["identifyStatus"]): AppState {
  return {
    ...state,
    specimens: state.specimens.map((specimen) =>
      specimen.id === specimenId ? { ...specimen, identifyStatus: status } : specimen
    ),
  };
}

export function toggleLoan(state: AppState, specimenId: string, onLoan: boolean): AppState {
  return {
    ...state,
    specimens: state.specimens.map((specimen) =>
      specimen.id === specimenId
        ? {
            ...specimen,
            onLoan,
            loanNote: onLoan ? "外展借展中" : undefined,
          }
        : specimen
    ),
  };
}
