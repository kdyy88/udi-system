export function toYymmdd(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return undefined;
  }
  return `${year.slice(-2)}${month}${day}`;
}

export function toDisplayDate(yymmdd?: string | null): string {
  if (!yymmdd || yymmdd.length !== 6) {
    return "-";
  }
  return `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`;
}
