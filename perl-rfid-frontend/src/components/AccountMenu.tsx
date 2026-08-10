import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SessionUser } from '../lib/api';

interface AccountMenuProps {
  user: SessionUser;
  roleLabel: string;
  onSignOut: () => void;
}

export const AccountMenu = ({ user, roleLabel, onSignOut }: AccountMenuProps) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const close = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  useEffect(() => {
    const detailsEl = detailsRef.current;
    if (!detailsEl) return;
    const handleToggle = () => setIsOpen(detailsEl.open);
    detailsEl.addEventListener('toggle', handleToggle);
    return () => detailsEl.removeEventListener('toggle', handleToggle);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (detailsRef.current && !detailsRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <details className="account-menu" ref={detailsRef}>
      <summary className="user-chip" aria-label={`Account menu for ${user.firstName} ${user.lastName}`}>
        <span className="user-chip__avatar" aria-hidden="true">
          {user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}
        </span>
        <span className="user-chip__identity">
          <strong>{user.firstName} {user.lastName}</strong>
          <small>{roleLabel}</small>
        </span>
        <ChevronDown className="user-chip__chevron" size={16} aria-hidden="true" />
      </summary>

      <div className="account-menu__panel" role="menu">
        <Link className="account-menu__item" role="menuitem" to="/account" onClick={close}>
          Edit profile
        </Link>
        <button
          className="account-menu__item account-menu__item--danger"
          role="menuitem"
          type="button"
          onClick={() => {
            close();
            onSignOut();
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  );
};
