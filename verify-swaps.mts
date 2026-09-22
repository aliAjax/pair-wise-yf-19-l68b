// 临时验证脚本：判定/流转规则端到端测试（不随构建发布）
import { initialState } from "./src/herbarium/data";
import { reducer, type SwapAction } from "./src/herbarium/swapFlow";
import { checkSwap, isCabinetLocked, lockedCabinetCodes } from "./src/herbarium/swapRules";
import type { HerbariumState, SwapDraft } from "./src/herbarium/types";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log("  ✓", msg);
  } else {
    failures++;
    console.error("  ✗", msg);
  }
}

function submit(state: HerbariumState, draft: SwapDraft) {
  const before = JSON.stringify(state.specimens.map((s) => [s.collectionNo, s.positionCode]));
  const next = reducer(state, { type: "submit", draft });
  const after = JSON.stringify(next.specimens.map((s) => [s.collectionNo, s.positionCode]));
  return { next, unchanged: before === after, order: next.swaps[0] };
}

// ---- 1. 条件不满足：登记被拒，原柜位不变 ----
console.log("1) 条件不满足整批不生效");
{
  let s = initialState();
  const bad: SwapDraft = {
    specimenAId: "sp-04", // 外借中
    specimenBId: "sp-05", // 鉴定被驳回
    targetA: "A-02-05",
    targetB: "A-03-01",
    credential: "DB-1",
    operator: "测试",
  };
  const r = checkSwap(s.specimens, s.swaps, bad);
  assert(!r.ok, "外借 + 鉴定未接受判定不通过");
  assert(r.reasons.length >= 2, `给出全部原因（${r.reasons.length} 条）`);
  const { unchanged, order } = submit(s, bad);
  assert(unchanged, "未生成单据且柜位完全不变");
  assert(order === undefined, "没有调换单被创建");

  // 目标柜占用
  const occ: SwapDraft = {
    specimenAId: "sp-01",
    specimenBId: "sp-03",
    targetA: "B-12-05", // sp-04 占用
    targetB: "A-02-05",
    credential: "DB-2",
    operator: "测试",
  };
  const r2 = checkSwap(s.specimens, s.swaps, occ);
  assert(!r2.ok && r2.reasons.some((x) => x.includes("占用")), "目标柜非空时拒绝");

  // 同一标本 / 相同目标柜 / 缺凭据
  const dup = { ...bad, specimenAId: "sp-01", specimenBId: "sp-01", targetA: "A-02-05", targetB: "A-02-05", credential: "" };
  const r3 = checkSwap(s.specimens, s.swaps, dup);
  assert(r3.reasons.some((x) => x.includes("同一份")), "两件标本不能相同");
  assert(r3.reasons.some((x) => x.includes("目标柜位不能相同")), "目标柜不能相同");
  assert(r3.reasons.some((x) => x.includes("凭据")), "缺凭据被拦截");
}

// ---- 2. 合法申请：待审锁柜，不移动；生效后整批移动 ----
console.log("2) 待审锁定 → 整批生效 → 记录同步");
{
  let s = initialState();
  const draft: SwapDraft = {
    specimenAId: "sp-01", // A-01-02
    specimenBId: "sp-03", // B-12-04
    targetA: "B-15-02",
    targetB: "C-06-01",
    credential: "DB-2026-091",
    operator: "周慕云",
  };
  assert(checkSwap(s.specimens, s.swaps, draft).ok, "初始条件全部满足");
  const pending = reducer(s, { type: "submit", draft });
  const orderId = pending.swaps[0].id;
  assert(pending.swaps[0].status === "待审", "单据进入待审");
  assert(
    pending.specimens.find((x) => x.id === "sp-01")!.positionCode === "A-01-02",
    "待审期间 sp-01 仍在原柜 A-01-02",
  );
  assert(isCabinetLocked("B-15-02", pending.swaps), "目标柜 B-15-02 已锁定");
  assert(isCabinetLocked("C-06-01", pending.swaps), "目标柜 C-06-01 已锁定");
  assert(!isCabinetLocked("A-01-02", pending.swaps), "原柜不锁定");
  assert(lockedCabinetCodes(pending.swaps).size === 2, "恰有两个柜位被锁");

  // 另一张单子抢用锁定柜
  const conflict: SwapDraft = {
    specimenAId: "sp-06",
    specimenBId: "sp-07",
    targetA: "B-15-02",
    targetB: "A-02-05",
    credential: "DB-2026-092",
    operator: "测试",
  };
  assert(!checkSwap(pending.specimens, pending.swaps, conflict).ok, "锁定柜不能被另一单登记");
  // 待审标本不能重复参与
  const sameSpecimen: SwapDraft = { ...draft, targetA: "A-02-05", targetB: "A-03-01", credential: "DB-X" };
  assert(!checkSwap(pending.specimens, pending.swaps, sameSpecimen).ok, "待审中的标本不能再挂单");

  const done = reducer(pending, { type: "approve", orderId });
  const a = done.specimens.find((x) => x.id === "sp-01")!;
  const b = done.specimens.find((x) => x.id === "sp-03")!;
  assert(a.positionCode === "B-15-02", "sp-01 移动到 B-15-02");
  assert(b.positionCode === "C-06-01", "sp-03 移动到 C-06-01");
  assert(done.swaps[0].status === "已生效", "单据标记已生效");
  assert(Boolean(done.swaps[0].decidedAt), "记录生效时间");
  const lastA = a.positionHistory[a.positionHistory.length - 1];
  assert(lastA.to === "B-15-02" && lastA.from === "A-01-02", "柜位变更历史追加（含原柜/目标柜）");
  assert(lastA.reason.includes("DB-2026-091"), "历史记录保留调换凭据");
  assert(lockedCabinetCodes(done.swaps).size === 0, "生效后柜位锁释放");
  // 旧柜变空，新柜被占
  assert(!done.specimens.some((x) => x.positionCode === "A-01-02"), "原柜 A-01-02 变空");
  assert(done.specimens.some((x) => x.positionCode === "B-15-02"), "目标柜 B-15-02 已占用");
}

// ---- 3. 撤回释放锁 ----
console.log("3) 撤回释放柜位；驳回不动柜");
{
  let s = initialState();
  const draft: SwapDraft = {
    specimenAId: "sp-06",
    specimenBId: "sp-07",
    targetA: "A-02-05",
    targetB: "A-03-01",
    credential: "DB-3",
    operator: "测试",
  };
  const pending = reducer(s, { type: "submit", draft });
  const id = pending.swaps[0].id;
  const withdrawn = reducer(pending, { type: "withdraw", orderId: id });
  assert(withdrawn.swaps[0].status === "已撤回", "状态变已撤回");
  assert(lockedCabinetCodes(withdrawn.swaps).size === 0, "撤回后锁释放");
  assert(checkSwap(withdrawn.specimens, withdrawn.swaps, draft).ok, "释放后相同申请可重新登记");
  const positionsSame =
    withdrawn.specimens.find((x) => x.id === "sp-06")!.positionCode === "C-03-08" &&
    withdrawn.specimens.find((x) => x.id === "sp-07")!.positionCode === "D-08-04";
  assert(positionsSame, "撤回后原柜位不变");

  // 驳回
  const pending2 = reducer(withdrawn, { type: "submit", draft });
  const rejected = reducer(pending2, { type: "reject", orderId: pending2.swaps[0].id, reasons: ["人工复核未过"] });
  assert(rejected.swaps[0].status === "已驳回", "状态变已驳回");
  assert(rejected.swaps[0].rejectReasons[0] === "人工复核未过", "驳回原因保留");
  assert(lockedCabinetCodes(rejected.swaps).size === 0, "驳回后锁释放");
  assert(rejected.specimens.find((x) => x.id === "sp-06")!.positionCode === "C-03-08", "驳回不动原柜");
}

// ---- 4. 生效瞬间复核：待审期间目标柜被占 → 自动驳回 ----
console.log("4) 生效瞬间复核失败 → 自动驳回且原柜不动");
{
  let s = initialState();
  const draft: SwapDraft = {
    specimenAId: "sp-01",
    specimenBId: "sp-03",
    targetA: "B-15-02",
    targetB: "C-06-01",
    credential: "DB-4",
    operator: "测试",
  };
  const pending = reducer(s, { type: "submit", draft });
  // 模拟待审期间外部变化：把另一份标本直接塞进目标柜 B-15-02（绕过对调流程）
  const tampered: HerbariumState = {
    ...pending,
    specimens: pending.specimens.map((x) => (x.id === "sp-06" ? { ...x, positionCode: "B-15-02" } : x)),
  };
  const result = reducer(tampered, { type: "approve", orderId: pending.swaps[0].id });
  assert(result.swaps[0].status === "已驳回", "复核失败自动驳回");
  assert(result.swaps[0].rejectReasons.some((r) => r.includes("B-15-02")), "驳回原因指向被占柜");
  assert(result.specimens.find((x) => x.id === "sp-01")!.positionCode === "A-01-02", "sp-01 原柜不动");
  assert(result.specimens.find((x) => x.id === "sp-03")!.positionCode === "B-12-04", "sp-03 原柜不动");
}

console.log(failures === 0 ? "\n全部通过" : `\n${failures} 条失败`);
process.exit(failures === 0 ? 0 : 1);
