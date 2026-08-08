import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { SessionUser } from '../lib/api';

interface AccountMenuProps {
  user: SessionUser;
  roleLabel: string;
  onSignOut: () => void;
}

export const AccountMenu = ({ user, roleLabel, onSignOut }: AccountMenuProps) => {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const close = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

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
