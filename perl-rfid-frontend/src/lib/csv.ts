const protectSpreadsheetCell = (value: string) =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;

const escapeCsvCell = (value: unknown) => {
  const normalized = protectSpreadsheetCell(value === null || value === undefined ? '' : String(value));
  return `"${normalized.replaceAll('"', '""')}"`;
};

export const downloadCsv = (
  filename: string,
  headers: string[],
  rows: unknown[][]
) => {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
  const url = URL.createObjectURL(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export interface CsvColumn<Row> {
  key: string;
  label: string;
  value: (row: Row) => unknown;
}

export const downloadCsvColumns = <Row,>(
  filename: string,
  columns: CsvColumn<Row>[],
  selectedColumnKeys: string[],
  rows: Row[]
) => {
  const selected = new Set(selectedColumnKeys);
  const includedColumns = columns.filter((column) => selected.has(column.key));
  if (includedColumns.length === 0) {
    throw new Error('Select at least one column to export.');
  }

  downloadCsv(
    filename,
    includedColumns.map((column) => column.label),
    rows.map((row) => includedColumns.map((column) => column.value(row)))
  );
};

export const downloadResponse = async (response: Response, fallbackFilename: string) => {
  if (!response.ok) throw new Error(`Unable to export records (${response.status})`);
  const disposition = response.headers.get('Content-Disposition');
  const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallbackFilename;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const parseCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted value.');
  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
};
