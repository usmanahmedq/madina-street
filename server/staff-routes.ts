import type { Express, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { db } from './db';
import type { Staff } from '../src/types';

class StaffValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const identity = (value: string) => value.replace(/[\s-]/g, '').toLowerCase();

export function registerStaffRoutes(app: Express, store: Pick<typeof db, 'get' | 'save'>) {
  app.get('/api/staff', (_req, res) => res.json({ success: true, staff: store.get('staff') }));
  for (const method of ['post', 'put'] as const) {
    app[method](method === 'post' ? '/api/staff' : '/api/staff/:id', (req: Request, res: Response, next: NextFunction) => {
      try {
        const records = store.get('staff');
        const existing = method === 'put' ? records.find(s => s.id === req.params.id) : undefined;
        if (method === 'put' && !existing) throw new StaffValidationError('Staff member not found.', 404);
        const body = { ...existing, ...req.body };
        const values = {
          empNo: text(body.empNo), name: text(body.name), fatherName: text(body.fatherName),
          cnic: text(body.cnic), phone: text(body.phone), emergencyContact: text(body.emergencyContact),
          address: text(body.address), role: text(body.role), joiningDate: text(body.joiningDate),
          monthlySalary: Number(body.monthlySalary), status: body.status ?? 'Active',
          notes: text(body.notes), photoUrl: text(body.photoUrl),
        };
        for (const [field, label] of [['name','Name'],['role','Designation'],['cnic','CNIC'],['phone','Phone'],['joiningDate','Joining date']] as const) {
          if (!values[field]) throw new StaffValidationError(`${label} is required.`);
        }
        if (!(store.get('designations') || []).some(d => d.title === values.role)) throw new StaffValidationError('Select an existing designation. Refresh the designation list and retry.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(values.joiningDate) || !Number.isFinite(Date.parse(values.joiningDate)) || new Date(values.joiningDate).toISOString().slice(0,10) !== values.joiningDate) throw new StaffValidationError('Joining date must be a valid calendar date.');
        if (!['Active','Inactive','On Leave','Resigned'].includes(values.status)) throw new StaffValidationError('Select a valid staff status.');
        if (body.monthlySalary === null || body.monthlySalary === '' || !['number','string'].includes(typeof body.monthlySalary) || !Number.isFinite(values.monthlySalary) || values.monthlySalary < 1 || values.monthlySalary > 999999999999.99 || Math.abs(values.monthlySalary * 100 - Math.round(values.monthlySalary * 100)) > 0.001) throw new StaffValidationError('Monthly salary must be a positive amount with at most two decimal places.');
        const duplicate = records.find(s => s.id !== existing?.id && (identity(s.cnic) === identity(values.cnic) || (values.empNo && s.empNo.toLowerCase() === values.empNo.toLowerCase())));
        if (duplicate) {
          // Same submitted values are a safe retry; never overwrite a conflicting record.
          const matches = Object.entries(values).every(([key, value]) => key === 'empNo' && !value || (key === 'cnic' ? identity(duplicate.cnic) === identity(values.cnic) : (duplicate[key as keyof Staff] ?? '') === value));
          if (method === 'post' && matches) return res.json({ success: true, staff: duplicate });
          throw new StaffValidationError('A staff member with this employee ID or CNIC already exists.', 409);
        }
        const staff: Staff = existing
          ? { ...existing, ...values, empNo: existing.empNo, updatedAt: new Date().toISOString() }
          : { ...values, empNo: values.empNo || `EMP-${randomUUID().toUpperCase()}`, id: `staff-${randomUUID()}`, createdAt: new Date().toISOString() };
        if (existing) Object.assign(existing, staff); else records.push(staff);
        store.save();
        return res.json({ success: true, staff });
      } catch (error) {
        if (error instanceof StaffValidationError) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
      }
    });
  }
}
