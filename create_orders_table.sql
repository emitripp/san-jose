-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id text PRIMARY KEY,
    "sessionId" text,
    customer jsonb,
    items jsonb,
    total numeric,
    shipping numeric,
    status text DEFAULT 'pendiente',
    "trackingNumber" text,
    "createdAt" timestamp with time zone DEFAULT now(),
    paid boolean DEFAULT false
);

-- Enable RLS (Optional, but recommended)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can do everything (Service Role bypasses this, but good to have)
-- Note: You might need to adjust policies based on your auth setup.
-- For now, if using Service Role for admin actions, it bypasses RLS.
