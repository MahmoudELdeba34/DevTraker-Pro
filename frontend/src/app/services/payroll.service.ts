import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, PayrollRun, Payslip, SalaryAdjustment } from '../models/types';

@Injectable({ providedIn: 'root' })
export class PayrollService {
  private readonly apiUrl = `${environment.apiUrl}/payroll`;

  constructor(private http: HttpClient) {}

  runPayroll(month: string): Observable<ApiResponse<{ run: PayrollRun; payslips: Payslip[] }>> {
    return this.http.post<ApiResponse<{ run: PayrollRun; payslips: Payslip[] }>>(`${this.apiUrl}/run/${month}`, {});
  }

  getRuns(): Observable<ApiResponse<PayrollRun[]>> {
    return this.http.get<ApiResponse<PayrollRun[]>>(`${this.apiUrl}/runs`);
  }

  getPayslips(runId: string): Observable<ApiResponse<Payslip[]>> {
    return this.http.get<ApiResponse<Payslip[]>>(`${this.apiUrl}/runs/${runId}/payslips`);
  }

  updateStatus(runId: string, status: string): Observable<ApiResponse<PayrollRun>> {
    return this.http.put<ApiResponse<PayrollRun>>(`${this.apiUrl}/runs/${runId}/status`, { status });
  }

  getMyPayslips(): Observable<ApiResponse<Payslip[]>> {
    return this.http.get<ApiResponse<Payslip[]>>(`${this.apiUrl}/my-payslips`);
  }

  addAdjustment(data: {
    userId: string;
    type: 'deduction' | 'bonus';
    subType: 'bonus' | 'allowance' | 'commission' | 'penalty' | 'manual';
    amount: number;
    payrollMonth: string;
    reason: string;
  }): Observable<ApiResponse<SalaryAdjustment>> {
    return this.http.post<ApiResponse<SalaryAdjustment>>(`${this.apiUrl}/adjustments`, data);
  }

  getAdjustments(month: string): Observable<ApiResponse<SalaryAdjustment[]>> {
    let params = new HttpParams().set('month', month);
    return this.http.get<ApiResponse<SalaryAdjustment[]>>(`${this.apiUrl}/adjustments`, { params });
  }
}
