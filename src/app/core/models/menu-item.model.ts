import { IconName } from '../../shared/components/icon/icon.component';

export interface MenuItem {
  id: string;
  label: string;
  route: string;
  icon: IconName;
  children?: MenuItem[];
  /** Item is hidden unless the current user holds at least one of these permissions. */
  permissions?: string[];
  /** Item is hidden unless the current user's role is one of these. */
  roles?: string[];
  /** Extra words the topbar search should match (synonyms, Arabic terms…). */
  keywords?: string[];
}

export interface MenuSection {
  label: string;
  items: MenuItem[];
}
