import { useEffect, useMemo, useState } from "react";
import type { AppState, SwapRequest } from "./types";
import {
  checkLines,
  checkSwap,
  draftFromSwap,
  isCabinetLocked,
  isSpecimenLocked,
  type SwapDraft,
} from "./swapRules";
import { RuleRejectedError } from "./swapFlow";
import { store } from "./store";
import { formatDate } from "./format";

/**
 * 业务文件三：柜位对调展示
 * 判定来自 swapRules，状态流转来自 swapFlow；本组件只负责采集输入与呈现。
 */

const EMPTY_DRAFT: SwapDraft = {
  specimenAId: "",
  specimenBId: "",
  targetCabinetA: "",
  targetCabinetB: "",
  voucher: "",
  note: "",
};

export default function SwapPanel({
  state,
  onOpenSpecimen,
  prefillA,
  onPrefillConsumed,
}: {
  state: AppState;
  onOpenSpecimen: (id: string) => void;
  prefillA?: string | null;
  onPrefillConsumed?: () => void;
}) {
  const [draft, setDraft] = useState<SwapDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (prefillA) {
      setDraft((prev) => ({ ...prev, specimenAId: prefillA }));
      onPrefillConsumed?.();
    }
  }, [prefillA, onPrefillConsumed]);

  const patch = (part: Partial<SwapDraft>) => {
    setDraft((prev) => ({ ...prev, ...part }));
    setFormError(null);
  };

  const live = useMemo(() => checkSwap(state, draft), [state, draft]);
  const failedCodes = new Set(live.violations.map((item) => item.code));
  const filled =
    draft.specimenAId && draft.specimenBId && draft.targetCabinetA && draft.targetCabinetB;

  const pending = state.swaps.filter((item) => item.status === "pending");
  const history = state.swaps
    .filter((item) => item.status !== "pending")
    .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""));

  const submit = () => {
    try {
      const swap = store.submitSwap(draft);
      setDraft(EMPTY_DRAFT);
      setFormError(null);
      setFlash(`对调单 ${swap.id} 已登记，两个目标柜位进入锁定，待审批生效。`);
      window.setTimeout(() => setFlash(null), 4000);
    } catch (error) {
      if (error instanceof RuleRejectedError) {
        setFormError(error.check.violations.map((item) => item.message).join("；"));
      }
    }
  };

  const resolve = (swapId: string) => {
    const result = store.resolveSwap(swapId);
    if (result.effective) {
      setFlash(`对调单 ${swapId} 已整批生效，柜位记录、地点卡与详情已同步。`);
    }
    window.setTimeout(() => setFlash(null), 4000);
  };

  const specimenMap = new Map(state.specimens.map((item) => [item.id, item]));

  return (
    <section className="panel swap-panel" id="swap">
      <div className="heading">
        <div>
          <p>柜位管理</p>
          <h2>柜位对调</h2>
        </div>
        <span className="rule-hint">两件已上柜标本互换目标柜 · 整批判定 · 待审锁柜</span>
      </div>

      {flash && <div className="flash ok">{flash}</div>}

      <div className="swap-grid">
        <div className="swap-form">
          <div className="swap-cols">
            <SwapSide
              title="标本 A"
              state={state}
              specimenId={draft.specimenAId}
              targetCabinet={draft.targetCabinetA}
              onSpecimen={(id) => patch({ specimenAId: id })}
              onCabinet={(id) => patch({ targetCabinetA: id })}
            />
            <SwapSide
              title="标本 B"
              state={state}
              specimenId={draft.specimenBId}
              targetCabinet={draft.targetCabinetB}
              onSpecimen={(id) => patch({ specimenBId: id })}
              onCabinet={(id) => patch({ targetCabinetB: id })}
            />
          </div>

          <label className="full-line">
            <span>调换凭据 *（批准文号 / 馆务记录）</span>
            <input
              value={draft.voucher}
              placeholder="如：柜位调整单 GD-20260920-03"
              onChange={(event) => patch({ voucher: event.target.value })}
            />
          </label>
          <label className="full-line">
            <span>备注</span>
            <input
              value={draft.note ?? ""}
              placeholder="对调事由（选填）"
              onChange={(event) => patch({ note: event.target.value })}
            />
          </label>

          <div className="rule-box">
            <h3>整批判定{filled ? live.pass ? "（全部满足，可登记）" : "（存在不满足项）" : "（填写后实时校验）"}</h3>
            <ul className="rule-list">
              {checkLines(draft).map((line) => {
                const hit = filled && failedCodes.has(line.code);
                const ok = filled && !failedCodes.has(line.code);
                return (
                  <li key={line.code} className={hit ? "bad" : ok ? "good" : "idle"}>
                    <span className="rule-icon">{hit ? "✕" : ok ? "✓" : "·"}</span>
                    {line.label}
                  </li>
                );
              })}
            </ul>
            {live.violations.length > 0 && filled && (
              <ul className="rule-detail">
                {live.violations.map((item) => (
                  <li key={item.code + item.message}>{item.message}</li>
                ))}
              </ul>
            )}
            {formError && <div className="flash bad">{formError}</div>}
          </div>

          <div className="swap-actions">
            <button className="primary" disabled={!filled || !live.pass} onClick={submit}>
              登记对调（进入待审并锁柜）
            </button>
            <button onClick={() => setDraft(EMPTY_DRAFT)}>清空表单</button>
          </div>
        </div>

        <div className="swap-side-list">
          <h3>待审对调（{pending.length}）</h3>
          {pending.length === 0 && <p className="empty-note">当前无待审对调，柜位均未被对调锁定。</p>}
          {pending.map((swap) => (
            <PendingCard
              key={swap.id}
              swap={swap}
              state={state}
              specimenMap={specimenMap}
              onResolve={() => resolve(swap.id)}
              onWithdraw={() => store.withdrawSwap(swap.id)}
              onOpenSpecimen={onOpenSpecimen}
            />
          ))}
        </div>
      </div>

      <div className="swap-history">
        <h3>调换历史</h3>
        {history.length === 0 && <p className="empty-note">暂无生效或撤回记录。</p>}
        <div className="history-table">
          {history.map((swap) => {
            const a = specimenMap.get(swap.specimenAId);
            const b = specimenMap.get(swap.specimenBId);
            return (
              <article key={swap.id} className="history-row">
                <div className="history-head">
                  <b>{swap.id}</b>
                  <span className={`tag ${swap.status === "effective" ? "ok" : "warn"}`}>
                    {swap.status === "effective" ? "已生效" : "已撤回"}
                  </span>
                  <span className="history-time">{swap.decidedAt ? formatDate(swap.decidedAt) : "-"}</span>
                </div>
                <p>
                  <button className="link" onClick={() => onOpenSpecimen(swap.specimenAId)}>
                    {a?.collectionNo ?? swap.specimenAId}
                  </button>
                  {" → "}
                  <em>{swap.targetCabinetA}</em>
                  <span className="sep">／</span>
                  <button className="link" onClick={() => onOpenSpecimen(swap.specimenBId)}>
                    {b?.collectionNo ?? swap.specimenBId}
                  </button>
                  {" → "}
                  <em>{swap.targetCabinetB}</em>
                </p>
                <p className="voucher">凭据：{swap.voucher}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SwapSide({
  title,
  state,
  specimenId,
  targetCabinet,
  onSpecimen,
  onCabinet,
}: {
  title: string;
  state: AppState;
  specimenId: string;
  targetCabinet: string;
  onSpecimen: (id: string) => void;
  onCabinet: (id: string) => void;
}) {
  const specimen = state.specimens.find((item) => item.id === specimenId);

  return (
    <div className="swap-side">
      <h4>{title}</h4>
      <label>
        <span>选择已上柜标本</span>
        <select value={specimenId} onChange={(event) => onSpecimen(event.target.value)}>
          <option value="">请选择…</option>
          {state.specimens
            .filter((item) => item.cabinetId !== null)
            .map((item) => {
              const tags = [
                item.identifyStatus !== "已接受" ? item.identifyStatus : "",
                item.onLoan ? "外借" : "",
                isSpecimenLocked(state, item.id) ? "待审锁住" : "",
              ].filter(Boolean);
              return (
                <option key={item.id} value={item.id}>
                  {item.collectionNo} {item.species}｜{item.cabinetId}
                  {tags.length ? `（${tags.join("·")}）` : ""}
                </option>
              );
            })}
        </select>
      </label>
      <div className="move-arrow">
        <span className="cabinet-pill">{specimen?.cabinetId ?? "原柜位"}</span>
        <span className="arrow">→</span>
        <label>
          <span>登记目标柜位</span>
          <select value={targetCabinet} onChange={(event) => onCabinet(event.target.value)}>
            <option value="">请选择…</option>
            {state.cabinets.map((cabinet) => {
              const occupant = state.specimens.find((item) => item.cabinetId === cabinet.id);
              const locked = isCabinetLocked(state, cabinet.id);
              const label = occupant
                ? `占用：${occupant.collectionNo}`
                : locked
                ? "待审锁定（预留）"
                : "空柜";
              return (
                <option key={cabinet.id} value={cabinet.id}>
                  {cabinet.id}（{label}）
                </option>
              );
            })}
          </select>
        </label>
      </div>
      {specimen && (
        <p className="side-meta">
          鉴定：<span className={specimen.identifyStatus === "已接受" ? "ok-text" : "warn-text"}>
            {specimen.identifyStatus}
          </span>
          ｜{specimen.onLoan ? <span className="warn-text">外借中</span> : "在馆"}
        </p>
      )}
    </div>
  );
}

function PendingCard({
  swap,
  state,
  specimenMap,
  onResolve,
  onWithdraw,
  onOpenSpecimen,
}: {
  swap: SwapRequest;
  state: AppState;
  specimenMap: Map<string, AppState["specimens"][number]>;
  onResolve: () => void;
  onWithdraw: () => void;
  onOpenSpecimen: (id: string) => void;
}) {
  const a = specimenMap.get(swap.specimenAId);
  const b = specimenMap.get(swap.specimenBId);
  // 以当前数据复核，提示待审期间是否发生了状态变化
  const current = checkSwap(state, draftFromSwap(swap), swap.id);
  const blocking = !current.pass ? current.violations : [];

  return (
    <article className="pending-card">
      <div className="history-head">
        <b>{swap.id}</b>
        <span className="tag muted">待审</span>
        <span className="history-time">{formatDate(swap.createdAt)}</span>
      </div>
      <div className="pending-moves">
        <div>
          <button className="link" onClick={() => onOpenSpecimen(swap.specimenAId)}>
            {a?.collectionNo}
          </button>
          <span className="cabinet-pill">{a?.cabinetId}</span>
          <span className="arrow">→</span>
          <em>{swap.targetCabinetA}</em>
        </div>
        <div>
          <button className="link" onClick={() => onOpenSpecimen(swap.specimenBId)}>
            {b?.collectionNo}
          </button>
          <span className="cabinet-pill">{b?.cabinetId}</span>
          <span className="arrow">→</span>
          <em>{swap.targetCabinetB}</em>
        </div>
      </div>
      <p className="voucher">凭据：{swap.voucher}</p>
      {swap.note && <p className="voucher">事由：{swap.note}</p>}
      <p className="lock-note">🔒 {swap.targetCabinetA}、{swap.targetCabinetB} 已锁住，撤回后释放</p>

      {blocking.length > 0 && (
        <div className="flash bad">
          当前复核未通过，生效会被整批拦下（原柜位不变）：
          <ul>
            {blocking.map((item) => (
              <li key={item.code + item.message}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="swap-actions">
        <button className="primary" onClick={onResolve}>
          复核并整批生效
        </button>
        <button onClick={onWithdraw}>撤回（释放柜位）</button>
      </div>
    </article>
  );
}
