// Mobile Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const overlay = document.getElementById('mobile-menu-overlay');
    const navLinks = document.querySelectorAll('.nav-menu a');

    function toggleMenu() {
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        overlay.classList.toggle('active');

        const isActive = navMenu.classList.contains('active');
        document.body.classList.toggle('no-scroll', isActive);
    }

    menuToggle.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);

    // Close menu when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (navMenu.classList.contains('active')) {
                toggleMenu();
            }
        });
    });

    // Navbar scroll effect (Desktop only)
    window.addEventListener('scroll', () => {
        if (window.innerWidth > 768) {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    // Reveal on Scroll Animation
    function reveal() {
        var reveals = document.querySelectorAll(".reveal");
        for (var i = 0; i < reveals.length; i++) {
            var windowHeight = window.innerHeight;
            var elementTop = reveals[i].getBoundingClientRect().top;
            var elementVisible = 150;
            if (elementTop < windowHeight - elementVisible) {
                reveals[i].classList.add("active");
            }
        }
    }
    window.addEventListener("scroll", reveal);
    reveal(); // Trigger on load

    // Hero Video Fade Effect
    const heroVideo = document.querySelector('.hero-video');
    const heroGradient = document.querySelector('.hero-gradient');
    const heroOverlay = document.querySelector('.hero-overlay');

    if (heroVideo) {
        heroVideo.addEventListener('ended', () => {
            if (heroGradient) heroGradient.classList.add('visible');
            heroVideo.classList.add('fade-out');
            if (heroOverlay) heroOverlay.classList.add('fade-out');
        });
    }
});
