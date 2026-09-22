import { useMemo, useState } from "react";
import "./styles.css";
import { CABINET_CODES } from "./herbarium/data";
import { lockedCabinetCodes } from "./herbarium/swapRules";
import { useHerbariumState, useSwapStore, type NewSpecimenInput } from "./herbarium/swapFlow";
import { SwapForm, SwapOrdersPanel, SwapStatusBadge } from "./herbarium/swapViews";
import type { Specimen } from "./herbarium/types";

const FILTERS = ["全部", "待压制", "待鉴定", "已入库", "需补照"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(s: Specimen, f: Filter): boolean {
  switch (f) {
    case "全部":
      return true;
    case "待压制":
      return s.pressStatus === "未压制";
    case "待鉴定":
      return s.identification === "待鉴定";
    case "已入库":
      return s.positionCode !== null;
    case "需补照":
      return s.needsPhoto;
  }
}

function idBadges(s: Specimen) {
  const tone =
    s.identification === "鉴定已接受"
      ? "badge-ok"
      : s.identification === "鉴定被驳回"
        ? "badge-bad"
        : "badge-warn";
  return (
    <span className="badges">
      <em className={`badge ${tone}`}>{s.identification}</em>
      <em className={`badge ${s.pressStatus === "已压制" ? "badge-ok" : "badge-warn"}`}>{s.pressStatus}</em>
      {s.loaned && <em className="badge badge-bad">外借中</em>}
      {s.needsPhoto && <em className="badge badge-warn">需补照</em>}
    </span>
  );
}

function SpecimenDetail({ specimen, onClose }: { specimen: Specimen; onClose: () => void }) {
  const state = useHerbariumState();
  const relatedSwaps = state.swaps.filter((o) => o.legs.some((l) => l.specimenId === specimen.id));

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <p>标本详情</p>
            <h2>{specimen.collectionNo}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </header>

        <h3>{specimen.species}</h3>
        {idBadges(specimen)}

        <dl className="detail-grid">
          <div>
            <dt>当前馆藏柜位</dt>
            <dd>{specimen.positionCode ? <b className="pos-code">{specimen.positionCode}</b> : "未上柜"}</dd>
          </div>
          <div>
            <dt>采集地点</dt>
            <dd>{specimen.locality}</dd>
          </div>
          <div>
            <dt>海拔</dt>
            <dd>{specimen.altitude === null ? "—" : `${specimen.altitude} m`}</dd>
          </div>
          <div>
            <dt>采集人</dt>
            <dd>{specimen.collector}</dd>
          </div>
          <div className="full">
            <dt>生境描述</dt>
            <dd>{specimen.habitat || "—"}</dd>
          </div>
          <div className="full">
            <dt>备注</dt>
            <dd>{specimen.remark || "—"}</dd>
          </div>
          <div>
            <dt>入库登记时间</dt>
            <dd>{specimen.createdAt}</dd>
          </div>
        </dl>

        <h4>柜位变更记录</h4>
        {specimen.positionHistory.length === 0 ? (
          <p className="hint">该标本尚未上柜，暂无柜位记录。</p>
        ) : (
          <ul className="history-list">
            {specimen.positionHistory.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <time>{e.at}</time>
                <span>
                  {e.from ?? "未上柜"} <b>→</b> {e.to ?? "下架"}
                </span>
                <small>{e.reason}</small>
              </li>
            ))}
          </ul>
        )}

        <h4>相关柜位对调单</h4>
        {relatedSwaps.length === 0 ? (
          <p className="hint">未参与柜位对调。</p>
        ) : (
          <ul className="history-list">
            {relatedSwaps.map((o) => (
              <li key={o.id}>
                <time>{o.id}</time>
                <span>
                  {o.legs.find((l) => l.specimenId === specimen.id)?.fromCode} <b>→</b>{" "}
                  {o.legs.find((l) => l.specimenId === specimen.id)?.toCode}
                </span>
                <small>
                  凭据 {o.credential}
                </small>
                <SwapStatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewSpecimenForm() {
  const store = useSwapStore();
  const [form, setForm] = useState<NewSpecimenInput>({
    collectionNo: "",
    species: "",
    locality: "",
    altitude: null,
    habitat: "",
    collector: "",
    pressStatus: "未压制",
    identification: "待鉴定",
    remark: "",
  });
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof NewSpecimenInput>(key: K, value: NewSpecimenInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    if (!form.collectionNo.trim() || !form.species.trim()) return;
    store.dispatch({ type: "addSpecimen", input: { ...form, collectionNo: form.collectionNo.trim(), species: form.species.trim() } });
    setSaved(true);
    setForm({
      collectionNo: "",
      species: "",
      locality: "",
      altitude: null,
      habitat: "",
      collector: "",
      pressStatus: "未压制",
      identification: "待鉴定",
      remark: "",
    });
    window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>专业字段</p>
          <h2>新增入库记录</h2>
        </div>
        <button className="primary" onClick={submit}>
          进入入库队列
        </button>
      </div>
      <div className="field-grid">
        <label>
          <span>采集号</span>
          <input value={form.collectionNo} onChange={(e) => set("collectionNo", e.target.value)} placeholder="如 HX-260922-01" />
        </label>
        <label>
          <span>物种名称</span>
          <input value={form.species} onChange={(e) => set("species", e.target.value)} placeholder="填写物种名称" />
        </label>
        <label>
          <span>采集地点</span>
          <input value={form.locality} onChange={(e) => set("locality", e.target.value)} placeholder="省/保护区/小地名" />
        </label>
        <label>
          <span>海拔（m）</span>
          <input
            type="number"
            value={form.altitude ?? ""}
            onChange={(e) => set("altitude", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="如 1420"
          />
        </label>
        <label>
          <span>采集人</span>
          <input value={form.collector} onChange={(e) => set("collector", e.target.value)} placeholder="采集人姓名" />
        </label>
        <label>
          <span>压制 / 鉴定状态</span>
          <div className="dual-select">
            <select className="swap-input" value={form.pressStatus} onChange={(e) => set("pressStatus", e.target.value as NewSpecimenInput["pressStatus"])}>
              <option>未压制</option>
              <option>已压制</option>
            </select>
            <select className="swap-input" value={form.identification} onChange={(e) => set("identification", e.target.value as NewSpecimenInput["identification"])}>
              <option>待鉴定</option>
              <option>鉴定已接受</option>
              <option>鉴定被驳回</option>
            </select>
          </div>
        </label>
        <label className="full">
          <span>生境描述</span>
          <input value={form.habitat} onChange={(e) => set("habitat", e.target.value)} placeholder="坡向、植被、伴生种等" />
        </label>
        <label className="full">
          <span>备注</span>
          <input value={form.remark} onChange={(e) => set("remark", e.target.value)} placeholder="可留空" />
        </label>
      </div>
      {saved && <p className="inline-ok">已进入入库队列。</p>}
    </section>
  );
}

function App() {
  const state = useHerbariumState();
  const store = useSwapStore();
  const [filter, setFilter] = useState<Filter>("全部");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { specimens, swaps } = state;
  const locked = useMemo(() => lockedCabinetCodes(swaps), [swaps]);

  const metrics = [
    { label: "入库队列", value: specimens.filter((s) => s.positionCode === null).length },
    { label: "待鉴定", value: specimens.filter((s) => s.identification === "待鉴定").length },
    { label: "已上柜", value: specimens.filter((s) => s.positionCode !== null).length },
    { label: "采集点", value: new Set(specimens.map((s) => s.locality)).size },
  ];

  const queue = specimens.filter((s) => matchesFilter(s, filter));
  const detail = specimens.find((s) => s.id === detailId) ?? null;

  // 采集地点信息卡：按地点汇总已上柜标本
  const localityCards = useMemo(() => {
    const map = new Map<string, { specimens: Specimen[]; altitude: number | null; habitat: string }>();
    specimens
      .filter((s) => s.positionCode !== null)
      .forEach((s) => {
        const card = map.get(s.locality) ?? { specimens: [], altitude: s.altitude, habitat: s.habitat };
        card.specimens.push(s);
        map.set(s.locality, card);
      });
    return [...map.entries()];
  }, [specimens]);

  return (
    <main className="app">
      <section className="hero compact">
        <p>hxyfront-62007 · 植物标本馆</p>
        <h1>植物标本馆入库</h1>
        <span>压制标本入库登记、鉴定流转与馆藏柜位管理；柜位对调整批生效，刷新后记录保留。</span>
        <div className="hero-tools">
          <button onClick={() => {
            if (window.confirm("将清空本地改动并恢复初始演示数据，确定？")) {
              store.dispatch({ type: "reset" });
              setDetailId(null);
            }
          }}>
            恢复演示数据
          </button>
        </div>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <SwapForm />

      <section className="workspace">
        <aside className="panel">
          <h2>标本馆筛选</h2>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f} className={filter === f ? "chip-on" : ""} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <p className="hint filter-count">当前队列 {queue.length} 份</p>
        </aside>

        <section className="panel">
          <div className="heading">
            <div>
              <p>入库队列</p>
              <h2>标本工作台</h2>
            </div>
          </div>
          <div className="records">
            {queue.map((s) => (
              <article key={s.id} className="record-row clickable" onClick={() => setDetailId(s.id)}>
                <div>
                  <h3>
                    {s.collectionNo} <small className="species-sub">{s.species}</small>
                  </h3>
                  <p>
                    {s.locality}
                    {s.altitude !== null && ` · 海拔${s.altitude}m`} · {s.collector}
                  </p>
                  {idBadges(s)}
                </div>
                <div className="record-pos">
                  {s.positionCode ? (
                    <>
                      <b className="pos-code">{s.positionCode}</b>
                      {locked.has(s.positionCode) && <em className="badge badge-warn">柜位锁定</em>}
                    </>
                  ) : (
                    <em className="badge badge-warn">未上柜</em>
                  )}
                  <span className="view-link">查看详情</span>
                </div>
              </article>
            ))}
            {queue.length === 0 && <p className="hint">该筛选下暂无标本。</p>}
          </div>
        </section>
      </section>

      <section className="split-panels">
        <section className="panel">
          <div className="heading">
            <div>
              <p>馆藏柜位记录</p>
              <h2>柜位册</h2>
            </div>
          </div>
          <div className="cabinet-grid">
            {CABINET_CODES.map((code) => {
              const occ = specimens.find((s) => s.positionCode === code);
              const isLocked = locked.has(code);
              return (
                <button
                  key={code}
                  className={`cabinet-cell ${occ ? "occupied" : "empty"} ${isLocked ? "locked" : ""}`}
                  disabled={!occ}
                  onClick={() => occ && setDetailId(occ.id)}
                >
                  <b>{code}</b>
                  {occ ? (
                    <span>
                      {occ.collectionNo}
                      <small>{occ.species}</small>
                    </span>
                  ) : (
                    <span className="cabinet-empty">空柜</span>
                  )}
                  {isLocked && <em className="cabinet-lock">待审锁定</em>}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="heading">
            <div>
              <p>采集地点信息卡</p>
              <h2>采集点</h2>
            </div>
          </div>
          <div className="locality-list">
            {localityCards.map(([locality, card]) => (
              <article key={locality} className="locality-card">
                <h3>{locality}</h3>
                <p>
                  {card.altitude !== null && `海拔 ${card.altitude}m · `}
                  {card.habitat}
                </p>
                <div className="locality-specimens">
                  {card.specimens.map((s) => (
                    <button key={s.id} onClick={() => setDetailId(s.id)}>
                      {s.collectionNo} · {s.positionCode}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <NewSpecimenForm />
      <SwapOrdersPanel />

      {detail && <SpecimenDetail specimen={detail} onClose={() => setDetailId(null)} />}
    </main>
  );
}

export default App;
