import { useMemo, useState } from "react";
import type { AppState, IdentifyStatus } from "./types";
import { isSpecimenLocked } from "./swapRules";

type ShelfFilter = "全部" | "未上柜" | "已上柜";

/** 标本列表：鉴定状态筛选 + 上柜状态筛选 + 关键字 */
export default function SpecimenList({
  state,
  onOpenSpecimen,
  onStartSwap,
}: {
  state: AppState;
  onOpenSpecimen: (id: string) => void;
  onStartSwap: (id: string) => void;
}) {
  const [identify, setIdentify] = useState<IdentifyStatus | "全部">("全部");
  const [shelf, setShelf] = useState<ShelfFilter>("全部");
  const [keyword, setKeyword] = useState("");

  const identifyFilters: (IdentifyStatus | "全部")[] = ["全部", "待鉴定", "已接受", "存疑"];
  const shelfFilters: ShelfFilter[] = ["全部", "未上柜", "已上柜"];

  const list = useMemo(() => {
    return state.specimens.filter((item) => {
      if (identify !== "全部" && item.identifyStatus !== identify) return false;
      if (shelf === "未上柜" && item.cabinetId !== null) return false;
      if (shelf === "已上柜" && item.cabinetId === null) return false;
      if (keyword) {
        const key = keyword.trim();
        return item.collectionNo.includes(key) || item.species.includes(key) || item.family.includes(key);
      }
      return true;
    });
  }, [state.specimens, identify, shelf, keyword]);

  const queueCount = state.specimens.filter((item) => item.cabinetId === null).length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>入库队列（{queueCount} 份待上柜）</p>
          <h2>标本记录</h2>
        </div>
        <input
          className="search"
          placeholder="搜索采集号 / 物种"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>

      <div className="filters">
        <div className="chips">
          {identifyFilters.map((item) => (
            <button
              key={item}
              className={identify === item ? "chip-on" : ""}
              onClick={() => setIdentify(item)}
            >
              {item === "全部" ? "鉴定：全部" : item}
            </button>
          ))}
        </div>
        <div className="chips">
          {shelfFilters.map((item) => (
            <button key={item} className={shelf === item ? "chip-on" : ""} onClick={() => setShelf(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="specimen-table">
        <div className="specimen-row head">
          <span>采集号</span>
          <span>物种</span>
          <span>鉴定</span>
          <span>柜位</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        {list.map((item) => {
          const locked = isSpecimenLocked(state, item.id);
          return (
            <div key={item.id} className="specimen-row">
              <button className="link strong" onClick={() => onOpenSpecimen(item.id)}>
                {item.collectionNo}
              </button>
              <span>{item.species}<small className="muted-text"> {item.family}</small></span>
              <span className={`tag ${item.identifyStatus === "已接受" ? "ok" : item.identifyStatus === "存疑" ? "warn" : "muted"}`}>
                {item.identifyStatus}
              </span>
              <span>{item.cabinetId ? <em className="cabinet-mini">{item.cabinetId}</em> : <span className="muted-text">—</span>}</span>
              <span>
                {item.onLoan ? <span className="tag warn">外借</span> : <span className="tag ok">在馆</span>}
                {locked && <span className="tag warn">🔒</span>}
                <span className="muted-text"> {item.pressStatus}</span>
              </span>
              <span className="row-actions">
                <button onClick={() => onOpenSpecimen(item.id)}>详情</button>
                {item.cabinetId !== null && (
                  <button className="primary ghost" disabled={locked} onClick={() => onStartSwap(item.id)}>
                    对调
                  </button>
                )}
              </span>
            </div>
          );
        })}
        {list.length === 0 && <p className="empty-note">没有符合筛选条件的标本。</p>}
      </div>
    </section>
  );
}
