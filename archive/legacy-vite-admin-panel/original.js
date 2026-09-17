/**
 * ArogyaTrack Interactivity & Animations
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 2. Intersection Observer for Fade-Up Animations
    const fadeElements = document.querySelectorAll('.fade-up-element');
    const fadeObserverOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                
                // Add active class to steps flow when it comes into view
                if (entry.target.closest('.how-it-works')) {
                    document.querySelector('.steps-flow').classList.add('active');
                }

                // Unobserve after animating once
                observer.unobserve(entry.target);
            }
        });
    }, fadeObserverOptions);

    fadeElements.forEach(el => fadeObserver.observe(el));

    // 3. Staggered Hero Heading Animation
    const heroHeading = document.querySelector('.hero-heading');
    if (heroHeading) {
        // We preserve the inner HTML structure but wrap text nodes
        // Since we have HTML elements (span, br), we need a customized approach
        
        const originalHTML = heroHeading.innerHTML;
        // Split by words but preserve HTML tags
        // A simple approach is to wrap all child nodes' text contents
        wrapWordsWithSpans(heroHeading);
        
        const words = heroHeading.querySelectorAll('.word-anim');
        words.forEach((word, index) => {
            word.style.animationDelay = `${index * 0.15}s`;
        });
    }

    // Custom function to wrap words in spans for stagger animation
    function wrapWordsWithSpans(element) {
        const nodes = Array.from(element.childNodes);
        element.innerHTML = '';
        
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const words = node.textContent.trim().split(/\s+/);
                if (words.length > 0 && words[0] !== "") {
                    words.forEach((w, i) => {
                        const span = document.createElement('span');
                        span.className = 'word-anim';
                        span.textContent = w + (i < words.length - 1 ? ' ' : '');
                        element.appendChild(span);
                        // Add trailing space node if not last
                        if (i < words.length - 1) {
                            element.appendChild(document.createTextNode(' '));
                        }
                    });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
                // For span.text-gradient
                const clone = node.cloneNode(true);
                clone.style.display = 'inline-block';
                clone.classList.add('word-anim');
                element.appendChild(clone);
            } else if (node.tagName === 'BR') {
                element.appendChild(node.cloneNode());
            }
        });
    }

    // 4. Stat Counter Animation
    const stats = document.querySelectorAll('.stat-number');
    let hasAnimatedStats = false;
    
    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            
            // Format number based on decimal places of original
            const isFloat = end.toString().includes('.');
            const currentVal = progress * (end - start) + start;
            
            obj.innerHTML = isFloat ? currentVal.toFixed(1) : Math.floor(currentVal);
            
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    // Stat section observer
    const statsSection = document.querySelector('.hero-stats');
    if (statsSection) {
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !hasAnimatedStats) {
                    hasAnimatedStats = true;
                    stats.forEach(stat => {
                        const target = parseFloat(stat.getAttribute('data-target'));
                        animateValue(stat, 0, target, 2000);
                    });
                }
            });
        }, { threshold: 0.5 });
        
        statsObserver.observe(statsSection);
    }

    // 5. Setup Marquee infinite scroll dynamically
    // Incase the screen is very wide, we duplicate marquee contents a few more times
    const marqueeContent = document.querySelector('.marquee-content');
    if (marqueeContent) {
        const items = Array.from(marqueeContent.children);
        // Duplicate once more just to be fully safe for ultra-wide screens
        items.forEach(item => {
            const clone = item.cloneNode(true);
            marqueeContent.appendChild(clone);
        });
    }
});
