-- Additive ledger links use the existing extra_data column; expense rows are untouched.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_expense_source_unique
 ON public.ledger ((extra_data->>'expenseId')) WHERE extra_data->>'expenseId' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_expense_voucher_unique
 ON public.ledger (reference_no) WHERE reference_type = 'EXPENSE';
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check
 CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Void', 'Cancelled'));
