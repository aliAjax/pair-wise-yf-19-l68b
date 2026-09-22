import type {
  AppState,
  RuleCheckResult,
  RuleViolation,
  Specimen,
  SwapRequest,
} from "./types";

/**
 * 业务文件一：柜位对调判定
 * 纯函数，不依赖 React / 存储，所有“能不能对调”的规则集中在此。
 */

export interface SwapDraft {
  specimenAId: string;
  specimenBId: string;
  targetCabinetA: string;
  targetCabinetB: string;
  voucher: string;
  note?: string;
}

export const RULES = {
  voucher: "必须登记调换凭据",
  pair: "需选择两件不同的已上柜标本",
  target: "需登记两个不同的目标柜位",
  cabinetKnown: "目标柜位必须在馆藏柜位表内",
  empty: "两个目标柜位当前必须为空",
  accepted: "两件标本鉴定状态必须为已接受",
  notLoaned: "两件标本均不得处于外借状态",
  notLocked: "目标柜位与标本不得被其他待审对调占用",
} as const;

export function findSpecimen(state: AppState, id: string): Specimen | undefined {
  return state.specimens.find((item) => item.id === id);
}

/** 柜位当前是否被某件已上柜标本占用 */
export function isCabinetOccupied(state: AppState, cabinetId: string): boolean {
  return state.specimens.some((item) => item.cabinetId === cabinetId);
}

/** 待审对调锁住的柜位（目标柜在待审期间被预占） */
export function lockedCabinets(state: AppState, excludeSwapId?: string): Set<string> {
  const set = new Set<string>();
  state.swaps.forEach((swap) => {
    if (swap.status === "pending" && swap.id !== excludeSwapId) {
      set.add(swap.targetCabinetA);
      set.add(swap.targetCabinetB);
    }
  });
  return set;
}

/** 待审对调锁住的标本（防止其柜位被另一次对调同时改动） */
export function lockedSpecimens(state: AppState, excludeSwapId?: string): Set<string> {
  const set = new Set<string>();
  state.swaps.forEach((swap) => {
    if (swap.status === "pending" && swap.id !== excludeSwapId) {
      set.add(swap.specimenAId);
      set.add(swap.specimenBId);
    }
  });
  return set;
}

export function isCabinetLocked(state: AppState, cabinetId: string, excludeSwapId?: string): boolean {
  return lockedCabinets(state, excludeSwapId).has(cabinetId);
}

export function isSpecimenLocked(state: AppState, specimenId: string, excludeSwapId?: string): boolean {
  return lockedSpecimens(state, excludeSwapId).has(specimenId);
}

function violation(code: string, message: string, level: RuleViolation["level"] = "error"): RuleViolation {
  return { code, message, level };
}

/**
 * 对调整批判定：任一条不满足即整体不通过，调用方必须保持原柜位不变。
 * 提交登记与审批生效两个时点共用本函数，保证“待审期间条件变化”能被复核出来。
 */
export function checkSwap(state: AppState, draft: SwapDraft, excludeSwapId?: string): RuleCheckResult {
  const violations: RuleViolation[] = [];
  const a = draft.specimenAId ? findSpecimen(state, draft.specimenAId) : undefined;
  const b = draft.specimenBId ? findSpecimen(state, draft.specimenBId) : undefined;

  if (!draft.voucher.trim()) {
    violations.push(violation("voucher", RULES.voucher));
  }

  if (!a || !b || a.id === b.id) {
    violations.push(violation("pair", RULES.pair));
  }

  const targetKnown = (id: string) => state.cabinets.some((cabinet) => cabinet.id === id);
  if (!draft.targetCabinetA || !draft.targetCabinetB || draft.targetCabinetA === draft.targetCabinetB) {
    violations.push(violation("target", RULES.target));
  } else {
    if (!targetKnown(draft.targetCabinetA) || !targetKnown(draft.targetCabinetB)) {
      violations.push(violation("cabinetKnown", RULES.cabinetKnown));
    }
  }

  [a, b].forEach((specimen) => {
    if (specimen && specimen.cabinetId === null) {
      violations.push(violation("pair", `标本 ${specimen.collectionNo} 尚未上柜，不能参与对调`));
    }
  });

  // 目标柜为空：既不被现有柜位记录占用，也不被其他待审对调预占
  [draft.targetCabinetA, draft.targetCabinetB].forEach((cabinetId) => {
    if (!cabinetId || !targetKnown(cabinetId)) return;
    if (isCabinetOccupied(state, cabinetId)) {
      violations.push(violation("empty", `目标柜位 ${cabinetId} 已被占用`));
    }
    if (isCabinetLocked(state, cabinetId, excludeSwapId)) {
      violations.push(violation("notLocked", `目标柜位 ${cabinetId} 被待审对调锁住`));
    }
  });

  [a, b].forEach((specimen) => {
    if (!specimen) return;
    if (specimen.identifyStatus !== "已接受") {
      violations.push(violation("accepted", `标本 ${specimen.collectionNo} 鉴定为“${specimen.identifyStatus}”，需已接受`));
    }
    if (specimen.onLoan) {
      violations.push(violation("notLoaned", `标本 ${specimen.collectionNo} 正在外借${specimen.loanNote ? `（${specimen.loanNote}）` : ""}`));
    }
    if (isSpecimenLocked(state, specimen.id, excludeSwapId)) {
      violations.push(violation("notLocked", `标本 ${specimen.collectionNo} 已被另一笔待审对调锁住`));
    }
  });

  return {
    pass: violations.length === 0,
    violations,
    checkedAt: new Date().toISOString(),
  };
}

/** 按规则编码汇总判定信息，供展示层逐条打勾/打叉 */
export function checkLines(draft: SwapDraft): { code: string; label: string }[] {
  return [
    { code: "voucher", label: RULES.voucher },
    { code: "pair", label: RULES.pair },
    { code: "target", label: RULES.target },
    { code: "cabinetKnown", label: RULES.cabinetKnown },
    { code: "empty", label: RULES.empty },
    { code: "accepted", label: RULES.accepted },
    { code: "notLoaned", label: RULES.notLoaned },
    { code: "notLocked", label: RULES.notLocked },
  ];
}

export function draftFromSwap(swap: SwapRequest): SwapDraft {
  return {
    specimenAId: swap.specimenAId,
    specimenBId: swap.specimenBId,
    targetCabinetA: swap.targetCabinetA,
    targetCabinetB: swap.targetCabinetB,
    voucher: swap.voucher,
    note: swap.note,
  };
}
