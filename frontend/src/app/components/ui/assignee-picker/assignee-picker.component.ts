import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkspaceMember } from '../../../services/workspace.service';
import { User } from '../../../models/types';

export type AssigneePickerMode = 'select' | 'dropdown';

@Component({
  selector: 'app-assignee-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignee-picker.component.html',
})
export class AssigneePickerComponent {
  members = input<WorkspaceMember[]>([]);
  value = input<string | null>(null);
  mode = input<AssigneePickerMode>('select');
  searchable = input(false);
  disabled = input(false);
  placeholder = input('Unassigned');
  label = input('Assignee');

  valueChange = output<string | null>();

  open = signal(false);
  search = signal('');

  filteredMembers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.members();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  });

  selectedMember = computed(() => {
    const id = this.value();
    if (!id) return null;
    return this.members().find((m) => m._id === id) || null;
  });

  toggle(): void {
    if (this.disabled()) return;
    this.open.update((v) => !v);
    if (!this.open()) this.search.set('');
  }

  pick(userId: string | null): void {
    this.open.set(false);
    this.search.set('');
    if (this.value() === userId) return;
    this.valueChange.emit(userId);
  }

  initials(name: string): string {
    return (name || '?').substring(0, 2).toUpperCase();
  }

  memberLabel(member: WorkspaceMember | User): string {
    return member.name;
  }
}
