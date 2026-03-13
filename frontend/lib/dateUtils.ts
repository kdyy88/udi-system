export function toYymmdd(value: string): string | undefined {
  if (!value) return undefined;

  if (/^\d{2}\/\d{2}\/\d{2}$/.test(value)) {
    return value.replaceAll("/", "");
  }

  if (/^\d{6}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${year.slice(-2)}${month}${day}`;
  }

  return undefined;
}

export function toTransferDate(value: string): string | undefined {
  const yymmdd = toYymmdd(value);
  if (!yymmdd) return undefined;
  return `${yymmdd.slice(0, 2)}/${yymmdd.slice(2, 4)}/${yymmdd.slice(4, 6)}`;
}

export function toDisplayDate(value?: string | null): string {
  if (!value) return "-";
  const transfer = toTransferDate(value);
  return transfer ?? "-";
}
