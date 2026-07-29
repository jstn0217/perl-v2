import type { PropsWithChildren } from 'react';
import {
  ExportColumnSelector,
  type ExportColumnOption
} from './ExportColumnSelector';

interface ListToolbarProps extends PropsWithChildren {
  activeFilterCount: number;
  exportColumns: ExportColumnOption[];
  exportDisabled?: boolean;
  onClear: () => void;
  onExportColumnsChange: (columns: string[]) => void;
  onExport: () => void;
  onSearchChange: (value: string) => void;
  resultCount: number;
  resultLabel: string;
  search: string;
  searchLabel?: string;
  selectedExportColumns: string[];
}

export const ListToolbar = ({
  activeFilterCount,
  children,
  exportColumns,
  exportDisabled = false,
  onClear,
  onExportColumnsChange,
  onExport,
  onSearchChange,
  resultCount,
  resultLabel,
  search,
  searchLabel = 'Search records',
  selectedExportColumns
}: ListToolbarProps) => (
  <section className="list-toolbar" aria-label="List filters">
    <div className="list-toolbar__controls">
      <label className="list-toolbar__search">
        <span>{searchLabel}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Type to filter…"
        />
      </label>
      {children ? <div className="list-toolbar__filters">{children}</div> : null}
    </div>
    <div className="list-toolbar__summary" aria-live="polite">
      <span>
        <strong>{resultCount}</strong> {resultLabel}
        {activeFilterCount > 0 ? ` matching ${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}` : ''}
      </span>
      <div className="table-actions">
        {activeFilterCount > 0 ? (
          <button className="text-button" type="button" onClick={onClear}>
            Clear filters
          </button>
        ) : null}
        <ExportColumnSelector
          columns={exportColumns}
          onChange={onExportColumnsChange}
          selectedColumns={selectedExportColumns}
        />
        <button
          className="secondary-button secondary-button--compact"
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
        >
          Export {activeFilterCount > 0 ? 'filtered' : 'all'} CSV
        </button>
      </div>
    </div>
  </section>
);
