import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { matchesAll, tokenize } from '../../../../shared/utils/arabic-search.util';
import { flattenGroups, isMisplacedRoot, ItemGroupNode } from '../../models/item-group.model';
import { GroupItemsComponent } from '../group-items/group-items.component';

/**
 * Drill-down tree of item groups, all in one place: a click on a main group
 * opens its sub-groups, a click on a final sub-group opens its items right
 * under it. Rows show thumbnail / colour, code and the roll-up item count;
 * main groups that wrongly hold items are flagged with a fix action. A search
 * shows matching groups with their ancestors so each hit keeps its context.
 */
@Component({
  selector: 'app-group-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GroupItemsComponent, IconComponent, NgTemplateOutlet],
  templateUrl: './group-tree.component.html',
  styleUrl: './group-tree.component.scss',
})
export class GroupTreeComponent {
  readonly nodes = input.required<readonly ItemGroupNode[]>();
  readonly search = input('');

  readonly view = output<ItemGroupNode>();
  readonly edit = output<ItemGroupNode>();
  readonly addChild = output<ItemGroupNode>();
  readonly remove = output<ItemGroupNode>();
  /** A main group holding items asks to be moved under another main group. */
  readonly makeSub = output<ItemGroupNode>();

  protected readonly misplaced = isMisplacedRoot;

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  /** Ids to show while searching: hits + their ancestors (null = no search, show all). */
  private readonly visible = computed<ReadonlySet<string> | null>(() => {
    const tokens = tokenize(this.search());
    if (!tokens.length) return null;
    const ids = new Set<string>();
    const walk = (nodes: readonly ItemGroupNode[], ancestors: string[]): void => {
      for (const n of nodes) {
        if (matchesAll([n.name, n.code, n.description], tokens)) [...ancestors, n.id].forEach((id) => ids.add(id));
        walk(n.children ?? [], [...ancestors, n.id]);
      }
    };
    walk(this.nodes(), []);
    return ids;
  });

  protected readonly sorted = computed(() => sortTree(this.nodes()));
  protected readonly empty = computed(() => this.visible()?.size === 0);
  protected readonly searching = computed(() => this.visible() !== null);

  protected isShown(node: ItemGroupNode): boolean {
    return this.visible()?.has(node.id) ?? true;
  }

  /**
   * While searching, parents open by themselves so hits are visible; a final
   * sub-group's items load only when the user opens it (no request storm).
   */
  protected isOpen(node: ItemGroupNode): boolean {
    if (this.searching() && node.children?.length) return true;
    return this.expanded().has(node.id);
  }

  protected toggle(node: ItemGroupNode): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  expandAll(): void {
    this.expanded.set(new Set(flattenGroups(this.nodes()).filter((g) => !g.isLeaf).map((g) => g.node.id)));
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }
}

function sortTree(nodes: readonly ItemGroupNode[]): ItemGroupNode[] {
  return [...nodes]
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    .map((n) => ({ ...n, children: sortTree(n.children ?? []) }));
}
