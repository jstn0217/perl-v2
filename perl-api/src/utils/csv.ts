const protectSpreadsheetCell = (value: string) =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;

const escapeCsvCell = (value: unknown) => {
  const normalized = protectSpreadsheetCell(value === null || value === undefined ? '' : String(value));
  return `"${normalized.replaceAll('"', '""')}"`;
};

export const createCsv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');

export interface CsvColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => unknown;
}

export const readSelectedCsvColumns = <Row>(
  value: unknown,
  columns: CsvColumn<Row>[]
) => {
  if (value === undefined) return columns;
  if (typeof value !== 'string') throw new Error('Invalid export columns.');

  const requestedKeys = value
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (requestedKeys.length === 0) throw new Error('Select at least one export column.');

  const allowedKeys = new Set(columns.map((column) => column.key));
  if (requestedKeys.some((key) => !allowedKeys.has(key))) {
    throw new Error('Invalid export column selection.');
  }

  const requested = new Set(requestedKeys);
  return columns.filter((column) => requested.has(column.key));
};

export const sendCsvColumnDownload = <Row>(
  res: import('express').Response,
  filename: string,
  columns: CsvColumn<Row>[],
  rows: Row[]
) =>
  sendCsvDownload(
    res,
    filename,
    columns.map((column) => column.label),
    rows.map((row) => columns.map((column) => column.value(row)))
  );

export const sendCsvDownload = (
  res: import('express').Response,
  filename: string,
  headers: string[],
  rows: unknown[][]
) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`\uFEFF${createCsv(headers, rows)}`);
};
