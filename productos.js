// Product Data
// Product Data
const productsData = [
    {
        id: 1,
        name: 'Gorra Legado',
        price: 250,
        category: 'gorras',
        image: 'Fotos/gorra1 frente.png', // Default image
        images: ['Fotos/gorra1 frente.png', 'Fotos/gorra1 frente.png', 'Fotos/gorra1 frente.png'], // Placeholder for multiple angles
        gradient: 'linear-gradient(135deg, #F5A84F 0%, #EDE4CE 100%)',
        description: 'Gorra de alta calidad con diseño exclusivo de Legado San José.',
        sizes: ['S', 'M', 'L'],
        variants: [
            { name: 'Negra', color: '#000000' },
            { name: 'Café', color: '#64401B' },
            { name: 'Beige', color: '#EDE4CE' }
        ],
        badge: 'new'
    },
    {
        id: 2,
        name: 'Mochila Legado',
        price: 3000,
        category: 'mochilas',
        image: 'Fotos/Mochila.png',
        images: ['Fotos/Mochila.png', 'Fotos/Mochila.png'],
        gradient: 'linear-gradient(135deg, #64401B 0%, #EDE4CE 100%)',
        description: 'Mochila espaciosa y resistente, ideal para el día a día.',
        sizes: ['Única'],
        variants: [] // No variants
    },
    {
        id: 3,
        name: 'Maleta de Viaje',
        price: 4000,
        category: 'maletas',
        image: 'Fotos/Maleta.png',
        images: ['Fotos/Maleta.png', 'Fotos/Maleta.png'],
        gradient: 'linear-gradient(135deg, #000 0%, #F5A84F 100%)',
        description: 'Maleta premium con gran capacidad y durabilidad.',
        sizes: ['Grande'],
        variants: [] // No variants
    },
    {
        id: 4,
        name: 'Playera Oficial',
        price: 200,
        category: 'playeras',
        image: 'Fotos/Logotipo Rancho San José-12.png', // Placeholder
        images: ['Fotos/Logotipo Rancho San José-12.png'],
        gradient: 'linear-gradient(135deg, #64401B 0%, #000 100%)',
        description: 'Playera cómoda con el diseño auténtico de Legado San José.',
        sizes: ['S', 'M', 'L', 'XL', 'XXL'],
        variants: [
            { name: 'Negra', color: '#000000' },
            { name: 'Blanca', color: '#FFFFFF' },
            { name: 'Azul', color: '#1e3a8a' },
            { name: 'Gris', color: '#4b5563' },
            { name: 'Roja', color: '#dc2626' }
        ]
    }
];

// Cart State
let cart = JSON.parse(localStorage.getItem('legado_cart')) || [];

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    renderProducts();
    updateCartUI();
    setupEventListeners();

    // Escuchar mensaje de limpieza de carrito desde la página de éxito
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CLEAR_CART') {
            cart = [];
            saveCart();
            updateCartUI();
        }
    });
});

// Render Products
function renderProducts(filter = 'all') {
    const grid = document.getElementById('products-grid');
    const filteredProducts = filter === 'all'
        ? productsData
        : productsData.filter(p => p.category === filter);

    grid.innerHTML = filteredProducts.map(product => `
        <div class="product-card" data-category="${product.category}" data-id="${product.id}">
            ${product.badge ? `<div class="product-badge ${product.badge}">${product.badge === 'new' ? 'Nuevo' : 'Oferta'}</div>` : ''}
            <div class="product-image">
                ${product.image
            ? `<img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">`
            : `<div class="placeholder-product" style="background: ${product.gradient};"><span>${product.name}</span></div>`
        }
                <div class="product-overlay">
                    <button class="quick-view" onclick="openProductModal(${product.id})">Vista Rápida</button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <div class="product-price">$${product.price.toLocaleString('es-MX')} MXN</div>
                <button class="buy-now-btn" onclick="openProductModal(${product.id})">Comprar Ahora</button>
            </div>
        </div>
    `).join('');
}

// Setup Event Listeners
function setupEventListeners() {
    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.getAttribute('data-filter');
                renderProducts(filter);
            });
        });
    }

    // Cart toggle
    const cartToggle = document.getElementById('cart-toggle');
    if (cartToggle) {
        cartToggle.addEventListener('click', () => {
            document.getElementById('cart-sidebar').classList.add('open');
        });
    }

    const cartClose = document.getElementById('cart-close');
    if (cartClose) {
        cartClose.addEventListener('click', () => {
            document.getElementById('cart-sidebar').classList.remove('open');
        });
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
            input.value = Math.min(10, parseInt(input.value) + 1);
        });
    }

    const qtyMinus = document.getElementById('qty-minus');
    if (qtyMinus) {
        qtyMinus.addEventListener('click', () => {
            const input = document.getElementById('quantity');
            input.value = Math.max(1, parseInt(input.value) - 1);
        });
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
}

// Open Product Modal
function openProductModal(productId) {
    const product = productsData.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('product-modal');
    modal.dataset.productId = productId;

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
        variantContainer.innerHTML = product.variants.map((variant, index) => `
            <button class="variant-btn ${index === 0 ? 'active' : ''}" 
                    data-variant="${variant.name}" 
                    style="background-color: ${variant.color};" 
                    title="${variant.name}"
                    onclick="selectVariant(this)">
            </button>
        `).join('');
    } else {
        variantGroup.style.display = 'none';
    }

    // 4. Render Sizes (Separate Buttons)
    const sizeGroup = document.getElementById('size-group');
    if (product.sizes && product.sizes.length > 0) {
        sizeGroup.style.display = 'block';
        document.getElementById('size-buttons').innerHTML = product.sizes.map(size => `
            <button class="size-btn" data-size="${size}">${size}</button>
        `).join('');

        // Add size selection handlers
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    } else {
        sizeGroup.style.display = 'none';
    }

    // Reset quantity
    document.getElementById('quantity').value = 1;

    // Show modal
    modal.classList.add('active');
    document.body.classList.add('no-scroll');
}

// Helper: Change Main Image
function changeMainImage(src, thumb) {
    document.getElementById('main-product-image').src = src;
    document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
}

// Helper: Select Variant
function selectVariant(btn) {
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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

        const productId = parseInt(modal.dataset.productId);
        const product = productsData.find(p => p.id === productId);

        if (!product) {
            alert('Error: Producto no encontrado');
            return;
        }

        // Get selected size
        const selectedSizeBtn = document.querySelector('.size-btn.active');
        let size = null;
        if (product.sizes.length > 0) {
            if (!selectedSizeBtn) {
                alert('Por favor selecciona una talla');
                return;
            }
            size = selectedSizeBtn.dataset.size;
        } else {
            size = 'Única';
        }

        // Get selected variant (Color)
        const selectedVariantBtn = document.querySelector('.variant-btn.active');
        let variant = null;
        if (product.variants && product.variants.length > 0) {
            if (!selectedVariantBtn) {
                // Default to first if none selected (though UI selects first by default)
                variant = product.variants[0].name;
            } else {
                variant = selectedVariantBtn.dataset.variant;
            }
        }

        const quantityInput = document.getElementById('quantity');
        const quantity = parseInt(quantityInput.value) || 1;

        // Check if item already in cart (match ID, Size, AND Variant)
        const existingItemIndex = cart.findIndex(item =>
            item.id === productId && item.size === size && item.variant === variant
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
                image: product.image // Use main image for cart thumbnail
            });
        }

        // Save to localStorage
        localStorage.setItem('cart', JSON.stringify(cart));

        // Update UI
        updateCartUI();

        // Close modal
        closeProductModal();

        // Open cart sidebar
        document.getElementById('cart-sidebar').classList.add('open');

    } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Hubo un error al agregar al carrito: ' + error.message);
    }
}

// Update Cart UI
function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    const cartItems = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');

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
            cartTotalElement.innerHTML = '<span>Total:</span> <span>$0 MXN</span>';
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
                    <div class="cart-item-options">Talla: ${item.size}</div>
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
        cartTotalElement.innerHTML = `<span>Total:</span> <span>$${total.toLocaleString('es-MX')} MXN</span>`;
    }
}

// Update Cart Quantity
function updateCartItem(index, change) {
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

// Proceed to Checkout (will integrate with Stripe)
async function proceedToCheckout() {
    if (cart.length === 0) {
        alert('Tu carrito está vacío');
        return;
    }

    // Mostrar loading en el botón
    const checkoutBtn = document.getElementById('checkout-btn');
    const originalText = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Procesando...';
    checkoutBtn.disabled = true;

    try {
        await createStripeCheckoutSession();
    } catch (error) {
        // Restaurar botón si hay error
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
    }
}

// Stripe Integration Function
async function createStripeCheckoutSession() {
    try {
        // Llamar al backend para crear una sesión de Stripe Checkout
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    size: item.size
                })),
                pickupCode: document.getElementById('internal-code')?.value.trim()
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear sesión de pago');
        }

        const { sessionId } = await response.json();

        // Obtener la clave pública del backend
        const configResponse = await fetch('/config');
        const { publishableKey } = await configResponse.json();

        // Inicializar Stripe con la clave dinámica
        const stripe = Stripe(publishableKey);

        // Redirigir a Stripe Checkout
        const { error } = await stripe.redirectToCheckout({ sessionId });

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error: ${error.message}`);
        throw error;
    }
}

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
