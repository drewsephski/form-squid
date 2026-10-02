const formulaPrefix = /^[\u0000-\u0020\uFEFF]*[=+\-@]/;

export function csvCell(value: string) {
  const safe = formulaPrefix.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvRow(values: string[]) {
  return `${values.map(csvCell).join(",")}\r\n`;
}
