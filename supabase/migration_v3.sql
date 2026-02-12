-- Migration V3: Inventario por variante/talla
-- Ejecutar en Supabase SQL Editor

-- Función para decrementar stock de una variante+talla específica (atómica)
CREATE OR REPLACE FUNCTION decrement_variant_stock(
    p_product_id UUID,
    p_variant_name TEXT,
    p_size TEXT,
    p_quantity INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_variants JSONB;
    v_variant_index INTEGER;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
BEGIN
    -- Bloquear la fila para evitar race conditions
    SELECT variants INTO v_variants
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    IF v_variants IS NULL THEN
        RAISE EXCEPTION 'Product not found or has no variants: %', p_product_id;
    END IF;

    -- Buscar el índice del variant por nombre
    FOR i IN 0..jsonb_array_length(v_variants)-1 LOOP
        IF v_variants->i->>'name' = p_variant_name THEN
            v_variant_index := i;
            EXIT;
        END IF;
    END LOOP;

    IF v_variant_index IS NULL THEN
        RAISE EXCEPTION 'Variant not found: %', p_variant_name;
    END IF;

    -- Obtener stock actual para la talla
    v_current_stock := (v_variants->v_variant_index->'stock'->>p_size)::INTEGER;

    -- NULL significa ilimitado, no decrementar
    IF v_current_stock IS NULL THEN
        RETURN v_variants;
    END IF;

    -- Calcular nuevo stock (nunca menor a 0)
    v_new_stock := GREATEST(0, v_current_stock - p_quantity);

    -- Actualizar el JSONB
    v_variants := jsonb_set(
        v_variants,
        ARRAY[v_variant_index::TEXT, 'stock', p_size],
        to_jsonb(v_new_stock)
    );

    -- Guardar en la tabla
    UPDATE products SET variants = v_variants, updated_at = NOW()
    WHERE id = p_product_id;

    RETURN v_variants;
END;
$$ LANGUAGE plpgsql;
