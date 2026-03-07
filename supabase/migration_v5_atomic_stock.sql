-- Migration V5: Stock general atómico
-- Ejecutar en Supabase SQL Editor ANTES de desplegar el cambio en server.js

-- Función para decrementar stock general de un producto (atómica)
-- Patrón idéntico a decrement_variant_stock de migration_v3.sql
CREATE OR REPLACE FUNCTION decrement_product_stock(
    p_product_id UUID,
    p_quantity INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
BEGIN
    -- Bloquear la fila para evitar race conditions
    SELECT stock INTO v_current_stock
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    -- NULL significa ilimitado, no decrementar
    IF v_current_stock IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calcular nuevo stock (nunca menor a 0)
    v_new_stock := GREATEST(0, v_current_stock - p_quantity);

    -- Actualizar en la tabla
    UPDATE products SET stock = v_new_stock, updated_at = NOW()
    WHERE id = p_product_id;

    RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;
