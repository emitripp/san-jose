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
        throw new Error(`Skydropx API error (${res.status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
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
 * @param {Array} parcels - Array of {weight, length, width, height}
 * @returns {Object} {shipmentId, trackingNumber, trackingUrl, labelUrl}
 */
async function generateLabel(rateId, destination, parcels, quotationId = null) {
    const shipment = await apiRequest('POST', '/api/v1/shipments', {
        shipment: {
            rate_id: rateId,
            ...(quotationId && { quotation_id: quotationId }),
            printing_format: 'standard',
            consignment_note: '53102400',
            package_type: '4G',
            content_description: 'Mercancía - Legado San José',
            address_from: {
                name: ORIGIN.name,
                company: ORIGIN.company,
                street1: ORIGIN.street1,
                city: ORIGIN.city,
                province: ORIGIN.province,
                zip: ORIGIN.zip,
                country_code: 'MX',
                phone: ORIGIN.phone,
                email: ORIGIN.email,
                reference: 'Origen'
            },
            address_to: {
                name: destination.name,
                street1: destination.street1,
                street2: destination.street2 || '',
                city: destination.city,
                province: destination.province,
                zip: destination.zip,
                country_code: 'MX',
                phone: destination.phone,
                email: destination.email,
                reference: 'Destino'
            },
            parcels: parcels.map(p => ({
                weight: p.weight,
                length: p.length,
                width: p.width,
                height: p.height
            }))
        }
    });

    // Extract tracking info from JSON:API response
    const shipmentData = shipment.data || shipment;
    const included = shipment.included || [];
    const pkg = included.find(i => i.type === 'packages') || {};
    const pkgAttrs = pkg.attributes || {};

    return {
        shipmentId: shipmentData.id || shipmentData.attributes?.id,
        trackingNumber: pkgAttrs.tracking_number || shipmentData.attributes?.tracking_number,
        trackingUrl: pkgAttrs.tracking_url_provider || shipmentData.attributes?.tracking_url_provider,
        labelUrl: pkgAttrs.label_url || shipmentData.attributes?.label_url
    };
}

/**
 * Track a shipment by tracking number and carrier
 */
async function trackShipment(trackingNumber, carrierCode) {
    return await apiRequest('GET', `/api/v1/shipments/tracking/${trackingNumber}/${carrierCode}`);
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

module.exports = { getRates, generateLabel, trackShipment, cancelShipment, selectBox, isConfigured, ORIGIN };
