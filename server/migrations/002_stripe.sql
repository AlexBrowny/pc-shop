-- Оплата картой через Stripe Checkout.
-- Заказ со способом stripe создаётся со статусом pending (ждёт оплаты, остатки зарезервированы),
-- после вебхука становится paid; если сессия истекла — отменяется, остатки возвращаются.

ALTER TABLE orders ALTER COLUMN receipt_file DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN receipt_mime DROP NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'receipt';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_currency text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount bigint;       -- в минимальных единицах валюты (центы)

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','new','paid','shipped','done','cancelled'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('receipt','stripe'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('manual','awaiting','paid','failed','expired'));

-- у заказа по чеку файл обязателен, у Stripe-заказа — нет
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_receipt_required_check;
ALTER TABLE orders ADD CONSTRAINT orders_receipt_required_check
  CHECK (payment_method = 'stripe' OR (receipt_file IS NOT NULL AND receipt_mime IS NOT NULL));

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders (stripe_session_id) WHERE stripe_session_id IS NOT NULL;
