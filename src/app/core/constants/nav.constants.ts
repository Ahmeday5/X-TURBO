import { MenuSection } from '../models/menu-item.model';

/**
 * Sidebar navigation, grouped into sections. This is the file to edit when
 * adding/removing pages — the sidebar component only renders what's declared
 * here, filtered reactively by the current user's roles/permissions.
 *
 * `roles`/`permissions` are OR-gates: an item with both shows when the user
 * satisfies *either*. Omit both to make an item visible to everyone.
 */
export const NAV_SECTIONS: MenuSection[] = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', route: '/dashboard', icon: 'home' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { id: 'users', label: 'Users', route: '/users', icon: 'users', permissions: ['Users.Manage'] },
      { id: 'settings', label: 'Settings', route: '/settings', icon: 'settings', roles: ['Admin'] },
    ],
  },
];
