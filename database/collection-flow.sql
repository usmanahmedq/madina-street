CREATE TABLE IF NOT EXISTS public.monthly_dues (
 id text PRIMARY KEY,
 house_id text NOT NULL REFERENCES public.houses(id),
 month text NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 amount numeric(14,2) NOT NULL CHECK (amount >= 0),
 paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= amount),
 status text NOT NULL CHECK (status IN ('Pending','Partial','Paid')),
 created_at timestamptz NOT NULL,
 sort_order integer NOT NULL DEFAULT 0,
 extra_data jsonb NOT NULL DEFAULT '{}',
 UNIQUE(house_id, month)
);
ALTER TABLE public.ledger ADD COLUMN IF NOT EXISTS extra_data jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS ledger_collection_source_unique ON public.ledger ((extra_data->>'collectionId')) WHERE extra_data->>'collectionId' IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_reversal_unique ON public.ledger ((extra_data->>'reversalOf')) WHERE extra_data->>'reversalOf' IS NOT NULL;
