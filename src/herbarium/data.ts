// 初始馆藏数据与浏览器持久化（刷新后柜位、调换历史仍在）
import type { HerbariumState, Specimen } from "./types";

const STORAGE_KEY = "herbarium-state-v1";

/** 柜位容量表：以柜区为单位声明存在的柜位 */
export const CABINET_CODES: string[] = [
  "A-01-02",
  "A-01-03",
  "A-02-05",
  "A-03-01",
  "B-12-03",
  "B-12-04",
  "B-12-05",
  "B-15-02",
  "C-03-07",
  "C-03-08",
  "C-06-01",
  "D-08-04",
];

function specimen(input: Omit<Specimen, "positionHistory" | "createdAt"> & Partial<Pick<Specimen, "createdAt">>): Specimen {
  return {
    createdAt: "2024-06-15 09:00",
    positionHistory: input.positionCode
      ? [{ at: "2024-06-16 10:20", from: null, to: input.positionCode, reason: "初次上柜" }]
      : [],
    ...input,
  };
}

export function initialState(): HerbariumState {
  return {
    swapSeq: 1,
    swaps: [],
    specimens: [
      specimen({
        id: "sp-01",
        collectionNo: "HX-240615-01",
        species: "青榨槭（槭属待定）",
        locality: "四川卧龙 邓生沟",
        altitude: 1420,
        habitat: "针阔混交林缘，半阴坡",
        collector: "周慕云",
        pressStatus: "已压制",
        identification: "鉴定已接受",
        positionCode: "A-01-02",
        loaned: false,
        needsPhoto: false,
        remark: "叶片完整，具翅果",
      }),
      specimen({
        id: "sp-02",
        collectionNo: "HX-240615-08",
        species: "蕨类（鳞毛蕨属待定）",
        locality: "四川卧龙 阴湿沟谷",
        altitude: 1180,
        habitat: "溪谷石缝，腐殖质丰富",
        collector: "黎国富",
        pressStatus: "已压制",
        identification: "待鉴定",
        positionCode: "A-01-03",
        loaned: false,
        needsPhoto: true,
        remark: "孢子囊群待镜检",
      }),
      specimen({
        id: "sp-03",
        collectionNo: "HX-240616-03",
        species: "毛华菊（菊科）",
        locality: "湖北神农架 板仓",
        altitude: 1650,
        habitat: "林缘灌丛，向阳",
        collector: "沈知遥",
        pressStatus: "已压制",
        identification: "鉴定已接受",
        positionCode: "B-12-04",
        loaned: false,
        needsPhoto: false,
        remark: "",
      }),
      specimen({
        id: "sp-04",
        collectionNo: "HX-240616-07",
        species: "华中五味子",
        locality: "湖北神农架 官门山",
        altitude: 1320,
        habitat: "沟谷阔叶林，攀援于灌丛",
        collector: "沈知遥",
        pressStatus: "已压制",
        identification: "鉴定已接受",
        positionCode: "B-12-05",
        loaned: true,
        needsPhoto: false,
        remark: "2026-08 借往武汉大学标本馆",
      }),
      specimen({
        id: "sp-05",
        collectionNo: "HX-240618-02",
        species: "巴山冷杉",
        locality: "陕西佛坪 光头山",
        altitude: 2410,
        habitat: "亚高山暗针叶林",
        collector: "周慕云",
        pressStatus: "已压制",
        identification: "鉴定被驳回",
        positionCode: "C-03-07",
        loaned: false,
        needsPhoto: false,
        remark: "与秦岭冷杉性状重叠，需复采",
      }),
      specimen({
        id: "sp-06",
        collectionNo: "HX-240618-11",
        species: "串果藤",
        locality: "陕西佛坪 大古坪",
        altitude: 1260,
        habitat: "落叶阔叶林林下",
        collector: "黎国富",
        pressStatus: "已压制",
        identification: "鉴定已接受",
        positionCode: "C-03-08",
        loaned: false,
        needsPhoto: false,
        remark: "",
      }),
      specimen({
        id: "sp-07",
        collectionNo: "HX-240620-04",
        species: "鹿药",
        locality: "重庆巫山 当阳大峡谷",
        altitude: 980,
        habitat: "湿润林下，腐殖土",
        collector: "高志远",
        pressStatus: "已压制",
        identification: "鉴定已接受",
        positionCode: "D-08-04",
        loaned: false,
        needsPhoto: true,
        remark: "缺花部特写",
      }),
      specimen({
        id: "sp-08",
        collectionNo: "HX-240621-06",
        species: "黄花鸢尾",
        locality: "四川王朗 牧羊场",
        altitude: 2050,
        habitat: "高山草甸沼泽边缘",
        collector: "高志远",
        pressStatus: "已压制",
        identification: "待鉴定",
        positionCode: null,
        loaned: false,
        needsPhoto: false,
        remark: "压制中，未上柜",
      }),
      specimen({
        id: "sp-09",
        collectionNo: "HX-240622-02",
        species: "领春木",
        locality: "贵州梵净山 黑湾河",
        altitude: 860,
        habitat: "沟谷常绿落叶混交林",
        collector: "唐晚晴",
        pressStatus: "未压制",
        identification: "待鉴定",
        positionCode: null,
        loaned: false,
        needsPhoto: false,
        remark: "新到馆，排队压制",
      }),
    ],
  };
}

/** 读取持久化状态；无记录或解析失败时回到初始数据 */
export function loadState(): HerbariumState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as HerbariumState;
    if (!Array.isArray(parsed.specimens) || !Array.isArray(parsed.swaps)) {
      return initialState();
    }
    return parsed;
  } catch {
    return initialState();
  }
}

export function saveState(state: HerbariumState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级：本次会话内仍可用
  }
}

export function resetState(): HerbariumState {
  const fresh = initialState();
  saveState(fresh);
  return fresh;
}
