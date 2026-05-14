// producto.js — pagina dedicada de un solo producto (/producto/<slug>)
// Lee el JSON del producto inyectado por el server, renderiza gallery + opciones,
// y maneja el carrito en localStorage compartido con /productos.

const product = (() => {
    try {
        return JSON.parse(document.getElementById('product-data').textContent);
    } catch (e) {
        console.error('No se pudo leer product-data', e);
        return null;
    }
})();

let cart = JSON.parse(localStorage.getItem('legado_cart')) || [];
let selectedVariant = null;
let selectedSize = null;

function getVariantSizeStock(p, variantName, size) {
    if (!p || !p.variants) return null;
    const v = p.variants.find(x => x.name === variantName);
    if (!v || !v.stock) return null;
    return v.stock[size] !== undefined ? v.stock[size] : null;
}

function renderGallery() {
    const main = document.getElementById('pdp-main-img');
    const thumbsContainer = document.getElementById('pdp-thumbs');

    const allImages = [];
    if (product.image) allImages.push(product.image);
    (product.images || []).forEach(img => {
        if (img && !allImages.includes(img)) allImages.push(img);
    });
    (product.variants || []).forEach(v => {
        if (v.image && !allImages.includes(v.image)) allImages.push(v.image);
    });

    if (allImages.length <= 1) {
        thumbsContainer.style.display = 'none';
        return;
    }

    thumbsContainer.innerHTML = allImages.map((img, i) => `
        <div class="pdp-thumb ${i === 0 ? 'active' : ''}" data-img="${img}">
            <img src="${img}" alt="${product.name}">
        </div>
    `).join('');

    thumbsContainer.querySelectorAll('.pdp-thumb').forEach(t => {
        t.addEventListener('click', () => {
            thumbsContainer.querySelectorAll('.pdp-thumb').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            main.src = t.dataset.img;
        });
    });
}

function renderVariants() {
    if (!product.variants || product.variants.length === 0) return;
    const group = document.getElementById('variant-group');
    const container = document.getElementById('variant-options');
    group.style.display = 'block';

    container.innerHTML = product.variants.map((v, i) => `
        <button class="variant-btn ${i === 0 ? 'active' : ''}" data-variant="${v.name}"
                style="background-color: ${v.color || '#fff'};" title="${v.name}"></button>
    `).join('');

    selectedVariant = product.variants[0].name;
    if (product.variants[0].image) {
        document.getElementById('pdp-main-img').src = product.variants[0].image;
    }

    container.querySelectorAll('.variant-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedVariant = btn.dataset.variant;
            const v = product.variants.find(x => x.name === selectedVariant);
            if (v && v.image) document.getElementById('pdp-main-img').src = v.image;
        });
    });
}

function renderSizes() {
    if (!product.sizes || product.sizes.length === 0) {
        selectedSize = 'Única';
        return;
    }
    const group = document.getElementById('size-group');
    const container = document.getElementById('size-buttons');
    group.style.display = 'block';

    container.innerHTML = product.sizes.map(s => `
        <button class="size-btn" data-size="${s}">${s}</button>
    `).join('');

    container.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSize = btn.dataset.size;
        });
    });
}

function setupQuantity() {
    const qty = document.getElementById('quantity');
    document.getElementById('qty-minus').addEventListener('click', () => {
        qty.value = Math.max(1, parseInt(qty.value) - 1);
    });
    document.getElementById('qty-plus').addEventListener('click', () => {
        qty.value = parseInt(qty.value || '1') + 1;
    });
}

function setupAddToCart() {
    document.getElementById('add-to-cart-btn').addEventListener('click', () => {
        // Validar talla si aplica
        let size;
        if (product.sizes && product.sizes.length > 0) {
            const active = document.querySelector('.size-btn.active');
            if (!active) {
                alert('Por favor selecciona una talla');
                return;
            }
            size = active.dataset.size;
        } else {
            size = 'Única';
        }

        // Variante (color)
        const variant = selectedVariant;
        let variantImage = null;
        if (product.variants && product.variants.length > 0 && variant) {
            const v = product.variants.find(x => x.name === variant);
            if (v && v.image) variantImage = v.image;
        }
        const cartImage = variantImage || product.image;

        const quantity = parseInt(document.getElementById('quantity').value) || 1;

        // Validar stock
        const available = getVariantSizeStock(product, variant, size);
        if (available !== null) {
            const existingQty = cart
                .filter(item => String(item.id) === String(product.id) && item.size === size && item.variant === variant)
                .reduce((sum, item) => sum + item.quantity, 0);
            if (existingQty + quantity > available) {
                alert(`Solo hay ${available} pieza(s) disponible(s) de ${variant} talla ${size}. Ya tienes ${existingQty} en el carrito.`);
                return;
            }
        }

        const idx = cart.findIndex(item =>
            String(item.id) === String(product.id) && item.size === size && item.variant === variant
        );
        if (idx > -1) {
            cart[idx].quantity += quantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                size: size,
                variant: variant,
                quantity: quantity,
                gradient: product.gradient,
                image: cartImage
            });
        }

        localStorage.setItem('legado_cart', JSON.stringify(cart));
        updateCartCount();

        if (typeof gtag !== 'undefined') {
            gtag('event', 'add_to_cart', {
                currency: 'MXN',
                value: product.price * quantity,
                items: [{
                    item_id: product.id,
                    item_name: product.name,
                    item_category: product.category,
                    item_variant: variant || 'N/A',
                    price: product.price,
                    quantity: quantity
                }]
            });
        }

        const btn = document.getElementById('add-to-cart-btn');
        const original = btn.textContent;
        btn.textContent = '✓ Agregado al Carrito';
        btn.style.background = '#4caf50';
        setTimeout(() => {
            btn.textContent = original;
            btn.style.background = '';
        }, 1500);
    });
}

function updateCartCount() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const el = document.getElementById('cart-count');
    if (el) el.textContent = count;
}

function setupCartIcon() {
    const toggle = document.getElementById('cart-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
        // El sidebar de carrito vive en /productos; vamos alla con #cart
        window.location.href = '/productos#cart';
    });
}

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        console.warn('clipboard API fallo, usando fallback', e);
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { console.warn('execCommand copy fallo', e); }
    document.body.removeChild(ta);
    return true;
}

function setupShareButton() {
    const btn = document.getElementById('pdp-share-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        await copyToClipboard(window.location.href);
        btn.classList.add('copied');
        const label = btn.querySelector('.share-label');
        if (label) label.textContent = 'Link copiado';
        setTimeout(() => {
            btn.classList.remove('copied');
            if (label) label.textContent = 'Copiar link';
        }, 1800);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const y = document.getElementById('footer-year');
    if (y) y.textContent = new Date().getFullYear();

    if (!product) return;
    renderGallery();
    renderVariants();
    renderSizes();
    setupQuantity();
    setupAddToCart();
    setupShareButton();
    setupCartIcon();
    updateCartCount();
});
