// 植物标本馆入库 —— 数据模型

/** 压制状态 */
export type PressStatus = "未压制" | "已压制";

/** 鉴定状态 */
export type IdentificationStatus = "待鉴定" | "鉴定已接受" | "鉴定被驳回";

/** 入库阶段（用于队列筛选） */
export type Stage = "待压制" | "待鉴定" | "已上柜" | "需补照";

/** 标本 */
export interface Specimen {
  id: string;
  /** 采集号 */
  collectionNo: string;
  /** 物种名称 */
  species: string;
  /** 采集地点 */
  locality: string;
  /** 海拔（米） */
  altitude: number | null;
  /** 生境描述 */
  habitat: string;
  /** 采集人 */
  collector: string;
  pressStatus: PressStatus;
  identification: IdentificationStatus;
  /** 当前柜位编码；null 表示尚未上柜 */
  positionCode: string | null;
  /** 是否外借中 */
  loaned: boolean;
  /** 是否需要补照 */
  needsPhoto: boolean;
  /** 备注 */
  remark: string;
  createdAt: string;
  /** 柜位变更历史（最近的在末尾） */
  positionHistory: PositionEvent[];
}

export interface PositionEvent {
  at: string;
  from: string | null;
  to: string | null;
  reason: string;
}

/** 调换单的一条腿：某标本由原柜移动到目标柜 */
export interface SwapLeg {
  specimenId: string;
  specimenNo: string;
  fromCode: string;
  toCode: string;
}

/** 调换单状态 */
export type SwapStatus = "待审" | "已生效" | "已驳回" | "已撤回";

/** 柜位对调单 */
export interface SwapOrder {
  id: string;
  status: SwapStatus;
  /** 调换凭据（调拨单号 / 批条） */
  credential: string;
  legs: [SwapLeg, SwapLeg];
  createdAt: string;
  /** 终态时间 */
  decidedAt: string | null;
  /** 驳回原因（逐条条件） */
  rejectReasons: string[];
  /** 凭据登记人 */
  operator: string;
}

/** 整体持久化状态 */
export interface HerbariumState {
  specimens: Specimen[];
  swaps: SwapOrder[];
  swapSeq: number;
}
