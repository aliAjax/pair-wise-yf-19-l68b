export function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function formatDay(iso: string): string {
  return formatDate(iso).slice(0, 10);
}

export function statusTone(status: string): string {
  if (status === "已接受" || status === "已入库" || status === "effective") return "ok";
  if (status === "存疑" || status === "待压制" || status === "withdrawn") return "warn";
  return "muted";
}
