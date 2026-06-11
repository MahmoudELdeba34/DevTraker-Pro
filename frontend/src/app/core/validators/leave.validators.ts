import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function dateRangeValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get('startDate')?.value;
    const end = group.get('endDate')?.value;
    if (!start || !end) return null;

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return { invalidDate: true };
    }
    if (endDate < startDate) return { dateRange: true };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) return { pastDate: true };

    return null;
  };
}
