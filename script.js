// Navbar Scroll Effect and Hero Fade
const navbar = document.getElementById('navbar');
const hero = document.querySelector('.hero');
const scrollIndicator = document.querySelector('.scroll-indicator');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // Navbar scroll effect
    if (currentScroll > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    // Fade out hero on scroll
    if (hero) {
        const heroHeight = hero.offsetHeight;
        const fadeStart = heroHeight * 0.6; // Start fading at 60% of hero height

        if (currentScroll > fadeStart) {
            const fadeProgress = (currentScroll - fadeStart) / (heroHeight * 0.4);
            const opacity = Math.max(0, 1 - fadeProgress);
            hero.style.opacity = opacity;
            hero.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
        } else {
            hero.style.opacity = 1;
            hero.style.pointerEvents = 'auto';
        }
    }

    // Scroll indicator fade
    if (scrollIndicator) {
        const opacity = 1 - (currentScroll / 500);
        scrollIndicator.style.opacity = Math.max(0, opacity);
    }

    lastScroll = currentScroll;
});

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Reveal Animation on Scroll
const revealElements = document.querySelectorAll('.reveal');

const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const revealPoint = 150;

    revealElements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;

        if (elementTop < windowHeight - revealPoint) {
            element.classList.add('active');
        }
    });
};

window.addEventListener('scroll', revealOnScroll);
revealOnScroll(); // Initial check

// Product Filter
const filterButtons = document.querySelectorAll('.filter-btn');
const productCards = document.querySelectorAll('.product-card');

filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        filterButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        button.classList.add('active');

        const filterValue = button.getAttribute('data-filter');

        productCards.forEach(card => {
            const category = card.getAttribute('data-category');

            if (filterValue === 'all' || category === filterValue) {
                card.style.display = 'block';
                card.style.animation = 'fadeIn 0.6s ease forwards';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// Quick View Hover Effect
const productCardsWithOverlay = document.querySelectorAll('.product-card');

productCardsWithOverlay.forEach(card => {
    const quickViewBtn = card.querySelector('.quick-view');

    if (quickViewBtn) {
        quickViewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Add your quick view modal logic here
            alert('Vista rápida del producto - Aquí se mostraría un modal con detalles del producto');
        });
    }
});

// Newsletter Form
const newsletterForm = document.querySelector('.newsletter-form');

if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newsletterForm.querySelector('input[type="email"]').value;

        if (email) {
            alert('¡Gracias por suscribirte! Recibirás un 10% de descuento en tu correo.');
            newsletterForm.reset();
        }
    });
}

// Cart Functionality (Basic)
let cartCount = 0;
const cartCountElement = document.querySelector('.cart-count');
const navCart = document.querySelector('.nav-cart');

// Add click event to products (simulate adding to cart)
productCards.forEach(card => {
    card.addEventListener('click', (e) => {
        // Don't trigger if clicking quick view
        if (e.target.classList.contains('quick-view')) return;

        cartCount++;
        cartCountElement.textContent = cartCount;

        // Add bounce animation to cart
        navCart.style.animation = 'none';
        setTimeout(() => {
            navCart.style.animation = 'cartBounce 0.5s ease';
        }, 10);
    });
});

// Add cart bounce animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes cartBounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.3); }
    }
`;
document.head.appendChild(style);

// Add hover effect to featured cards
const featuredCards = document.querySelectorAll('.featured-card');

featuredCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });
});

// Intersection Observer for better performance on reveal animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
            // Optionally unobserve after animation
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe all reveal elements
revealElements.forEach(element => {
    observer.observe(element);
});


// Cursor effect on product cards
productCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

// Add transition to product cards
productCards.forEach(card => {
    card.style.transition = 'transform 0.3s ease';
});

// Hero Video to Gradient Transition
const heroVideo = document.querySelector('.hero-video');
const heroGradient = document.querySelector('.hero-gradient');
const heroOverlay = document.querySelector('.hero-overlay');
const heroSection = document.querySelector('.hero');

if (heroVideo && heroGradient && heroOverlay && heroSection) {
    heroVideo.addEventListener('ended', () => {
        // Fade out video and overlay
        heroVideo.classList.add('fade-out');
        heroOverlay.classList.add('fade-out');

        // Fade in gradient
        heroGradient.classList.add('visible');

        // Change text colors to gradient mode
        heroSection.classList.add('gradient-mode');
    });
}

// Loading animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
});

// Console log for developers
console.log('%c Legado San José ', 'background: #F5A84F; color: #fff; font-size: 20px; padding: 10px;');
console.log('%c Tienda de Merch Oficial ', 'background: #64401B; color: #fff; font-size: 12px; padding: 5px;');
