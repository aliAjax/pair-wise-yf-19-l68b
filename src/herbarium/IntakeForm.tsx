import { useState } from "react";
import { store } from "./store";

export default function IntakeForm() {
  const [form, setForm] = useState({
    collectionNo: "",
    species: "",
    family: "",
    location: "",
    elevation: "",
    habitat: "",
    collectors: "",
    pressed: true,
  });
  const [done, setDone] = useState(false);

  const patch = (part: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...part }));

  const canSubmit =
    form.collectionNo.trim() && form.species.trim() && form.location.trim() && form.collectors.trim();

  const submit = () => {
    store.receive({
      collectionNo: form.collectionNo,
      species: form.species,
      family: form.family || "未分科",
      location: form.location,
      elevation: Number(form.elevation) || 0,
      habitat: form.habitat || "—",
      collectors: form.collectors,
      pressed: form.pressed,
    });
    setForm({
      collectionNo: "",
      species: "",
      family: "",
      location: "",
      elevation: "",
      habitat: "",
      collectors: "",
      pressed: true,
    });
    setDone(true);
    window.setTimeout(() => setDone(false), 3000);
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>压制标本入库</p>
          <h2>新增登记</h2>
        </div>
        <button className="primary" disabled={!canSubmit} onClick={submit}>
          加入入库队列
        </button>
      </div>
      {done && <div className="flash ok">已登记并进入入库队列，可在详情中压制、鉴定与上柜。</div>}
      <div className="field-grid">
        <label>
          <span>采集号 *</span>
          <input value={form.collectionNo} placeholder="如 HX-240922-01" onChange={(e) => patch({ collectionNo: e.target.value })} />
        </label>
        <label>
          <span>物种名称 *</span>
          <input value={form.species} placeholder="属种或待定名" onChange={(e) => patch({ species: e.target.value })} />
        </label>
        <label>
          <span>科</span>
          <input value={form.family} placeholder="如 菊科" onChange={(e) => patch({ family: e.target.value })} />
        </label>
        <label>
          <span>采集地点 *</span>
          <input value={form.location} placeholder="山系·小地名" onChange={(e) => patch({ location: e.target.value })} />
        </label>
        <label>
          <span>海拔（m）</span>
          <input type="number" value={form.elevation} placeholder="如 1420" onChange={(e) => patch({ elevation: e.target.value })} />
        </label>
        <label>
          <span>采集人 *</span>
          <input value={form.collectors} placeholder="多人用、分隔" onChange={(e) => patch({ collectors: e.target.value })} />
        </label>
        <label className="span-2">
          <span>生境描述</span>
          <input value={form.habitat} placeholder="植被、坡向、湿度等" onChange={(e) => patch({ habitat: e.target.value })} />
        </label>
        <label className="check-line">
          <input
            type="checkbox"
            checked={form.pressed}
            onChange={(e) => patch({ pressed: e.target.checked })}
          />
          <span>已完成压制（未勾选进入“待压制”）</span>
        </label>
      </div>
    </section>
  );
}
