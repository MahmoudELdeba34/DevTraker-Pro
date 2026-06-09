import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalShellComponent } from '../../ui/modal-shell/modal-shell.component';
import { WorkspaceMember } from '../../../services/workspace.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, TranslatePipe],
  templateUrl: './project-form-modal.component.html',
})
export class ProjectFormModalComponent {
  locale = inject(LocaleService);

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

  modalTitle = computed(() =>
    this.editing() ? this.locale.t('projectForm.edit') : this.locale.t('projectForm.new')
  );

  modalSubtitle = computed(() => {
    const name = this.workspaceName();
    return name ? this.locale.t('projectForm.inWorkspace', { name }) : '';
  });

  submitLabel = computed(() => {
    if (this.saving()) return this.locale.t('projectForm.saving');
    return this.editing() ? this.locale.t('projectForm.saveChanges') : this.locale.t('projectForm.create');
  });

  isSelected(id: string): boolean {
    return this.selectedMemberIds().includes(id);
  }

  initials(name: string): string {
    return (name || '?').substring(0, 2).toUpperCase();
  }
}
