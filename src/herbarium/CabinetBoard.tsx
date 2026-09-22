import type { AppState } from "./types";
import { lockedCabinets } from "./swapRules";

/** 馆藏柜位记录：每个柜格显示占用标本 / 空闲 / 被待审对调锁定 */
export default function CabinetBoard({
  state,
  onOpenSpecimen,
}: {
  state: AppState;
  onOpenSpecimen: (id: string) => void;
}) {
  const locked = lockedCabinets(state);
  const swapOfCabinet = (cabinetId: string) =>
    state.swaps.find(
      (swap) =>
        swap.status === "pending" &&
        (swap.targetCabinetA === cabinetId || swap.targetCabinetB === cabinetId)
    );

  const zones = Array.from(new Set(state.cabinets.map((cabinet) => cabinet.zone)));

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>馆藏柜位记录</p>
          <h2>柜位图</h2>
        </div>
        <div className="legend">
          <span><i className="dot occupied" />占用</span>
          <span><i className="dot free" />空闲</span>
          <span><i className="dot locked" />待审锁定</span>
        </div>
      </div>

      <div className="cabinet-zones">
        {zones.map((zone) => (
          <div key={zone} className="cabinet-zone">
            <h3>{zone} 区</h3>
            <div className="cabinet-grid">
              {state.cabinets
                .filter((cabinet) => cabinet.zone === zone)
                .map((cabinet) => {
                  const occupant = state.specimens.find((item) => item.cabinetId === cabinet.id);
                  const pendingSwap = locked.has(cabinet.id) ? swapOfCabinet(cabinet.id) : undefined;
                  const cls = occupant ? "occupied" : pendingSwap ? "locked" : "free";
                  return (
                    <div key={cabinet.id} className={`cabinet-cell ${cls}`}>
                      <b>{cabinet.id}</b>
                      {occupant ? (
                        <button className="link" onClick={() => onOpenSpecimen(occupant.id)}>
                          {occupant.collectionNo}
                        </button>
                      ) : pendingSwap ? (
                        <span className="lock-label">
                          🔒 预留
                          <em>{pendingSwap.id}</em>
                        </span>
                      ) : (
                        <span className="muted-text">空柜</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
