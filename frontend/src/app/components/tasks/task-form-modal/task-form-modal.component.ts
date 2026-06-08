import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalShellComponent } from '../../ui/modal-shell/modal-shell.component';
import { WorkspaceMember } from '../../../services/workspace.service';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './task-form-modal.component.html',
})
export class TaskFormModalComponent {
  open = input(false);
  form = input.required<FormGroup>();
  saving = input(false);
  members = input<WorkspaceMember[]>([]);

  submitForm = output<void>();
  cancelled = output<void>();
}
