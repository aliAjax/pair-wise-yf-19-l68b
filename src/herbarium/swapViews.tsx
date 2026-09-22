// 柜位对调 —— 展示层（对调登记表单、调换单列表与操作按钮）
import { useMemo, useState } from "react";
import { CABINET_CODES } from "./data";
import {
  checkSwap,
  isCabinetLocked,
  isSpecimenBusy,
  occupantOf,
  type SwapDraft,
} from "./swapRules";
import { useHerbariumState, useSwapStore, type SubmitOutcome } from "./swapFlow";
import type { Specimen, SwapOrder, SwapStatus } from "./types";

const STATUS_LABEL: Record<SwapStatus, string> = {
  待审: "待审",
  已生效: "已生效",
  已驳回: "已驳回",
  已撤回: "已撤回",
};

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  return <span className={`swap-badge swap-badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

/** 已上柜标本的可选性说明（用于下拉项禁用） */
function shelvedOptionState(s: Specimen, swaps: SwapOrder[]): string | null {
  if (isSpecimenBusy(s.id, swaps)) return "已在待审调换单中";
  if (s.loaned) return "外借中";
  if (s.identification !== "鉴定已接受") return "鉴定未接受";
  return null;
}

function CabinetSelect({
  value,
  onChange,
  specimens,
  swaps,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  specimens: Specimen[];
  swaps: SwapOrder[];
  disabled?: boolean;
}) {
  return (
    <select className="swap-input" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">选择空柜位…</option>
      {CABINET_CODES.map((code) => {
        const occ = occupantOf(specimens, code);
        const locked = isCabinetLocked(code, swaps);
        const unusable = Boolean(occ) || locked;
        let label = code;
        if (occ) label += `（占用：${occ.collectionNo}）`;
        else if (locked) label += "（待审锁定）";
        else label += "（空柜）";
        return (
          <option key={code} value={code} disabled={unusable}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

function SpecimenSelect({
  value,
  onChange,
  specimens,
  swaps,
  otherId,
}: {
  value: string;
  onChange: (v: string) => void;
  specimens: Specimen[];
  swaps: SwapOrder[];
  otherId: string;
}) {
  const shelved = specimens.filter((s) => s.positionCode);
  return (
    <select className="swap-input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">选择已上柜标本…</option>
      {shelved.map((s) => {
        const blockReason = s.id === otherId ? "不能与另一件重复" : shelvedOptionState(s, swaps);
        return (
          <option key={s.id} value={s.id} disabled={Boolean(blockReason)}>
            {s.collectionNo} · {s.species}（{s.positionCode}）{blockReason ? ` —— ${blockReason}` : ""}
          </option>
        );
      })}
    </select>
  );
}

export function SwapForm() {
  const state = useHerbariumState();
  const store = useSwapStore();
  const { specimens, swaps } = state;

  const [specimenAId, setSpecimenAId] = useState("");
  const [specimenBId, setSpecimenBId] = useState("");
  const [targetA, setTargetA] = useState("");
  const [targetB, setTargetB] = useState("");
  const [credential, setCredential] = useState("");
  const [operator, setOperator] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; lines: string[] } | null>(null);

  const draft: SwapDraft = { specimenAId, specimenBId, targetA, targetB, credential, operator };
  const specimenA = specimens.find((s) => s.id === specimenAId);
  const specimenB = specimens.find((s) => s.id === specimenBId);

  // 实时判定：两件都选上后即展示不满足的条件
  const preview = useMemo(() => {
    if (!specimenAId || !specimenBId) return null;
    return checkSwap(specimens, swaps, draft);
    // draft 为每渲染重建的对象，直接依赖其字段
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specimens, swaps, specimenAId, specimenBId, targetA, targetB, credential, operator]);

  function resetForm() {
    setSpecimenAId("");
    setSpecimenBId("");
    setTargetA("");
    setTargetB("");
    setCredential("");
  }

  function handleSubmit() {
    const outcome = store.dispatch({ type: "submit", draft }) as SubmitOutcome;
    if (outcome.ok) {
      setFeedback({ ok: true, lines: [`调换单 ${outcome.order?.id} 已登记，目标柜位锁定，待审核生效。`] });
      resetForm();
    } else {
      setFeedback({ ok: false, lines: outcome.result.reasons });
    }
  }

  const pendingCount = swaps.filter((o) => o.status === "待审").length;

  return (
    <section className="panel swap-panel">
      <div className="heading">
        <div>
          <p>柜位对调</p>
          <h2>登记对调申请</h2>
        </div>
        {pendingCount > 0 && <span className="lock-pill">待审 {pendingCount} 单 · 柜位锁定中</span>}
      </div>

      <p className="hint">
        选择两件已上柜标本，各自登记一个目标空柜与调换凭据。两个目标柜均空、两件标本鉴定已接受且未外借时，审核方可整批生效；否则原柜位不变。
      </p>

      <div className="swap-legs">
        <div className="swap-leg">
          <span className="swap-leg-tag">标本甲</span>
          <SpecimenSelect value={specimenAId} onChange={setSpecimenAId} specimens={specimens} swaps={swaps} otherId={specimenBId} />
          <div className="swap-route">
            <b>{specimenA?.positionCode ?? "原柜"}</b>
            <span>→</span>
            <CabinetSelect value={targetA} onChange={setTargetA} specimens={specimens} swaps={swaps} disabled={!specimenAId} />
          </div>
        </div>

        <div className="swap-leg">
          <span className="swap-leg-tag">标本乙</span>
          <SpecimenSelect value={specimenBId} onChange={setSpecimenBId} specimens={specimens} swaps={swaps} otherId={specimenAId} />
          <div className="swap-route">
            <b>{specimenB?.positionCode ?? "原柜"}</b>
            <span>→</span>
            <CabinetSelect value={targetB} onChange={setTargetB} specimens={specimens} swaps={swaps} disabled={!specimenBId} />
          </div>
        </div>
      </div>

      <div className="swap-meta-grid">
        <label>
          <span>调换凭据（调拨单号 / 批条编号）</span>
          <input
            className="swap-input"
            placeholder="如 DB-2026-091"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
          />
        </label>
        <label>
          <span>经办人</span>
          <input
            className="swap-input"
            placeholder="登记人姓名"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
          />
        </label>
      </div>

      {preview && !preview.ok && (
        <ul className="swap-check swap-check-bad">
          {preview.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {preview?.ok && (
        <ul className="swap-check swap-check-ok">
          <li>条件全部满足：两个目标柜为空、标本鉴定已接受且未外借，提交后柜位将进入待审锁定。</li>
        </ul>
      )}

      {feedback && (
        <ul className={`swap-check ${feedback.ok ? "swap-check-ok" : "swap-check-bad"}`}>
          {feedback.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <div className="swap-actions">
        <button className="primary" disabled={!preview?.ok} onClick={handleSubmit}>
          登记并锁柜待审
        </button>
        <button onClick={resetForm}>清空</button>
      </div>
    </section>
  );
}

function OrderCard({ order }: { order: SwapOrder }) {
  const store = useSwapStore();

  return (
    <article className={`swap-order swap-order-${order.status}`}>
      <header>
        <div>
          <h4>{order.id}</h4>
          <small>
            凭据 {order.credential} · 经办 {order.operator} · 登记 {order.createdAt}
            {order.decidedAt ? ` · 办结 ${order.decidedAt}` : ""}
          </small>
        </div>
        <SwapStatusBadge status={order.status} />
      </header>

      <div className="swap-order-legs">
        {order.legs.map((leg) => (
          <div key={leg.specimenId} className="swap-order-leg">
            <span>{leg.specimenNo}</span>
            <b>{leg.fromCode}</b>
            <span className="arrow">→</span>
            <b>{leg.toCode}</b>
            {order.status === "待审" && <em className="target-lock">目标柜锁定</em>}
          </div>
        ))}
      </div>

      {order.status === "已驳回" && order.rejectReasons.length > 0 && (
        <ul className="swap-check swap-check-bad">
          {order.rejectReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {order.status === "待审" && (
        <footer>
          <button
            className="primary"
            onClick={() => store.dispatch({ type: "approve", orderId: order.id })}
          >
            整批生效
          </button>
          <button
            onClick={() => {
              const reason = window.prompt("驳回原因（可留空）", "");
              if (reason === null) return;
              store.dispatch({
                type: "reject",
                orderId: order.id,
                reasons: reason.trim() ? [reason.trim()] : ["审核未通过"],
              });
            }}
          >
            驳回
          </button>
          <button
            className="ghost-danger"
            onClick={() => store.dispatch({ type: "withdraw", orderId: order.id })}
          >
            撤回并释放柜位
          </button>
        </footer>
      )}
    </article>
  );
}

export function SwapOrdersPanel() {
  const state = useHerbariumState();
  if (state.swaps.length === 0) {
    return (
      <section className="panel">
        <div className="heading">
          <div>
            <p>调换历史</p>
            <h2>柜位对调单</h2>
          </div>
        </div>
        <p className="hint">尚无调换记录。登记后此处保留全部待审、生效、驳回与撤回单据。</p>
      </section>
    );
  }
  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>调换历史</p>
          <h2>柜位对调单（{state.swaps.length}）</h2>
        </div>
      </div>
      <div className="swap-order-list">
        {state.swaps.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </section>
  );
}
