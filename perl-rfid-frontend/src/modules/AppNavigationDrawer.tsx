import { Modal } from '../components/Modal';
import { NavigationLinks } from './NavigationLinks';
import type { UserRole } from '../types/admin';

interface AppNavigationDrawerProps {
  role: UserRole;
  onClose: () => void;
  onSignOut: () => void;
  open: boolean;
}

export const AppNavigationDrawer = ({
  role,
  onClose,
  onSignOut,
  open
}: AppNavigationDrawerProps) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Navigation"
      description="Attendance operations and school administration."
      variant="drawer"
    >
      <NavigationLinks role={role} onNavigate={onClose} />

      <button
        className="secondary-button secondary-button--danger app-drawer-signout"
        type="button"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </Modal>
  );
};
