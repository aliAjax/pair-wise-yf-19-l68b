// 植物标本馆入库领域模型

export type PressStatus = "待压制" | "已压制" | "已入库";

export type IdentifyStatus = "待鉴定" | "已接受" | "存疑";

export interface LocationInfo {
  /** 采集地点主键，如 天目山 */
  name: string;
  region: string;
  elevation: number;
  habitat: string;
  collectors: string;
}

export interface LocationCard extends LocationInfo {
  /** 该地点下的标本采集号列表 */
  specimenNos: string[];
}

export interface Specimen {
  id: string;
  collectionNo: string;
  species: string;
  family: string;
  location: string;
  elevation: number;
  habitat: string;
  collectors: string;
  pressStatus: PressStatus;
  identifyStatus: IdentifyStatus;
  /** 柜位编码，未上柜为 null */
  cabinetId: string | null;
  /** 是否外借 */
  onLoan: boolean;
  loanNote?: string;
  receivedAt: string;
  /** 柜位变更流水，含上柜与对调 */
  moves: CabinetMove[];
}

export interface CabinetMove {
  at: string;
  type: "上柜" | "对调" | "撤回";
  from: string | null;
  to: string | null;
  /** 关联的对调单号 */
  swapId?: string;
  note?: string;
}

export interface Cabinet {
  id: string;
  zone: string;
  shelf: string;
}

export type SwapStatus = "pending" | "effective" | "withdrawn";

export interface SwapRequest {
  id: string;
  specimenAId: string;
  specimenBId: string;
  targetCabinetA: string;
  targetCabinetB: string;
  voucher: string;
  note?: string;
  status: SwapStatus;
  createdAt: string;
  decidedAt?: string;
  /** 生效前最后一次复核的判定结果（撤回时保留提交时快照） */
  check?: RuleCheckResult;
}

export interface RuleViolation {
  code: string;
  message: string;
  level: "error" | "warning";
}

export interface RuleCheckResult {
  pass: boolean;
  violations: RuleViolation[];
  checkedAt: string;
}

export interface AppState {
  specimens: Specimen[];
  cabinets: Cabinet[];
  swaps: SwapRequest[];
  /** 待办对调在表单上的草稿（刷新后不保留） */
  seq: number;
}
