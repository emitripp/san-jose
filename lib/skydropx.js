// Skydropx API Client - Shipping integration for Legado San José
const SKYDROPX_BASE_URL = process.env.SKYDROPX_ENV === 'production'
    ? 'https://pro.skydropx.com'
    : 'https://sb-pro.skydropx.com';

// OAuth 2.0 token cache
let tokenCache = { token: null, expiresAt: 0 };

/**
 * Get OAuth 2.0 access token (cached, auto-refreshes 5min before expiry)
 */
async function getToken() {
    const now = Date.now();
    if (tokenCache.token && tokenCache.expiresAt > now + 300000) {
        return tokenCache.token;
    }

    const clientId = process.env.SKYDROPX_CLIENT_ID;
    const clientSecret = process.env.SKYDROPX_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('SKYDROPX_CLIENT_ID and SKYDROPX_CLIENT_SECRET required');

    const res = await fetch(`${SKYDROPX_BASE_URL}/api/v1/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
        })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Skydropx auth failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    tokenCache = {
        token: data.access_token,
        expiresAt: now + (data.expires_in * 1000)
    };
    return data.access_token;
}

/**
 * Make authenticated request to Skydropx API
 */
async function apiRequest(method, path, body = null) {
    const token = await getToken();
    const opts = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${SKYDROPX_BASE_URL}${path}`, opts);
    const text = await res.text();

    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
        const error = new Error(`Skydropx API error (${res.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
        error.status = res.status;
        error.data = data;
        throw error;
    }
    return data;
}

// --- Box Selection Algorithm ---

const BOXES = [
    { name: 'Plana', length: 24, width: 29, height: 5, boxWeight: 0.105, maxPlayeras: 5, maxGorras: 0, maxMochilas: 0, maxMaletas: 0 },
    { name: 'Pequeña', length: 20, width: 20, height: 13, boxWeight: 0.160, maxPlayeras: 6, maxGorras: 4, maxMochilas: 0, maxMaletas: 0 },
    { name: 'Mediana', length: 32, width: 24, height: 11, boxWeight: 0.200, maxPlayeras: 12, maxGorras: 10, maxMochilas: 0, maxMaletas: 0 },
    { name: 'DHL 4', length: 33, width: 32, height: 18, boxWeight: 0.500, maxPlayeras: 0, maxGorras: 0, maxMochilas: 1, maxMaletas: 0 },
    { name: 'DHL 7', length: 48, width: 40, height: 38, boxWeight: 0.800, maxPlayeras: 0, maxGorras: 0, maxMochilas: 0, maxMaletas: 1 }
];

const ITEM_WEIGHTS = { playera: 0.25, gorra: 0.15, mochila: 1.5, maleta: 4.0 };

function classifyItem(item) {
    const name = (item.name || '').toLowerCase();
    if (name.includes('maleta')) return 'maleta';
    if (name.includes('mochila')) return 'mochila';
    if (name.includes('gorra') || name.includes('cachucha')) return 'gorra';
    return 'playera';
}

/**
 * Select optimal boxes for cart items
 * Returns array of packages with dimensions and weight
 */
function selectBox(items) {
    const counts = { playera: 0, gorra: 0, mochila: 0, maleta: 0 };
    items.forEach(item => {
        const type = classifyItem(item);
        counts[type] += (item.quantity || 1);
    });

    const packages = [];

    // Maletas: one DHL 7 box each
    for (let i = 0; i < counts.maleta; i++) {
        const box = BOXES[4]; // DHL 7
        packages.push({
            weight: Math.ceil(box.boxWeight + ITEM_WEIGHTS.maleta),
            length: box.length, width: box.width, height: box.height
        });
    }

    // Mochilas: one DHL 4 box each
    for (let i = 0; i < counts.mochila; i++) {
        const box = BOXES[3]; // DHL 4
        packages.push({
            weight: Math.ceil((box.boxWeight + ITEM_WEIGHTS.mochila) * 10) / 10,
            length: box.length, width: box.width, height: box.height
        });
    }

    // Playeras + Gorras
    let playeras = counts.playera;
    let gorras = counts.gorra;

    while (playeras > 0 || gorras > 0) {
        let box;
        let pInBox = 0, gInBox = 0;

        if (gorras === 0 && playeras >= 3 && playeras <= 5) {
            box = BOXES[0]; // Plana
            pInBox = playeras;
            playeras = 0;
        } else if (playeras <= 6 && gorras <= 4) {
            box = BOXES[1]; // Pequeña
            pInBox = playeras;
            gInBox = gorras;
            playeras = 0;
            gorras = 0;
        } else if (playeras <= 12 && gorras <= 10) {
            box = BOXES[2]; // Mediana
            pInBox = Math.min(playeras, 12);
            gInBox = Math.min(gorras, 10);
            playeras -= pInBox;
            gorras -= gInBox;
        } else {
            box = BOXES[2]; // Mediana, pack what fits
            pInBox = Math.min(playeras, 12);
            gInBox = Math.min(gorras, 10);
            playeras -= pInBox;
            gorras -= gInBox;
        }

        const contentWeight = (pInBox * ITEM_WEIGHTS.playera) + (gInBox * ITEM_WEIGHTS.gorra);
        packages.push({
            weight: Math.ceil((box.boxWeight + contentWeight) * 10) / 10,
            length: box.length, width: box.width, height: box.height
        });
    }

    // Fallback: at least one small package
    if (packages.length === 0) {
        packages.push({ weight: 1, length: 20, width: 20, height: 13 });
    }

    return packages;
}

// --- Origin address from env ---
const ORIGIN = {
    name: process.env.SKYDROPX_ORIGIN_NAME || 'Legado San José',
    company: process.env.SKYDROPX_ORIGIN_COMPANY || 'Legado San José',
    email: process.env.SKYDROPX_ORIGIN_EMAIL || 'legadosanjosemx@gmail.com',
    phone: process.env.SKYDROPX_ORIGIN_PHONE || '',
    street1: process.env.SKYDROPX_ORIGIN_STREET || '',
    city: process.env.SKYDROPX_ORIGIN_CITY || '',
    province: process.env.SKYDROPX_ORIGIN_STATE || '',
    zip: process.env.SKYDROPX_ORIGIN_POSTAL_CODE || '',
    area_level1: process.env.SKYDROPX_ORIGIN_STATE_FULL || process.env.SKYDROPX_ORIGIN_STATE || '',
    area_level2: process.env.SKYDROPX_ORIGIN_CITY || '',
    area_level3: process.env.SKYDROPX_ORIGIN_DISTRICT || '',
    postal_code: process.env.SKYDROPX_ORIGIN_POSTAL_CODE || '',
    country_code: 'MX'
};

const ORIGIN_QUOTATION = {
    country_code: 'MX',
    postal_code: process.env.SKYDROPX_ORIGIN_POSTAL_CODE || '42083',
    area_level1: process.env.SKYDROPX_ORIGIN_STATE_FULL || 'Hidalgo',
    area_level2: process.env.SKYDROPX_ORIGIN_CITY || 'Pachuca de Soto',
    area_level3: process.env.SKYDROPX_ORIGIN_DISTRICT || 'San Antonio'
};

/**
 * Get shipping rates for a destination
 * @param {string} postalCode - Destination postal code (5 digits)
 * @param {Object} destination - {area_level1: state, area_level2: city, area_level3: neighborhood}
 * @param {Array} packages - Array of {weight, length, width, height}
 * @returns {Object} {quotationId, rates} sorted by price
 */
async function getRates(postalCode, destination, packages) {
    // For multi-package orders, quote largest package and multiply
    if (packages.length > 1) {
        return getMultiPackageRates(postalCode, destination, packages);
    }

    const pkg = packages[0];

    // Create quotation with correct wrapper format
    const quotation = await apiRequest('POST', '/api/v1/quotations', {
        quotation: {
            address_from: ORIGIN_QUOTATION,
            address_to: {
                country_code: 'MX',
                postal_code: postalCode,
                ...destination
            },
            parcel: {
                weight: pkg.weight,
                length: pkg.length,
                width: pkg.width,
                height: pkg.height
            }
        }
    });

    const quotationId = quotation.id;
    if (!quotationId) throw new Error('No quotation ID returned');

    // Poll until completed (max 30 seconds)
    return await pollQuotation(quotationId);
}

/**
 * Handle multi-package orders by quoting largest package
 * (carriers typically price by the heaviest/largest piece)
 */
async function getMultiPackageRates(postalCode, destArea, packages) {
    // Quote the largest package (by volumetric weight) to get base rates
    const largest = packages.reduce((max, p) => {
        const vol = p.length * p.width * p.height;
        const maxVol = max.length * max.width * max.height;
        return vol > maxVol ? p : max;
    }, packages[0]);

    const quotation = await apiRequest('POST', '/api/v1/quotations', {
        quotation: {
            address_from: ORIGIN_QUOTATION,
            address_to: {
                country_code: 'MX',
                postal_code: postalCode,
                ...destArea
            },
            parcel: {
                weight: largest.weight,
                length: largest.length,
                width: largest.width,
                height: largest.height
            }
        }
    });

    const quotationId = quotation.id;
    if (!quotationId) throw new Error('No quotation ID returned');

    const result = await pollQuotation(quotationId);
    // Multiply rates by number of packages (rough estimate for multi-box)
    result.rates = result.rates.map(r => ({
        ...r,
        price: Math.round(r.price * packages.length * 100) / 100,
        multiPackage: true,
        packageCount: packages.length
    }));
    return result;
}

/**
 * Poll a quotation until completed
 */
async function pollQuotation(quotationId) {
    const maxWait = 30000;
    const pollInterval = 2500;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        await new Promise(r => setTimeout(r, pollInterval));

        const result = await apiRequest('GET', `/api/v1/quotations/${quotationId}`);

        if (result.is_completed) {
            const rates = (result.rates || [])
                .filter(r => r.success && ['approved', 'price_found_external', 'price_found_internal'].includes(r.status)
                    && r.pickup === true && (r.pickup_package_min || 1) <= 1)
                .map(r => ({
                    id: r.id,
                    carrier: r.provider_display_name || r.provider_name,
                    service: r.provider_service_name || 'Estándar',
                    serviceCode: r.provider_service_code,
                    price: parseFloat(r.total),
                    currency: r.currency_code || 'MXN',
                    days: r.days || null,
                    insurable: r.insurable || false
                }))
                .sort((a, b) => a.price - b.price);

            // Deduplicate: same carrier + same price + same days → keep first
            const seen = new Set();
            const dedupedRates = rates.filter(r => {
                const key = `${r.carrier}|${r.service}|${r.price}|${r.days}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return { quotationId, rates: dedupedRates };
        }
    }

    throw new Error('Quotation timed out after 30 seconds');
}

/**
 * Generate shipping label from a quotation rate
 * @param {string} rateId - Rate ID from quotation
 * @param {Object} destination - {name, street1, street2, city, province, zip, phone, email}
 * @param {Array} parcels - Array of {weight, length, width, height} (solo se usa la cantidad; las dimensiones las toma la API de la cotización via rate_id)
 * @param {number} declaredValue - Valor declarado total en MXN (se reparte entre paquetes)
 * @returns {Object} {shipmentId, trackingNumber, trackingUrl, labelUrl}
 */
async function generateLabel(rateId, destination, parcels, declaredValue = 0, quotationId = null, onCreated = null) {
    const packageCount = Math.max(parcels?.length || 1, 1);
    // declared_value es requerido por la API aunque no se contrate seguro; mínimo 1 MXN por paquete
    const valuePerPackage = Math.max(Math.round((declaredValue / packageCount) * 100) / 100, 1);

    const shipmentPayload = {
        shipment: {
            rate_id: rateId,
            // Skydropx reutiliza la respuesta del rate en reintentos y evita duplicados.
            unique_shipment: true,
            ...(quotationId ? { quotation_id: quotationId } : {}),
            printing_format: 'standard',
            address_from: {
                name: ORIGIN.name,
                company: ORIGIN.company,
                street1: ORIGIN.street1,
                postal_code: ORIGIN.postal_code || ORIGIN.zip,
                area_level1: ORIGIN.area_level1 || ORIGIN.province,
                area_level2: ORIGIN.area_level2 || ORIGIN.city,
                area_level3: ORIGIN.area_level3,
                country_code: ORIGIN.country_code,
                phone: ORIGIN.phone,
                email: ORIGIN.email,
                reference: 'Origen'
            },
            address_to: {
                name: destination.name,
                company: destination.company || destination.name,
                street1: destination.street1,
                street2: destination.street2 || '',
                postal_code: destination.postal_code || destination.zip,
                area_level1: destination.area_level1 || destination.province,
                area_level2: destination.area_level2 || destination.city,
                area_level3: destination.area_level3 || '',
                country_code: destination.country_code || 'MX',
                phone: destination.phone,
                email: destination.email,
                reference: destination.reference || destination.street2 || 'Destino'
            },
            packages: Array.from({ length: packageCount }, (_, i) => ({
                package_number: String(i + 1),
                package_protected: false,
                declared_value: valuePerPackage,
                consignment_note: '53102400',
                package_type: '4G'
            }))
        }
    };

    let created;
    try {
        created = await apiRequest('POST', '/api/v1/shipments', shipmentPayload);
    } catch (error) {
        // Con unique_shipment, Skydropx puede responder 409 mientras el primer
        // intento sigue procesándose. Si devuelve el ID, retomamos ese envío.
        if (error.status === 409) {
            const existingShipmentId = extractShipmentId(error.data);
            if (existingShipmentId) {
                if (onCreated) await onCreated(existingShipmentId);
                return await pollShipment(existingShipmentId);
            }
        }
        throw error;
    }

    const shipmentId = created.data?.id || created.id;
    if (!shipmentId) throw new Error('Skydropx no devolvió ID de envío');

    // Persistimos el ID antes de esperar la respuesta asíncrona de Skydropx.
    if (onCreated) await onCreated(shipmentId);

    // La creación es asíncrona (202): pollear el shipment hasta que la guía esté lista
    return await pollShipment(shipmentId);
}

/**
 * Extrae un ID de envío de las respuestas de conflicto/idempotencia.
 */
function extractShipmentId(value) {
    if (typeof value === 'string') {
        const match = value.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
        return match ? match[0] : null;
    }
    if (!value || typeof value !== 'object') return null;

    for (const key of ['shipment_id', 'original_shipment_id']) {
        if (typeof value[key] === 'string' && value[key]) return value[key];
    }

    if (value.data && typeof value.data === 'object') {
        const nestedId = extractShipmentId(value.data);
        if (nestedId) return nestedId;
        if (typeof value.data.id === 'string' && value.data.id) return value.data.id;
    }

    if (value.attributes && typeof value.attributes === 'object') {
        const nestedId = extractShipmentId(value.attributes);
        if (nestedId) return nestedId;
    }

    for (const key of ['errors', 'error', 'meta', 'details']) {
        if (value[key] && typeof value[key] === 'object') {
            const nestedId = extractShipmentId(value[key]);
            if (nestedId) return nestedId;
        }
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const nestedId = extractShipmentId(item);
            if (nestedId) return nestedId;
        }
    }

    return null;
}

/**
 * Poll a shipment until its label is generated (or fails)
 */
async function pollShipment(shipmentId, { maxWait = 60000, pollInterval = 2500 } = {}) {
    const startTime = Date.now();
    let lastStatus = 'pending';

    while (Date.now() - startTime < maxWait) {
        const result = await apiRequest('GET', `/api/v1/shipments/${shipmentId}`);
        const attrs = result.data?.attributes || {};
        const included = (result.included || []).flatMap(item =>
            Array.isArray(item?.oneOf) ? item.oneOf : [item]
        );
        const isPackage = item => item && ['package', 'packages'].includes(item.type);
        const pkg = included.find(i => isPackage(i) && i.attributes?.label_url)
            || included.find(isPackage);
        const pkgAttrs = pkg?.attributes || {};
        lastStatus = String(attrs.workflow_status || lastStatus).toLowerCase();

        if (pkgAttrs.label_url || pkgAttrs.tracking_number) {
            return {
                shipmentId,
                trackingNumber: pkgAttrs.tracking_number || attrs.master_tracking_number,
                trackingUrl: pkgAttrs.tracking_url_provider,
                labelUrl: pkgAttrs.label_url
            };
        }

        if (['error', 'failed', 'cancelled', 'canceled', 'creation_failed'].includes(lastStatus)) {
            const detail = attrs.error_detail ? JSON.stringify(attrs.error_detail) : lastStatus;
            throw new Error(`Skydropx no pudo generar la guía: ${detail}`);
        }

        await new Promise(r => setTimeout(r, pollInterval));
    }

    const pendingError = new Error(`La guía sigue en proceso en Skydropx (estado: ${lastStatus}). El envío ${shipmentId} ya fue creado; puedes revisar de nuevo en unos minutos.`);
    pendingError.code = 'SHIPMENT_PENDING';
    pendingError.shipmentId = shipmentId;
    pendingError.status = lastStatus;
    throw pendingError;
}

/**
 * Track a shipment by tracking number and carrier
 */
async function trackShipment(trackingNumber, carrierCode) {
    return await apiRequest('GET', `/api/v1/shipments/tracking/${trackingNumber}/${carrierCode}`);
}

/**
 * Busca un envío por el número de rastreo que muestra Skydropx.
 * La API no ofrece un filtro directo por tracking, así que recorremos sus
 * páginas y comparamos el rastreo principal y los rastreos de los paquetes.
 * @returns {Object|null} {shipmentId, trackingNumber, carrierName} o null
 */
async function findShipmentByTracking(trackingNumber, carrierName = null) {
    const normalizedTracking = String(trackingNumber || '')
        .replace(/^#/, '')
        .replace(/[\s-]/g, '')
        .toUpperCase();

    if (!/^[A-Z0-9]{6,64}$/.test(normalizedTracking)) {
        throw new Error('Número de rastreo inválido');
    }

    const normalizedCarrier = String(carrierName || '')
        .replace(/[^a-z0-9]/gi, '')
        .toUpperCase();
    let page = 1;
    let totalPages = 1;

    while (page <= Math.min(totalPages, 100)) {
        const result = await apiRequest('GET', `/api/v1/shipments?page=${page}`);
        const shipments = Array.isArray(result.data) ? result.data : [];
        totalPages = Number(result.meta?.total_pages) || page;
        const included = (result.included || []).flatMap(item =>
            Array.isArray(item?.oneOf) ? item.oneOf : [item]
        );

        for (const shipment of shipments) {
            const shipmentId = shipment.id || shipment.attributes?.id;
            if (!shipmentId) continue;

            const shipmentAttributes = shipment.attributes || {};
            const packageIds = new Set(
                (shipment.relationships?.packages?.data || [])
                    .map(pkg => pkg?.id)
                    .filter(Boolean)
            );
            const packages = included.filter(item => {
                if (!['package', 'packages'].includes(item?.type)) return false;
                const belongsToShipment = item.relationships?.shipment?.data?.id === shipmentId;
                return belongsToShipment || packageIds.has(item.id);
            });
            const packageTracking = packages
                .map(pkg => pkg.attributes?.tracking_number)
                .filter(Boolean);
            const trackingCandidates = [shipmentAttributes.master_tracking_number, ...packageTracking]
                .filter(Boolean)
                .map(value => String(value).replace(/[\s-]/g, '').toUpperCase());

            if (!trackingCandidates.includes(normalizedTracking)) continue;

            const shipmentCarrier = String(shipmentAttributes.carrier_name || '')
                .replace(/[^a-z0-9]/gi, '')
                .toUpperCase();
            if (normalizedCarrier && shipmentCarrier && shipmentCarrier !== normalizedCarrier) continue;

            return {
                shipmentId,
                trackingNumber: shipmentAttributes.master_tracking_number || trackingNumber,
                carrierName: shipmentAttributes.carrier_name || carrierName || null
            };
        }

        page += 1;
    }

    return null;
}

/**
 * Cancel a shipment
 */
async function cancelShipment(shipmentId) {
    return await apiRequest('POST', `/api/v1/shipments/${shipmentId}/cancellations`, {
        cancellation_reason: 'Cancelado por admin'
    });
}

/**
 * Check if Skydropx is configured
 */
function isConfigured() {
    return !!(process.env.SKYDROPX_CLIENT_ID && process.env.SKYDROPX_CLIENT_SECRET);
}

module.exports = { getRates, generateLabel, waitForLabel: pollShipment, trackShipment, findShipmentByTracking, cancelShipment, selectBox, isConfigured, ORIGIN };
