import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalShellComponent } from '../../ui/modal-shell/modal-shell.component';
import { WorkspaceMember } from '../../../services/workspace.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, TranslatePipe],
  templateUrl: './task-form-modal.component.html',
})
export class TaskFormModalComponent {
  locale = inject(LocaleService);

  open = input(false);
  form = input.required<FormGroup>();
  saving = input(false);
  members = input<WorkspaceMember[]>([]);

  submitForm = output<void>();
  cancelled = output<void>();

  submitLabel = computed(() =>
    this.saving() ? this.locale.t('taskForm.creating') : this.locale.t('taskForm.create')
  );
}
