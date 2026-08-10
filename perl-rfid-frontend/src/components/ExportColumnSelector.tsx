export interface ExportColumnOption {
  key: string;
  label: string;
}

interface ExportColumnSelectorProps {
  columns: ExportColumnOption[];
  onChange: (columns: string[]) => void;
  selectedColumns: string[];
  triggerLabel?: string;
  heading?: string;
  legend?: string;
}

export const ExportColumnSelector = ({
  columns,
  onChange,
  selectedColumns,
  triggerLabel = 'Columns',
  heading = 'Export columns',
  legend = 'Columns to include in the CSV export'
}: ExportColumnSelectorProps) => {
  const selected = new Set(selectedColumns);
  const allSelected = selectedColumns.length === columns.length;

  return (
    <details className="export-columns">
      <summary>
        {triggerLabel}
        <span aria-hidden="true">{selectedColumns.length}</span>
      </summary>
      <div className="export-columns__menu">
        <div className="export-columns__heading">
          <strong>{heading}</strong>
          <button
            className="text-button"
            type="button"
            onClick={() => onChange(columns.map((column) => column.key))}
            disabled={allSelected}
          >
            Select all
          </button>
        </div>
        <fieldset>
          <legend className="sr-only">{legend}</legend>
          {columns.map((column) => {
            const checked = selected.has(column.key);
            return (
              <label key={column.key}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && selectedColumns.length === 1}
                  onChange={() =>
                    onChange(
                      checked
                        ? selectedColumns.filter((key) => key !== column.key)
                        : columns
                            .filter(
                              (option) =>
                                option.key === column.key || selected.has(option.key)
                            )
                            .map((option) => option.key)
                    )
                  }
                />
                <span>{column.label}</span>
              </label>
            );
          })}
        </fieldset>
        <p>At least one column is required.</p>
      </div>
    </details>
  );
};
