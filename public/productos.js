// Lazy-load Stripe.js only when needed (at checkout)
let stripePromise = null;
function loadStripe() {
    if (!stripePromise) {
        stripePromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    return stripePromise;
}

// Product Data - Loaded from API (no fallback to avoid showing inactive products)

// ============================================
// STOCK HELPERS (variant-aware)
// ============================================

function isProductOutOfStock(product) {
    const hasVariantStock = product.variants && product.variants.some(v => v.stock);
    if (hasVariantStock) {
        return product.variants.every(v => {
            if (!v.stock) return false;
            return Object.values(v.stock).every(qty => qty === 0);
        });
    }
    return product.stock === 0;
}

function getProductTotalStock(product) {
    const hasVariantStock = product.variants && product.variants.some(v => v.stock);
    if (hasVariantStock) {
        let total = 0;
        product.variants.forEach(v => {
            if (v.stock) {
                Object.values(v.stock).forEach(qty => {
                    if (qty !== null && qty !== undefined) total += qty;
                });
            }
        });
        return total;
    }
    return product.stock;
}

function getVariantSizeStock(product, variantName, size) {
    if (!product.variants) return null;
    const variant = product.variants.find(v => v.name === variantName);
    if (!variant || !variant.stock) return null; // null = unlimited
    const sizeStock = variant.stock[size];
    return sizeStock !== undefined ? sizeStock : null;
}

// Returns max units the user can still add for this (product, variant, size) combo.
// null = unlimited. 0 = sin stock disponible (ya agotado o todo lo disponible esta en el carrito).
function getRemainingStockForCombo(product, variantName, size) {
    if (!product) return null;

    const hasVariantStock = product.variants && product.variants.some(v => v.stock);
    let absoluteStock = null;

    if (hasVariantStock && variantName) {
        absoluteStock = getVariantSizeStock(product, variantName, size);
    } else if (product.stock !== null && product.stock !== undefined) {
        absoluteStock = product.stock;
    }

    if (absoluteStock === null || absoluteStock === undefined) return null;

    // Restar lo que ya esta en el carrito para esta combinacion
    let inCart = 0;
    if (hasVariantStock && variantName) {
        inCart = cart
            .filter(item => String(item.id) === String(product.id) && item.size === size && item.variant === variantName)
            .reduce((sum, item) => sum + item.quantity, 0);
    } else {
        // Producto sin variantes: contar todas las unidades en carrito de este producto
        inCart = cart
            .filter(item => String(item.id) === String(product.id))
            .reduce((sum, item) => sum + item.quantity, 0);
    }

    return Math.max(0, absoluteStock - inCart);
}

// Toast ligero para feedback de stock en el carrito
function showCartToast(message, type = '') {
    let toast = document.getElementById('cart-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cart-toast';
        toast.className = 'cart-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'cart-toast' + (type ? ' ' + type : '');
    // Reflow para reiniciar animacion
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}

// Cart & History Management
function openCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    // Ensure we don't push state if already open
    if (!sidebar.classList.contains('open')) {
        sidebar.classList.add('open');
        if (overlay) overlay.classList.add('open');
        document.body.classList.add('no-scroll');
        // Push state so back button closes cart
        history.pushState({ modal: 'cart' }, '', '#cart');
    }
}

function closeCart() {
    // If called manually (e.g. close button), go back in history
    // This will trigger popstate, which closes the UI
    if (history.state && history.state.modal === 'cart') {
        history.back();
    } else {
        // Fallback if no state (e.g. refreshed page)
        closeCartUI();
    }
}

function closeCartUI() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.classList.remove('no-scroll');
    // Reset to cart view so reopening shows the cart, not shipping
    showCartView();
}

// Global Back Button Handler (Swipe on Mobile)
window.addEventListener('popstate', (event) => {
    // If we are navigating back from the cart state
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
        closeCartUI();
    }
});

// Active products data (loaded from API or fallback)
let productsData = [];
let categoriesData = [];

// Cart State
let cart = JSON.parse(localStorage.getItem('legado_cart')) || [];

// Load categories from API
async function loadCategoriesFromAPI() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) throw new Error('Categories API not available');

        const data = await response.json();
        if (data && data.length > 0) {
            categoriesData = data;
            console.log('✅ Categories loaded from API:', categoriesData.length);
            renderFilterButtons();
        }
    } catch (error) {
        console.warn('⚠️ Could not load categories from API:', error.message);
    }
}

// Lee la categoria del pathname (ej. /productos/llaveros -> "llaveros")
function getCategoryFromUrl() {
    const match = window.location.pathname.match(/^\/productos\/([^\/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : 'all';
}

// Render filter buttons dynamically
function renderFilterButtons() {
    const filterContainer = document.querySelector('.filter-buttons');
    if (!filterContainer) return;

    const activeSlug = getCategoryFromUrl();

    // Create "Todos" button + category buttons
    filterContainer.innerHTML = `
        <button class="filter-btn ${activeSlug === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
        ${categoriesData.map(cat => `
            <button class="filter-btn ${activeSlug === cat.slug ? 'active' : ''}" data-filter="${cat.slug}">${cat.name}</button>
        `).join('')}
    `;

    // Re-attach event listeners
    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter');
            // Actualiza URL sin recargar para que se pueda copiar/compartir
            const newPath = filter === 'all' ? '/productos' : `/productos/${filter}`;
            history.replaceState(null, '', newPath + window.location.search + window.location.hash);
            renderProducts(filter);
        });
    });
}

// Load products from API
async function loadProductsFromAPI() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('API not available');

        const data = await response.json();
        if (data && data.length > 0) {
            productsData = data;
            console.log('Products loaded from API:', productsData.length);
        } else {
            productsData = [];
            console.warn('No hay productos disponibles');
        }
    } catch (error) {
        console.warn('No se pudieron cargar los productos:', error.message);
        productsData = [];
    }

    // Render products after loading (aplica filtro de la URL si existe)
    renderProducts(getCategoryFromUrl());
    updateCartUI();
    preloadImages();

    // Si el URL trae ?p=<slug>, abrimos el modal del producto correspondiente.
    // (Sirve para los links compartidos: /producto/<slug> redirige a /productos?p=<slug>.)
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get('p');
    if (slugParam) {
        const product = productsData.find(p => p.slug === slugParam);
        if (product) {
            // Pequeño delay para que el grid termine de pintar antes del modal
            setTimeout(() => openProductModal(product.id), 80);
        }
    }
}

// Reset checkout button to default state
function resetCheckoutButton() {
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.textContent = 'Proceder al Pago';
        checkoutBtn.disabled = false;
    }
}

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    loadCategoriesFromAPI(); // Load categories first
    loadProductsFromAPI();
    setupEventListeners();
    resetCheckoutButton(); // Reset button on page load

    // Si el usuario llega con #cart (ej. desde /producto/<slug>), abre el sidebar
    if (window.location.hash === '#cart') {
        setTimeout(() => openCart(), 100);
    }

    // Escuchar mensaje de limpieza de carrito desde la página de éxito
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CLEAR_CART') {
            cart = [];
            saveCart();
            updateCartUI();
        }
    });
});

// Reset checkout button when user navigates back (from Stripe or browser back button)
window.addEventListener('pageshow', (event) => {
    // event.persisted is true when page is loaded from bfcache (back-forward cache)
    if (event.persisted) {
        resetCheckoutButton();
    }
});


// Render Products
function renderProducts(filter = 'all') {
    const grid = document.getElementById('products-grid');
    const filteredProducts = filter === 'all'
        ? productsData
        : productsData.filter(p => p.category === filter);

    if (filteredProducts.length === 0) {
        const message = filter === 'all'
            ? 'No hay productos disponibles por el momento. ¡Vuelve pronto!'
            : 'No hay productos disponibles en esta categoría por el momento.';
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 80px 20px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" style="margin-bottom: 20px;">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 01-8 0"></path>
                </svg>
                <p style="font-size: 18px; color: #999; font-weight: 500;">${message}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredProducts.map((product, index) => {
        const isOutOfStock = isProductOutOfStock(product);
        const totalStock = getProductTotalStock(product);
        const isLowStock = totalStock !== null && totalStock > 0 && totalStock <= 3;
        let stockBadge = '';
        if (isOutOfStock) {
            stockBadge = '<div class="product-badge stock-out">Agotado</div>';
        } else if (isLowStock) {
            stockBadge = `<div class="product-badge stock-low">&iexcl;Últimas ${totalStock} piezas!</div>`;
        }
        return `
        <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-category="${product.category}" data-id="${product.id}">
            ${product.badge ? `<div class="product-badge ${product.badge}">${product.badge === 'new' ? 'Nuevo' : 'Oferta'}</div>` : ''}
            ${stockBadge}
            <div class="product-image" onclick="${isOutOfStock ? '' : `openProductModal('${product.id}')`}" style="cursor: ${isOutOfStock ? 'default' : 'pointer'};">
                ${product.image
            ? `<img src="${product.image}" alt="${product.name}" loading="${index < 4 ? 'eager' : 'lazy'}" onload="this.parentElement.style.animation='none';this.parentElement.style.background='#fff'" style="width: 100%; height: 100%; object-fit: cover; ${isOutOfStock ? 'opacity: 0.5;' : ''}">`
            : `<div class="placeholder-product" style="background: ${product.gradient};"><span>${product.name}</span></div>`
        }
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">$${product.price.toLocaleString('es-MX')} MXN</div>
                <button class="buy-now-btn" onclick="${isOutOfStock ? '' : `openProductModal('${product.id}')`}" ${isOutOfStock ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>${isOutOfStock ? 'Agotado' : 'Comprar Ahora'}</button>
            </div>
        </div>
    `}).join('');
}

// Setup Event Listeners
function setupEventListeners() {
    // Filter buttons (fallback si la API de categorias no carga;
    // si carga, renderFilterButtons reemplaza estos botones y handlers)
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter');
                const newPath = filter === 'all' ? '/productos' : `/productos/${filter}`;
                history.replaceState(null, '', newPath + window.location.search + window.location.hash);
                renderProducts(filter);
            });
        });
    }

    // Cart toggle
    const cartToggle = document.getElementById('cart-toggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', openCart);
    }

    const cartClose = document.getElementById('cart-close');
    if (cartClose) {
        cartClose.addEventListener('click', closeCart);
    }

    // Cart overlay click to close
    const cartOverlay = document.getElementById('cart-overlay');
    if (cartOverlay) {
        cartOverlay.addEventListener('click', closeCart);
    }

    // Modal close
    const modalClose = document.getElementById('modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeProductModal);
    }

    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeProductModal);
    }

    // Quantity buttons
    const qtyPlus = document.getElementById('qty-plus');
    if (qtyPlus) {
        qtyPlus.addEventListener('click', () => {
            const input = document.getElementById('quantity');
            const maxAttr = input.getAttribute('max');
            const hardCap = maxAttr ? parseInt(maxAttr) : 10;
            const next = (parseInt(input.value) || 1) + 1;
            if (next > hardCap) {
                // Feedback inline si intenta excederse del stock disponible
                if (maxAttr) {
                    showCartToast(`Sólo hay ${hardCap} pieza${hardCap === 1 ? '' : 's'} disponible${hardCap === 1 ? '' : 's'}`, 'warning');
                }
                input.value = hardCap;
            } else {
                input.value = next;
            }
            updateModalStockUI();
        });
    }

    const qtyMinus = document.getElementById('qty-minus');
    if (qtyMinus) {
        qtyMinus.addEventListener('click', () => {
            const input = document.getElementById('quantity');
            input.value = Math.max(1, (parseInt(input.value) || 1) - 1);
            updateModalStockUI();
        });
    }

    // Si el usuario tipea manualmente la cantidad, recalcular limites
    const qtyInputEl = document.getElementById('quantity');
    if (qtyInputEl) {
        qtyInputEl.addEventListener('input', updateModalStockUI);
        qtyInputEl.addEventListener('change', updateModalStockUI);
    }

    // Add to cart from modal
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', addToCartFromModal);
    }

    // Checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', proceedToCheckout);
    }

    // Copiar link del producto desde el modal
    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const slug = document.getElementById('product-modal').dataset.productSlug;
            if (!slug) return;
            const url = `${window.location.origin}/producto/${encodeURIComponent(slug)}`;
            await copyToClipboard(url);
            shareBtn.classList.add('copied');
            const label = shareBtn.querySelector('.share-label');
            if (label) label.textContent = 'Link copiado';
            setTimeout(() => {
                shareBtn.classList.remove('copied');
                if (label) label.textContent = 'Copiar link';
            }, 1800);
        });
    }
}

// Helper de copy con fallback (clipboard API requiere contexto seguro)
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        console.warn('clipboard API fallo, usando fallback', e);
    }
    // Fallback con textarea + execCommand
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

// Open Product Modal
function openProductModal(productId) {
    // Use String comparison to handle both number and string IDs safely
    const product = productsData.find(p => String(p.id) === String(productId));
    if (!product) return;

    const modal = document.getElementById('product-modal');
    modal.dataset.productId = productId;
    modal.dataset.imagePath = product.image; // Store clean image path for VTO

    // Reset View State (Fix: Ensure we always start in details view)
    document.getElementById('product-details-view').style.display = 'grid';
    document.getElementById('try-on-view').style.display = 'none';

    // 1. Render Gallery (Main Image + Thumbnails)
    const modalImageContainer = document.getElementById('modal-image');
    const images = product.images && product.images.length > 0 ? product.images : [product.image];

    let galleryHTML = `
        <div class="main-image-container">
            <img src="${images[0]}" id="main-product-image" alt="${product.name}">
        </div>
    `;

    if (images.length > 1) {
        galleryHTML += `
            <div class="thumbnail-container">
                ${images.map((img, index) => `
                    <div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="changeMainImage('${img}', this)">
                        <img src="${img}" alt="Vista ${index + 1}">
                    </div>
                `).join('')}
            </div>
        `;
    }
    modalImageContainer.innerHTML = galleryHTML;

    // 2. Render Details
    document.getElementById('modal-name').textContent = product.name;
    document.getElementById('modal-price').textContent = `$${product.price.toLocaleString('es-MX')} MXN`;
    document.getElementById('modal-description').textContent = product.description;

    // 3. Render Variants (Colors)
    const variantGroup = document.getElementById('variant-group'); // Need to add this to HTML
    if (product.variants && product.variants.length > 0) {
        variantGroup.style.display = 'block';
        const variantContainer = document.getElementById('variant-options'); // Need to add this to HTML
        variantContainer.innerHTML = product.variants.map((variant, index) => {
            const variantAllOut = variant.stock
                ? Object.values(variant.stock).every(qty => qty === 0)
                : false;
            return `
            <button class="variant-btn ${index === 0 ? 'active' : ''} ${variantAllOut ? 'variant-out-of-stock' : ''}"
                    data-variant="${variant.name}"
                    data-image="${variant.image || ''}"
                    style="background-color: ${variant.color};"
                    title="${variant.name}${variantAllOut ? ' (Agotado)' : ''}"
                    onclick="selectVariant(this)"
                    ${variantAllOut ? 'disabled' : ''}>
            </button>`;
        }).join('');
    } else {
        variantGroup.style.display = 'none';
    }

    // 4. Render Sizes (with stock awareness per variant)
    const sizeGroup = document.getElementById('size-group');
    if (product.sizes && product.sizes.length > 0) {
        sizeGroup.style.display = 'block';
        const activeVariant = document.querySelector('.variant-btn.active');
        const variantName = activeVariant ? activeVariant.dataset.variant : null;
        updateSizeButtons(product, variantName);
    } else {
        sizeGroup.style.display = 'none';
    }

    // Reset quantity
    document.getElementById('quantity').value = 1;

    // Boton "copiar link" — guarda el slug en el modal y resetea el mensaje
    modal.dataset.productSlug = product.slug || '';
    const shareMsg = document.getElementById('modal-share-msg');
    if (shareMsg) shareMsg.classList.remove('show');
    const shareBtn = document.getElementById('modal-share-btn');
    if (shareBtn) shareBtn.style.display = product.slug ? 'inline-flex' : 'none';

    // Show modal
    modal.classList.add('active');
    document.body.classList.add('no-scroll');

    // Refrescar estado de stock (mensaje, max qty, boton)
    updateModalStockUI();

    // Google Analytics: Track product view
    if (typeof gtag !== 'undefined') {
        gtag('event', 'view_item', {
            currency: 'MXN',
            value: product.price,
            items: [{
                item_id: product.id,
                item_name: product.name,
                item_category: product.category,
                price: product.price,
                quantity: 1
            }]
        });
    }
}

// Helper: Change Main Image
function changeMainImage(src, thumb) {
    document.getElementById('main-product-image').src = src;
    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
    if (thumb) thumb.classList.add('active');
}

// Helper: Update size buttons with stock awareness
function updateSizeButtons(product, selectedVariantName) {
    const sizeGroup = document.getElementById('size-group');
    if (!product.sizes || product.sizes.length === 0) {
        sizeGroup.style.display = 'none';
        return;
    }

    sizeGroup.style.display = 'block';
    const variant = product.variants?.find(v => v.name === selectedVariantName);
    const variantStock = variant?.stock;

    document.getElementById('size-buttons').innerHTML = product.sizes.map(size => {
        let sizeOutOfStock = false;
        let sizeLowStock = false;
        let sizeQty = null;

        if (variantStock) {
            sizeQty = variantStock[size];
            sizeOutOfStock = sizeQty === 0;
            sizeLowStock = sizeQty !== null && sizeQty > 0 && sizeQty <= 3;
        }

        return `
            <button class="size-btn ${sizeOutOfStock ? 'size-out-of-stock' : ''}"
                    data-size="${size}"
                    ${sizeOutOfStock ? 'disabled' : ''}>
                ${size}
                ${sizeOutOfStock ? '<span class="size-stock-label">Agotado</span>' : ''}
                ${sizeLowStock ? `<span class="size-stock-label low">¡${sizeQty} left!</span>` : ''}
            </button>
        `;
    }).join('');

    // Re-attach click handlers (only on enabled buttons)
    document.querySelectorAll('.size-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateModalStockUI();
        });
    });
}

// Refresca el mensaje de stock, el max del input qty y el estado del boton "Agregar al carrito".
function updateModalStockUI() {
    const modal = document.getElementById('product-modal');
    if (!modal || !modal.classList.contains('active')) return;

    const productId = modal.dataset.productId;
    const product = productsData.find(p => String(p.id) === String(productId));
    if (!product) return;

    const statusEl = document.getElementById('modal-stock-status');
    const addBtn = document.getElementById('add-to-cart-btn');
    const qtyInput = document.getElementById('quantity');
    const qtyPlus = document.getElementById('qty-plus');
    const qtyMinus = document.getElementById('qty-minus');

    // Variante seleccionada
    const activeVariantBtn = document.querySelector('.variant-btn.active');
    const variantName = activeVariantBtn ? activeVariantBtn.dataset.variant : null;

    // Talla seleccionada (o 'Única' si no hay tallas)
    const activeSizeBtn = document.querySelector('.size-btn.active');
    const hasSizes = product.sizes && product.sizes.length > 0;
    const size = hasSizes ? (activeSizeBtn ? activeSizeBtn.dataset.size : null) : 'Única';

    const resetActions = (msg = '', type = '') => {
        if (statusEl) {
            if (msg) {
                statusEl.textContent = msg;
                statusEl.className = 'modal-stock-status ' + type;
                statusEl.style.display = 'block';
            } else {
                statusEl.style.display = 'none';
                statusEl.textContent = '';
            }
        }
    };

    // Si necesita talla y no se ha seleccionado: no mostrar mensaje, dejar boton activo
    if (hasSizes && !size) {
        resetActions('');
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = 'Agregar al Carrito';
        }
        if (qtyInput) qtyInput.removeAttribute('max');
        if (qtyPlus) qtyPlus.disabled = false;
        if (qtyMinus) qtyMinus.disabled = false;
        return;
    }

    const remaining = getRemainingStockForCombo(product, variantName, size);

    // Stock ilimitado
    if (remaining === null) {
        resetActions('');
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.textContent = 'Agregar al Carrito';
        }
        if (qtyInput) qtyInput.removeAttribute('max');
        if (qtyPlus) qtyPlus.disabled = false;
        if (qtyMinus) qtyMinus.disabled = false;
        return;
    }

    // Sin stock disponible
    if (remaining <= 0) {
        // Distinguir entre "agotado en bodega" y "ya tienes todo en carrito"
        const absoluteCheck = (product.variants && product.variants.some(v => v.stock) && variantName)
            ? getVariantSizeStock(product, variantName, size)
            : product.stock;
        const fullyOut = absoluteCheck === 0;
        const msg = fullyOut
            ? 'Agotado'
            : 'Ya tienes todas las piezas disponibles en tu carrito';
        resetActions(msg, 'danger');
        if (addBtn) {
            addBtn.disabled = true;
            addBtn.textContent = fullyOut ? 'Agotado' : 'Sin stock disponible';
        }
        if (qtyInput) {
            qtyInput.value = 1;
            qtyInput.setAttribute('max', '1');
        }
        if (qtyPlus) qtyPlus.disabled = true;
        if (qtyMinus) qtyMinus.disabled = true;
        return;
    }

    // Hay stock: clamp qty y mostrar info
    if (qtyInput) {
        qtyInput.setAttribute('max', String(remaining));
        let qty = parseInt(qtyInput.value);
        if (isNaN(qty) || qty < 1) qty = 1;
        if (qty > remaining) qty = remaining;
        qtyInput.value = qty;
    }
    if (qtyPlus) qtyPlus.disabled = false;
    if (qtyMinus) qtyMinus.disabled = false;
    if (addBtn) {
        addBtn.disabled = false;
        addBtn.textContent = 'Agregar al Carrito';
    }

    if (remaining <= 3) {
        resetActions(`¡Sólo quedan ${remaining} pieza${remaining === 1 ? '' : 's'}!`, 'warning');
    } else {
        resetActions('');
    }
}

// Helper: Select Variant
function selectVariant(btn) {
    // 1. Update UI state
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 2. Get Product and Variant Data
    const modal = document.getElementById('product-modal');
    // Ensure string comparison
    const productId = modal.dataset.productId;
    const product = productsData.find(p => String(p.id) === String(productId));
    const variantName = btn.dataset.variant;

    if (!product) return;

    const variant = product.variants.find(v => v.name === variantName);
    if (!variant) return;

    // 3. Update Main Image
    const mainImage = document.getElementById('main-product-image');
    if (mainImage && variant.image) {
        mainImage.src = variant.image;
        modal.dataset.imagePath = variant.image; // Update for VTO
    }

    // 4. Update Thumbnails
    const thumbnailContainer = document.querySelector('.thumbnail-container');
    if (thumbnailContainer && variant.images && variant.images.length > 0) {
        thumbnailContainer.innerHTML = variant.images.map((img, index) => `
            <div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="changeMainImage('${img}', this)">
                <img src="${img}" alt="${variant.name} ${index + 1}">
            </div>
        `).join('');
    }

    // 5. Update size buttons stock for this variant
    updateSizeButtons(product, variantName);

    // 6. Refrescar estado de stock (mensaje + boton + qty max)
    updateModalStockUI();
}

// Close Product Modal
function closeProductModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.remove('active');
    document.body.classList.remove('no-scroll');
}

// Add to Cart from Modal
function addToCartFromModal() {
    try {
        const modal = document.getElementById('product-modal');
        if (!modal.dataset.productId) {
            console.error('No product ID in modal dataset');
            return;
        }

        const productId = modal.dataset.productId;
        const product = productsData.find(p => String(p.id) === String(productId));

        if (!product) {
            alert('Error: Producto no encontrado');
            return;
        }

        // Get selected size
        const selectedSizeBtn = document.querySelector('.size-btn.active');
        let size = null;
        if (product.sizes.length > 0) {
            if (!selectedSizeBtn) {
                const statusEl = document.getElementById('modal-stock-status');
                if (statusEl) {
                    statusEl.textContent = 'Por favor selecciona una talla';
                    statusEl.className = 'modal-stock-status warning';
                    statusEl.style.display = 'block';
                }
                return;
            }
            size = selectedSizeBtn.dataset.size;
        } else {
            size = 'Única';
        }

        // Get selected variant (Color)
        const selectedVariantBtn = document.querySelector('.variant-btn.active');
        let variant = null;
        let variantImage = null;
        if (product.variants && product.variants.length > 0) {
            if (!selectedVariantBtn) {
                // Default to first if none selected (though UI selects first by default)
                variant = product.variants[0].name;
                variantImage = product.variants[0].image;
            } else {
                variant = selectedVariantBtn.dataset.variant;
                // Find the variant object to get its image
                const selectedVariant = product.variants.find(v => v.name === variant);
                if (selectedVariant && selectedVariant.image) {
                    variantImage = selectedVariant.image;
                }
            }
        }

        // Use variant image if available, otherwise use main product image
        const cartImage = variantImage || product.image;

        const quantityInput = document.getElementById('quantity');
        const quantity = parseInt(quantityInput.value) || 1;

        // Validar stock antes de agregar (considera tanto variante/talla como producto general)
        const remaining = getRemainingStockForCombo(product, variant, size);
        if (remaining !== null && quantity > remaining) {
            const statusEl = document.getElementById('modal-stock-status');
            const msg = remaining === 0
                ? 'No hay piezas disponibles para esta selección.'
                : `Sólo puedes agregar ${remaining} pieza${remaining === 1 ? '' : 's'} más al carrito.`;
            if (statusEl) {
                statusEl.textContent = msg;
                statusEl.className = 'modal-stock-status danger';
                statusEl.style.display = 'block';
            }
            updateModalStockUI();
            return;
        }

        // Check if item already in cart (match ID, Size, AND Variant)
        // Use loose/string comparison for ID
        const existingItemIndex = cart.findIndex(item =>
            String(item.id) === String(productId) && item.size === size && item.variant === variant
        );

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += quantity;
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                size: size,
                variant: variant, // Store the variant (color)
                quantity: quantity,
                gradient: product.gradient,
                image: cartImage // Use variant image if available
            });
        }

        // Save to localStorage
        saveCart();

        // Google Analytics: Track add to cart
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

        // Update UI
        updateCartUI();

        // Close modal
        closeProductModal();

        // Open cart sidebar
        openCart();

    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Hubo un error al agregar al carrito: ' + error.message);
    }
}

// Update Cart UI
function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    const cartItems = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-summary');

    // Update count
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCount) {
        cartCount.textContent = totalItems;
    }

    // Update items
    if (cartItems && cartTotalElement) {
        if (cart.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <p>Tu carrito está vacío</p>
                </div>
            `;
            cartTotalElement.innerHTML = `
                <div class="cart-total">
                    <span>Total:</span>
                    <span>$0 MXN</span>
                </div>
            `;
            return;
        }

        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-image">
                    ${item.image
                ? `<img src="${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover;">`
                : `<div class="placeholder-product" style="background: ${item.gradient};"><span>${item.name}</span></div>`
            }
                </div>
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-options">Talla: ${item.size}${item.variant ? ` | Color: ${item.variant}` : ''}</div>
                    <div class="cart-item-price">$${item.price.toLocaleString('es-MX')} MXN</div>
                    <div class="cart-item-quantity">
                        <button class="cart-qty-btn" onclick="updateCartItem(${index}, -1)">-</button>
                        <span class="cart-qty-value">${item.quantity}</span>
                        <button class="cart-qty-btn" onclick="updateCartItem(${index}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart(${index})">&times;</button>
            </div>
            `).join('');

        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        cartTotalElement.innerHTML = `
            <div class="summary-row">
                <span>Subtotal:</span>
                <span>$${total.toLocaleString('es-MX')} MXN</span>
            </div>
            <div class="summary-row shipping-note">
                <span>Envío:</span>
                <span>Calculado al pagar</span>
            </div>
            <div class="summary-row total-row">
                <span>Total:</span>
                <span>$${total.toLocaleString('es-MX')} MXN + Envío</span>
            </div>
        `;
    }
}

// Update Cart Quantity
function updateCartItem(index, change) {
    const item = cart[index];

    if (change > 0) {
        // Check stock before incrementing
        const product = productsData.find(p => String(p.id) === String(item.id));
        if (product) {
            const available = getVariantSizeStock(product, item.variant, item.size);
            if (available !== null && item.quantity + change > available) {
                showCartToast(`Sólo quedan ${available} pieza${available === 1 ? '' : 's'} de ${item.variant ? item.variant + ' ' : ''}talla ${item.size}`, 'warning');
                return;
            }
            // Also check product-level stock for non-variant products
            if (available === null && product.stock !== null && product.stock !== undefined) {
                const totalInCart = cart
                    .filter(c => String(c.id) === String(item.id))
                    .reduce((sum, c) => sum + c.quantity, 0);
                if (totalInCart + change > product.stock) {
                    showCartToast(`Sólo quedan ${product.stock} pieza${product.stock === 1 ? '' : 's'} de ${item.name}`, 'warning');
                    return;
                }
            }
        }
    }

    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    updateCartUI();
}

// Remove from Cart
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

// Save Cart
function saveCart() {
    localStorage.setItem('legado_cart', JSON.stringify(cart));
}

// --- Shipping & delivery state ---
let shippingQuoteToken = null;
let shippingSelectedRateId = null;
let deliveryMethod = null; // 'shipping' or 'pickup'

// Proceed to Checkout
async function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }

    // Google Analytics: Track begin checkout
    if (typeof gtag !== 'undefined') {
        const totalValue = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        gtag('event', 'begin_checkout', {
            currency: 'MXN',
            value: totalValue,
            items: cart.map(item => ({
                item_id: item.id,
                item_name: item.name,
                item_variant: item.variant || 'N/A',
                price: item.price,
                quantity: item.quantity
            }))
        });
    }

    const pickupCode = document.getElementById('internal-code')?.value.trim();
    if (pickupCode === 'GOCA') {
        // Internal order: go straight to Stripe
        const checkoutBtn = document.getElementById('checkout-btn');
        checkoutBtn.textContent = 'Procesando...';
        checkoutBtn.disabled = true;
        try {
            await createStripeCheckoutSession();
        } catch (error) {
            checkoutBtn.textContent = 'Proceder al Pago';
            checkoutBtn.disabled = false;
        }
    } else {
        // Normal order: show delivery method selection
        showDeliveryView();
    }
}

function showDeliveryView() {
    deliveryMethod = null;
    // Reset selection state
    document.querySelectorAll('.delivery-option').forEach(el => el.classList.remove('selected'));
    document.getElementById('pickup-details').style.display = 'none';
    document.getElementById('delivery-footer').style.display = 'none';
    // Switch views
    document.getElementById('cart-main-view').style.display = 'none';
    document.getElementById('cart-delivery-view').style.display = 'block';
    document.getElementById('cart-shipping-view').style.display = 'none';
    document.getElementById('cart-title').textContent = 'Método de Entrega';
    document.getElementById('cart-back').style.display = 'flex';
}

function selectDeliveryMethod(method) {
    deliveryMethod = method;
    document.querySelectorAll('.delivery-option').forEach(el => el.classList.remove('selected'));
    document.getElementById(`delivery-option-${method}`).classList.add('selected');
    document.getElementById('pickup-details').style.display = method === 'pickup' ? 'block' : 'none';
    document.getElementById('delivery-footer').style.display = 'block';
}

async function continueFromDelivery() {
    if (!deliveryMethod) return;
    if (deliveryMethod === 'shipping') {
        showShippingView();
    } else {
        // Pickup: go straight to Stripe
        const btn = document.getElementById('delivery-continue-btn');
        btn.textContent = 'Procesando...';
        btn.disabled = true;
        try {
            await createStripeCheckoutSession();
        } catch (error) {
            btn.textContent = 'Continuar';
            btn.disabled = false;
        }
    }
}

function showShippingView() {
    shippingQuoteToken = null;
    shippingSelectedRateId = null;
    // Reset shipping form
    document.getElementById('shipping-rates').innerHTML = '';
    document.getElementById('shipping-error').style.display = 'none';
    document.getElementById('shipping-loading').style.display = 'none';
    document.getElementById('shipping-continue-btn').style.display = 'none';
    document.getElementById('shipping-footer').style.display = 'none';
    document.getElementById('shipping-postal-code').value = '';
    document.getElementById('shipping-state').value = '';
    document.getElementById('shipping-city').value = '';
    // Hide delivery view
    document.getElementById('cart-delivery-view').style.display = 'none';
    document.getElementById('shipping-neighborhood').value = '';
    // Switch views
    document.getElementById('cart-main-view').style.display = 'none';
    document.getElementById('cart-shipping-view').style.display = 'block';
    document.getElementById('cart-title').textContent = 'Calcular Envío';
    document.getElementById('cart-back').style.display = 'flex';
    document.getElementById('shipping-postal-code').focus();
}

function showCartView() {
    document.getElementById('cart-delivery-view').style.display = 'none';
    document.getElementById('cart-shipping-view').style.display = 'none';
    document.getElementById('shipping-footer').style.display = 'none';
    document.getElementById('cart-main-view').style.display = 'flex';
    document.getElementById('cart-title').textContent = 'Carrito de Compras';
    document.getElementById('cart-back').style.display = 'none';
}

async function fetchShippingRates() {
    const postalCode = document.getElementById('shipping-postal-code').value.trim();
    const state = document.getElementById('shipping-state').value;
    const city = document.getElementById('shipping-city').value.trim();
    const neighborhood = document.getElementById('shipping-neighborhood').value.trim();

    const errorEl = document.getElementById('shipping-error');
    const loadingEl = document.getElementById('shipping-loading');
    const ratesEl = document.getElementById('shipping-rates');
    const continueBtn = document.getElementById('shipping-continue-btn');

    if (!/^\d{5}$/.test(postalCode)) {
        errorEl.textContent = 'Ingresa un código postal válido (5 dígitos)';
        errorEl.style.display = 'block';
        return;
    }
    if (!state) {
        errorEl.textContent = 'Selecciona un estado';
        errorEl.style.display = 'block';
        return;
    }
    if (!city) {
        errorEl.textContent = 'Ingresa la ciudad o municipio';
        errorEl.style.display = 'block';
        return;
    }
    if (!neighborhood) {
        errorEl.textContent = 'Ingresa la colonia';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    ratesEl.innerHTML = '';
    continueBtn.style.display = 'none';
    loadingEl.style.display = 'block';

    try {
        const res = await fetch('/api/shipping/rates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                postalCode,
                state,
                city,
                neighborhood,
                items: cart.map(i => ({ name: i.name, quantity: i.quantity }))
            })
        });

        const data = await res.json();
        loadingEl.style.display = 'none';

        if (!res.ok) {
            errorEl.textContent = data.error || 'Error al cotizar envío';
            errorEl.style.display = 'block';
            return;
        }

        shippingQuoteToken = data.quoteToken;
        renderShippingRates(data.rates, data.fallback);
    } catch (err) {
        loadingEl.style.display = 'none';
        errorEl.textContent = 'Error de conexión. Intenta de nuevo.';
        errorEl.style.display = 'block';
    }
}

function renderShippingRates(rates, isFallback) {
    const ratesEl = document.getElementById('shipping-rates');
    if (!rates.length) {
        ratesEl.innerHTML = '<p style="text-align:center;color:#888;">No hay tarifas disponibles para ese código postal.</p>';
        return;
    }

    ratesEl.innerHTML = rates.map(rate => `
        <div class="shipping-rate-card" data-rate-id="${rate.id}" onclick="selectShippingRate('${rate.id}')">
            <div class="rate-info">
                <h4>${rate.carrier}</h4>
                <p>${rate.service}</p>
            </div>
            <div class="rate-price">
                <div class="price">$${rate.price.toLocaleString('es-MX')} MXN</div>
                ${rate.days ? `<div class="days">${rate.days} día${rate.days > 1 ? 's' : ''} hábil${rate.days > 1 ? 'es' : ''}</div>` : ''}
            </div>
        </div>
    `).join('');
}

function selectShippingRate(rateId) {
    shippingSelectedRateId = rateId;
    document.querySelectorAll('.shipping-rate-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.rateId === rateId);
    });
    document.getElementById('shipping-footer').style.display = 'block';
    document.getElementById('shipping-continue-btn').style.display = 'block';
}

async function continueToStripeFromShipping() {
    if (!shippingSelectedRateId) return;

    const continueBtn = document.getElementById('shipping-continue-btn');
    continueBtn.textContent = 'Procesando...';
    continueBtn.disabled = true;

    try {
        await createStripeCheckoutSession();
    } catch (error) {
        continueBtn.textContent = 'Continuar al Pago';
        continueBtn.disabled = false;
    }
}

// Stripe Integration Function
async function createStripeCheckoutSession() {
    try {
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // NOTE: item.id adds ~36 chars per item to Stripe metadata (500 char limit)
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    size: item.size,
                    variant: item.variant || null
                })),
                pickupCode: document.getElementById('internal-code')?.value.trim(),
                quoteToken: shippingQuoteToken,
                selectedRateId: shippingSelectedRateId,
                deliveryMethod: deliveryMethod || 'shipping'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear sesión de pago');
        }

        const { sessionId } = await response.json();
        const configResponse = await fetch('/config');
        const { publishableKey } = await configResponse.json();
        await loadStripe();
        const stripe = Stripe(publishableKey);
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) throw error;
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message}`);
        throw error;
    }
}

// Shipping & delivery view event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cart-back')?.addEventListener('click', () => {
        // If we're in shipping view, go back to delivery view; otherwise go to cart
        if (document.getElementById('cart-shipping-view').style.display !== 'none') {
            showDeliveryView();
        } else {
            showCartView();
        }
    });
    document.getElementById('delivery-continue-btn')?.addEventListener('click', continueFromDelivery);
    document.getElementById('shipping-continue-btn')?.addEventListener('click', continueToStripeFromShipping);
    document.getElementById('shipping-search-btn')?.addEventListener('click', fetchShippingRates);

    // Allow Enter key on any shipping field to trigger search
    document.querySelectorAll('#shipping-postal-code, #shipping-city, #shipping-neighborhood').forEach(el => {
        el?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') fetchShippingRates();
        });
    });

    // Numeric-only input for postal code
    document.getElementById('shipping-postal-code')?.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });
});

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            window.scrollTo({
                top: target.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// Console branding
console.log('%c Legado San José - Tienda ', 'background: #F5A84F; color: #fff; font-size: 20px; padding: 10px;');

// Virtual Try-On Logic
function openTryOn() {
    // Switch views within the modal
    document.getElementById('product-details-view').style.display = 'none';
    document.getElementById('try-on-view').style.display = 'block';

    // Reset result area to empty state
    document.getElementById('try-on-result').classList.add('placeholder-state');
    document.getElementById('empty-state-msg').style.display = 'block';
    document.getElementById('loading-spinner').style.display = 'none';
    document.getElementById('generated-image').style.display = 'none';

    // Clear any previous errors
    const errors = document.querySelectorAll('#try-on-result p.error-msg');
    errors.forEach(e => e.remove());
}

function closeTryOn() {
    // Return to product details view
    document.getElementById('try-on-view').style.display = 'none';
    document.getElementById('product-details-view').style.display = 'grid'; // Restore grid layout

    // Reset state
    document.getElementById('user-photo-input').value = '';
    document.getElementById('user-photo-preview').style.display = 'none';
    document.getElementById('generate-btn').style.display = 'none';
    document.getElementById('remove-photo-btn').style.display = 'none';
}

function handlePhotoUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('user-photo-preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            document.querySelector('.upload-placeholder').style.display = 'none'; // Hide placeholder
            document.getElementById('generate-btn').style.display = 'block';
            document.getElementById('remove-photo-btn').style.display = 'flex';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Remove uploaded photo
function removePhoto(event) {
    if (event) event.stopPropagation(); // Prevent triggering upload click

    document.getElementById('user-photo-input').value = '';
    document.getElementById('user-photo-preview').style.display = 'none';
    document.getElementById('user-photo-preview').src = '';
    document.querySelector('.upload-placeholder').style.display = 'flex'; // Show placeholder
    document.getElementById('generate-btn').style.display = 'none';
    document.getElementById('remove-photo-btn').style.display = 'none';
}

async function generateTryOn() {
    const input = document.getElementById('user-photo-input');
    if (!input.files[0]) return;

    const modal = document.getElementById('product-modal');
    const productImageUrl = modal.dataset.imagePath; // Use stored clean path

    if (!productImageUrl) {
        alert('Error: No se pudo obtener la imagen del producto.');
        return;
    }

    // UI Updates for Loading State
    document.getElementById('generate-btn').style.display = 'none'; // Hide button to prevent double click

    const resultContainer = document.getElementById('try-on-result');
    const emptyState = document.getElementById('empty-state-msg');
    const spinner = document.getElementById('loading-spinner');
    const loadingText = document.getElementById('loading-text');
    const generatedImg = document.getElementById('generated-image');

    // Clear previous errors/results
    const prevErrors = resultContainer.querySelectorAll('.error-msg, .text-result');
    prevErrors.forEach(e => e.remove());

    // Show Loading
    resultContainer.classList.remove('placeholder-state'); // Remove dashed border if desired, or keep it
    emptyState.style.display = 'none';
    generatedImg.style.display = 'none';
    spinner.style.display = 'flex';
    loadingText.textContent = '✨ Conectando con IA...';

    const formData = new FormData();
    formData.append('image', input.files[0]);
    formData.append('productImage', productImageUrl);

    try {
        loadingText.textContent = '✨ Generando tu look (esto puede tardar)...';

        const response = await fetch('/api/try-on', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.error) {
            spinner.style.display = 'none';
            // Show error inline
            const errorMsg = document.createElement('p');
            errorMsg.className = 'error-msg';
            errorMsg.style.color = 'red';
            errorMsg.style.textAlign = 'center';
            errorMsg.textContent = '⚠️ ' + data.error;
            resultContainer.appendChild(errorMsg);
            return;
        }

        spinner.style.display = 'none';

        // Display result
        if (data.result && (data.result.startsWith('data:image') || data.result.length > 1000)) {
            generatedImg.src = data.result.startsWith('data:') ? data.result : `data:image/png;base64,${data.result}`;
            generatedImg.style.display = 'block';
            resultContainer.style.borderStyle = 'solid'; // Ensure solid border for result
        } else {
            // Fallback for text response
            const textResult = document.createElement('p');
            textResult.className = 'text-result';
            textResult.textContent = 'IA: ' + data.result;
            textResult.style.padding = '10px';
            textResult.style.background = '#f0f0f0';
            textResult.style.borderRadius = '8px';
            resultContainer.appendChild(textResult);
        }

    } catch (error) {
        console.error('Error:', error);
        spinner.style.display = 'none';
        const errorMsg = document.createElement('p');
        errorMsg.className = 'error-msg';
        errorMsg.style.color = 'red';
        errorMsg.textContent = 'Error de conexión. Intenta de nuevo.';
        resultContainer.appendChild(errorMsg);
    } finally {
        document.getElementById('generate-btn').style.display = 'block';
    }
}

// Preload main product images (deferred to not compete with initial render)
function preloadImages() {
    const preload = () => {
        const mainImages = new Set();
        productsData.forEach(product => {
            if (product.image) mainImages.add(product.image);
        });
        mainImages.forEach(url => {
            const img = new Image();
            img.src = url;
        });
        console.log(`Preloaded ${mainImages.size} main images.`);
    };

    if ('requestIdleCallback' in window) {
        requestIdleCallback(preload);
    } else {
        setTimeout(preload, 2000);
    }
}

// Scroll to Top Button
(function () {
    const scrollBtn = document.getElementById('scroll-to-top');
    if (!scrollBtn) return;

    window.addEventListener('scroll', function () {
        if (window.scrollY > 400) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
    });

    scrollBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

