-- Migration v9: Metodo de entrega por orden (envio vs recoleccion)
-- Ejecutar en Supabase SQL Editor.

-- Guardar metodo de entrega (shipping | pickup) en cada orden.
-- Permite que el panel admin muestre los estados correctos
-- (recoleccion: pagado -> procesado -> listo_para_recoleccion -> entregado)
-- y oculte la generacion de guia de envio para pedidos de recoleccion.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT;

-- Backfill de ordenes historicas: inferir pickup cuando no hubo envio cobrado ni paqueteria.
UPDATE orders
SET delivery_method = CASE
    WHEN shipping = 0 AND shipping_carrier IS NULL AND shipping_quotation_id IS NULL THEN 'pickup'
    ELSE 'shipping'
END
WHERE delivery_method IS NULL;

-- Permitir el estado 'listo_para_recoleccion' (para pedidos de recoleccion).
-- El CHECK original solo permitia pagado/procesado/enviado/entregado.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status = ANY (ARRAY['pagado'::text, 'procesado'::text, 'enviado'::text, 'listo_para_recoleccion'::text, 'entregado'::text]));
