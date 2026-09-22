// 柜位对调 —— 判定层（纯函数：条件校验、柜位占用与锁定）
import { CABINET_CODES } from "./data";
import type { Specimen, SwapOrder } from "./types";

/** 调换申请输入 */
export interface SwapDraft {
  specimenAId: string;
  specimenBId: string;
  targetA: string;
  targetB: string;
  credential: string;
  operator: string;
}

export interface CheckResult {
  ok: boolean;
  reasons: string[];
}

export function nowText(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 当前占用某柜位的标本（未生效的调换不改变占用） */
export function occupantOf(specimens: Specimen[], code: string): Specimen | undefined {
  return specimens.find((s) => s.positionCode === code);
}

/** 柜位是否被某张待审调换单锁住（待审期间两个目标柜锁住） */
export function isCabinetLocked(code: string, swaps: SwapOrder[], excludeOrderId?: string): boolean {
  return swaps.some(
    (o) =>
      o.status === "待审" &&
      o.id !== excludeOrderId &&
      o.legs.some((leg) => leg.toCode === code),
  );
}

/** 所有被待审调换单锁住的柜位编码 */
export function lockedCabinetCodes(swaps: SwapOrder[]): Set<string> {
  const set = new Set<string>();
  swaps
    .filter((o) => o.status === "待审")
    .forEach((o) => o.legs.forEach((leg) => set.add(leg.toCode)));
  return set;
}

function findSpecimen(specimens: Specimen[], id: string): Specimen | undefined {
  return specimens.find((s) => s.id === id);
}

/**
 * 调换生效的全部前置条件：
 * 1) 选择两件不同的、已上柜标本；
 * 2) 两件标本鉴定均已接受；
 * 3) 两件标本均未外借；
 * 4) 两个目标柜位均为登记在案的柜位、互不相同；
 * 5) 两个目标柜位当前都空着；
 * 6) 两个目标柜位未被其他待审调换单锁住；
 * 7) 调换凭据已登记。
 * 任一条件不满足即整批不生效，原柜位保持不变。
 */
export function checkSwap(
  specimens: Specimen[],
  swaps: SwapOrder[],
  draft: SwapDraft,
  excludeOrderId?: string,
): CheckResult {
  const reasons: string[] = [];
  const a = findSpecimen(specimens, draft.specimenAId);
  const b = findSpecimen(specimens, draft.specimenBId);

  if (!a || !b) {
    reasons.push("必须从已上柜标本中选择两件标本");
    return { ok: false, reasons };
  }
  if (a.id === b.id) reasons.push("两件标本不能是同一份");

  for (const [label, s] of [["标本甲", a], ["标本乙", b]] as const) {
    if (!s.positionCode) reasons.push(`${label} ${s.collectionNo} 尚未上柜，不能参与柜位对调`);
    if (s.identification !== "鉴定已接受") reasons.push(`${label} ${s.collectionNo} 鉴定状态为「${s.identification}」，须鉴定已接受`);
    if (s.loaned) reasons.push(`${label} ${s.collectionNo} 正在外借中，不能移动柜位`);
    if (isSpecimenBusy(s.id, swaps, excludeOrderId)) reasons.push(`${label} ${s.collectionNo} 已挂在另一张待审调换单上`);
  }

  const targetA = draft.targetA.trim();
  const targetB = draft.targetB.trim();

  if (!targetA || !targetB) {
    reasons.push("两个目标柜位都必须填写");
  } else {
    if (!CABINET_CODES.includes(targetA)) reasons.push(`目标柜 ${targetA} 不在柜位册中`);
    if (!CABINET_CODES.includes(targetB)) reasons.push(`目标柜 ${targetB} 不在柜位册中`);
    if (targetA === targetB) reasons.push("两个目标柜位不能相同");

    if (CABINET_CODES.includes(targetA) && CABINET_CODES.includes(targetB) && targetA !== targetB) {
      const occA = occupantOf(specimens, targetA);
      const occB = occupantOf(specimens, targetB);
      if (occA) reasons.push(`目标柜 ${targetA} 已被 ${occA.collectionNo} 占用，须为空柜`);
      if (occB) reasons.push(`目标柜 ${targetB} 已被 ${occB.collectionNo} 占用，须为空柜`);

      if (isCabinetLocked(targetA, swaps, excludeOrderId)) reasons.push(`目标柜 ${targetA} 已被待审调换单锁住`);
      if (isCabinetLocked(targetB, swaps, excludeOrderId)) reasons.push(`目标柜 ${targetB} 已被待审调换单锁住`);
    }
  }

  if (!draft.credential.trim()) reasons.push("必须登记调换凭据（调拨单号或批条编号）");
  if (!draft.operator.trim()) reasons.push("必须登记经办人");

  return { ok: reasons.length === 0, reasons };
}

/** 待审单在「生效」瞬间复核：占用、外借、鉴定可能在待审期间发生变化 */
export function recheckPendingOrder(specimens: Specimen[], swaps: SwapOrder[], order: SwapOrder): CheckResult {
  const [legA, legB] = order.legs;
  return checkSwap(
    specimens,
    swaps,
    {
      specimenAId: legA.specimenId,
      specimenBId: legB.specimenId,
      targetA: legA.toCode,
      targetB: legB.toCode,
      credential: order.credential,
      operator: order.operator,
    },
    order.id,
  );
}

/** 某标本是否已挂在一张待审调换单上（待审期间冻结，不得重复调换） */
export function isSpecimenBusy(specimenId: string, swaps: SwapOrder[], excludeOrderId?: string): boolean {
  return swaps.some(
    (o) =>
      o.status === "待审" &&
      o.id !== excludeOrderId &&
      o.legs.some((leg) => leg.specimenId === specimenId),
  );
}

/** 只有待审单可以撤回（撤回即释放锁住的柜位） */
export function canWithdraw(order: SwapOrder): boolean {
  return order.status === "待审";
}
