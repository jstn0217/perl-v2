import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ManagedUser } from '../../types/admin';

// Cap the visible result list so a large school directory stays scannable;
// the search input is the intended way to reach anything beyond the cap.
const MAX_VISIBLE_RESULTS = 5;

interface LinkPickerProps {
  directory: ManagedUser[];
  noun: 'students' | 'guardians';
  onChange: (ids: string[]) => void;
  secondaryLine?: (entry: ManagedUser) => string;
  selectedIds: string[];
}

/**
 * Inline search + chips + checkbox-list picker for linking guardians<->students
 * from within the user create/edit form. Filters the directory client-side by
 * name/email so it stays usable once a school has many accounts.
 */
export const LinkPicker = ({ directory, noun, onChange, secondaryLine, selectedIds }: LinkPickerProps) => {
  const [search, setSearch] = useState('');

  const directoryById = useMemo(() => new Map(directory.map((entry) => [entry.id, entry])), [directory]);

  const filteredDirectory = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return directory;
    return directory.filter((entry) => {
      const name = `${entry.firstName} ${entry.lastName}`.toLowerCase();
      return name.includes(term) || entry.email.toLowerCase().includes(term);
    });
  }, [directory, search]);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((entryId) => entryId !== id) : [...selectedIds, id]);
  };

  const describe = (entry: ManagedUser) => (secondaryLine ? secondaryLine(entry) : entry.email);

  return (
    <div className="link-picker">
      {selectedIds.length > 0 ? (
        <div className="link-chip-row" aria-label={`Linked ${noun}`}>
          {selectedIds.map((id) => {
            const entry = directoryById.get(id);
            const label = entry ? `${entry.firstName} ${entry.lastName}` : id;
            return (
              <button
                key={id}
                type="button"
                className="link-chip"
                onClick={() => toggle(id)}
                aria-label={`Unlink ${label}`}
              >
                <span>{label}</span>
                <X size={14} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="link-chip-row link-chip-row--empty">No {noun} linked yet.</p>
      )}

      <label className="field">
        <span>Search {noun}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
        />
      </label>

      <div className="student-link-list link-picker-list">
        {filteredDirectory.length > 0 ? (
          filteredDirectory.slice(0, MAX_VISIBLE_RESULTS).map((entry) => (
            <label key={entry.id}>
              <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={() => toggle(entry.id)} />
              <span>
                <strong>{entry.firstName} {entry.lastName}</strong>
                <small>{describe(entry)}</small>
              </span>
            </label>
          ))
        ) : (
          <p>{directory.length === 0 ? `No ${noun} accounts are available to link.` : 'No matches.'}</p>
        )}
        {filteredDirectory.length > MAX_VISIBLE_RESULTS ? (
          <p className="link-picker-more">
            {filteredDirectory.length - MAX_VISIBLE_RESULTS} more not shown. Refine the search to narrow the list.
          </p>
        ) : null}
      </div>
    </div>
  );
};
