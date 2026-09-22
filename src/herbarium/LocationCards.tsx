import { useMemo } from "react";
import type { AppState, LocationCard } from "./types";

/** 采集地点信息卡：按采集地点聚合，含海拔/生境/采集人及该点标本清单 */
export default function LocationCards({
  state,
  onOpenSpecimen,
}: {
  state: AppState;
  onOpenSpecimen: (id: string) => void;
}) {
  const cards = useMemo<LocationCard[]>(() => {
    const map = new Map<string, LocationCard>();
    state.specimens.forEach((specimen) => {
      const key = specimen.location;
      const card = map.get(key);
      if (!card) {
        map.set(key, {
          name: key,
          region: key,
          elevation: specimen.elevation,
          habitat: specimen.habitat,
          collectors: specimen.collectors,
          specimenNos: [specimen.id],
        });
      } else {
        card.specimenNos.push(specimen.id);
      }
    });
    return Array.from(map.values());
  }, [state.specimens]);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>采集地点信息卡</p>
          <h2>采集点（{cards.length}）</h2>
        </div>
      </div>
      <div className="location-grid">
        {cards.map((card) => {
          const specimens = card.specimenNos
            .map((id) => state.specimens.find((item) => item.id === id)!)
            .filter(Boolean);
          const elevations = specimens.map((item) => item.elevation).filter(Boolean);
          return (
            <article key={card.name} className="location-card">
              <h3>{card.name}</h3>
              <p className="loc-meta">
                <span>海拔 {elevations.length ? `${Math.min(...elevations)}–${Math.max(...elevations)}` : "—"} m</span>
              </p>
              <p className="loc-habitat">{specimens[0]?.habitat}</p>
              <p className="loc-collectors">采集人：{specimens[0]?.collectors}</p>
              <ul className="loc-specimens">
                {specimens.map((specimen) => (
                  <li key={specimen.id}>
                    <button className="link" onClick={() => onOpenSpecimen(specimen.id)}>
                      {specimen.collectionNo}
                    </button>
                    <span className="muted-text">{specimen.species}</span>
                    {specimen.cabinetId ? (
                      <em className="cabinet-mini">{specimen.cabinetId}</em>
                    ) : (
                      <span className="tag muted">未上柜</span>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
