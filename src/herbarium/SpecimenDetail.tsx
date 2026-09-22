import { useMemo } from "react";
import type { AppState } from "./types";
import { isSpecimenLocked } from "./swapRules";
import { store } from "./store";
import { formatDate } from "./format";

export default function SpecimenDetail({
  state,
  specimenId,
  onClose,
}: {
  state: AppState;
  specimenId: string;
  onClose: () => void;
}) {
  const specimen = state.specimens.find((item) => item.id === specimenId);

  const relatedSwaps = useMemo(
    () =>
      specimen
        ? state.swaps.filter(
            (item) => item.specimenAId === specimen.id || item.specimenBId === specimen.id
          )
        : [],
    [state.swaps, specimen]
  );

  if (!specimen) return null;

  const locked = isSpecimenLocked(state, specimen.id);
  const freeCabinets = state.cabinets.filter(
    (cabinet) =>
      !state.specimens.some((item) => item.cabinetId === cabinet.id) &&
      !state.swaps.some(
        (swap) =>
          swap.status === "pending" &&
          (swap.targetCabinetA === cabinet.id || swap.targetCabinetB === cabinet.id)
      )
  );

  return (
    <div className="modal-mask" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="heading">
          <div>
            <p>标本详情</p>
            <h2>{specimen.collectionNo}</h2>
          </div>
          <button onClick={onClose}>关闭</button>
        </div>

        <div className="detail-tags">
          <span className={`tag ${specimen.pressStatus === "已入库" ? "ok" : "muted"}`}>
            {specimen.pressStatus}
          </span>
          <span className={`tag ${specimen.identifyStatus === "已接受" ? "ok" : specimen.identifyStatus === "存疑" ? "warn" : "muted"}`}>
            鉴定：{specimen.identifyStatus}
          </span>
          {specimen.onLoan && <span className="tag warn">外借中{specimen.loanNote ? `·${specimen.loanNote}` : ""}</span>}
          {locked && <span className="tag warn">🔒 待审对调锁定中</span>}
        </div>

        <dl className="detail-grid">
          <div><dt>物种名称</dt><dd>{specimen.species}</dd></div>
          <div><dt>科</dt><dd>{specimen.family}</dd></div>
          <div><dt>采集地点</dt><dd>{specimen.location}</dd></div>
          <div><dt>海拔</dt><dd>{specimen.elevation} m</dd></div>
          <div className="span-2"><dt>生境描述</dt><dd>{specimen.habitat}</dd></div>
          <div><dt>采集人</dt><dd>{specimen.collectors}</dd></div>
          <div><dt>登记时间</dt><dd>{formatDate(specimen.receivedAt)}</dd></div>
          <div className="span-2">
            <dt>馆藏位置</dt>
            <dd>
              {specimen.cabinetId ? (
                <strong className="cabinet-now">{specimen.cabinetId}</strong>
              ) : (
                <span className="muted-text">尚未上柜（入库队列）</span>
              )}
            </dd>
          </div>
        </dl>

        {specimen.cabinetId === null && (
          <div className="detail-action">
            <label>
              <span>上柜到空闲柜位</span>
              <select
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) store.shelve(specimen.id, event.target.value);
                }}
              >
                <option value="" disabled>
                  选择柜位…
                </option>
                {freeCabinets.map((cabinet) => (
                  <option key={cabinet.id} value={cabinet.id}>
                    {cabinet.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="detail-action inline">
          <label>
            <span>鉴定状态</span>
            <select
              value={specimen.identifyStatus}
              disabled={locked}
              onChange={(event) =>
                store.setIdentify(specimen.id, event.target.value as AppState["specimens"][number]["identifyStatus"])
              }
            >
              <option>待鉴定</option>
              <option>已接受</option>
              <option>存疑</option>
            </select>
          </label>
          <label className="switch">
            <span>外借状态</span>
            <button
              className={specimen.onLoan ? "warn-btn" : ""}
              disabled={locked}
              onClick={() => store.toggleLoan(specimen.id, !specimen.onLoan)}
            >
              {specimen.onLoan ? "办理归还" : "登记外借"}
            </button>
          </label>
        </div>

        <section className="move-log">
          <h3>柜位记录</h3>
          {specimen.moves.length === 0 && <p className="empty-note">暂无柜位变动。</p>}
          <ol>
            {specimen.moves.map((move, index) => (
              <li key={index}>
                <span className="tag ok">{move.type}</span>
                <span className="muted-text">{formatDate(move.at)}</span>
                <span>
                  {move.from ?? "—"} <span className="arrow">→</span> {move.to}
                </span>
                {move.swapId && <em className="swap-ref">关联 {move.swapId}</em>}
              </li>
            ))}
          </ol>
        </section>

        <section className="move-log">
          <h3>调换历史</h3>
          {relatedSwaps.length === 0 && <p className="empty-note">该标本未参与过柜位对调。</p>}
          {relatedSwaps.map((swap) => (
            <div key={swap.id} className="swap-ref-line">
              <b>{swap.id}</b>
              <span className={`tag ${swap.status === "effective" ? "ok" : swap.status === "withdrawn" ? "warn" : "muted"}`}>
                {swap.status === "effective" ? "已生效" : swap.status === "withdrawn" ? "已撤回" : "待审"}
              </span>
              <span>
                目标 {swap.specimenAId === specimen.id ? swap.targetCabinetA : swap.targetCabinetB}
              </span>
              <span className="muted-text">{swap.voucher}</span>
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
