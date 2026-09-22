import { useState } from "react";
import "./styles.css";
import { useAppState, store } from "./herbarium/store";
import IntakeForm from "./herbarium/IntakeForm";
import SpecimenList from "./herbarium/SpecimenList";
import CabinetBoard from "./herbarium/CabinetBoard";
import LocationCards from "./herbarium/LocationCards";
import SwapPanel from "./herbarium/SwapPanel";
import SpecimenDetail from "./herbarium/SpecimenDetail";
import { lockedCabinets, lockedSpecimens } from "./herbarium/swapRules";

function App() {
  const state = useAppState();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [prefillA, setPrefillA] = useState<string | null>(null);

  const queue = state.specimens.filter((item) => item.cabinetId === null).length;
  const pendingIdentify = state.specimens.filter((item) => item.identifyStatus === "待鉴定").length;
  const shelved = state.specimens.filter((item) => item.cabinetId !== null).length;
  const sites = new Set(state.specimens.map((item) => item.location)).size;
  const pendingSwaps = state.swaps.filter((item) => item.status === "pending");
  const lockedCabCount = lockedCabinets(state).size;
  const lockedSpecimenCount = lockedSpecimens(state).size;

  const startSwap = (specimenId: string) => {
    setPrefillA(specimenId);
    document.getElementById("swap")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="app">
      <section className="hero compact">
        <p>hxyfront-62007 · 植物标本馆 · 压制标本入库</p>
        <h1>植物标本馆入库台</h1>
        <span>
          登记采集信息、压制与鉴定后上柜；支持柜位对调整批判定、待审锁柜与生效后全视图同步。数据保存在浏览器本地，刷新不丢失。
        </span>
      </section>

      <section className="metrics">
        <article><small>入库队列</small><strong>{queue}</strong></article>
        <article><small>待鉴定</small><strong>{pendingIdentify}</strong></article>
        <article><small>已上柜</small><strong>{shelved}</strong></article>
        <article><small>采集点</small><strong>{sites}</strong></article>
      </section>

      {pendingSwaps.length > 0 && (
        <div className="lock-banner">
          🔒 {pendingSwaps.length} 笔对调待审：{lockedCabCount} 个柜位、{lockedSpecimenCount} 件标本被锁定；
          撤回对应对调单即可释放。
        </div>
      )}

      <section className="workspace wide">
        <IntakeForm />
      </section>

      <SpecimenList
        state={state}
        onOpenSpecimen={setDetailId}
        onStartSwap={startSwap}
      />

      <div className="stack-gap">
        <SwapPanel
          state={state}
          onOpenSpecimen={setDetailId}
          prefillA={prefillA}
          onPrefillConsumed={() => setPrefillA(null)}
        />
      </div>

      <CabinetBoard state={state} onOpenSpecimen={setDetailId} />
      <LocationCards state={state} onOpenSpecimen={setDetailId} />

      <footer className="foot">
        <button onClick={() => {
          if (window.confirm("确定恢复为演示种子数据？当前所有登记将被清除。")) store.resetDemo();
        }}>
          重置演示数据
        </button>
        <span>判定 · 流转 · 展示 已拆分到 swapRules.ts / swapFlow.ts / SwapPanel.tsx</span>
      </footer>

      {detailId && (
        <SpecimenDetail state={state} specimenId={detailId} onClose={() => setDetailId(null)} />
      )}
    </main>
  );
}

export default App;
