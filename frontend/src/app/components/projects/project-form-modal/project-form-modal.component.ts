import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalShellComponent } from '../../ui/modal-shell/modal-shell.component';
import { WorkspaceMember } from '../../../services/workspace.service';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './project-form-modal.component.html',
})
export class ProjectFormModalComponent {
  open = input(false);
  form = input.required<FormGroup>();
  editing = input(false);
  saving = input(false);
  workspaceName = input('');
  members = input<WorkspaceMember[]>([]);
  selectedMemberIds = input<string[]>([]);

  submitForm = output<void>();
  cancelled = output<void>();
  toggleMember = output<string>();

  isSelected(id: string): boolean {
    return this.selectedMemberIds().includes(id);
  }

  initials(name: string): string {
    return (name || '?').substring(0, 2).toUpperCase();
  }
}
