// Enhanced Portfolio Features
document.addEventListener('DOMContentLoaded', () => {
    initAnimations();
    initMatrixRain();
    initCommandPalette();
    initParticles();
    initEasterEggs();
    initTypingEffect();
    initSmoothScrolling();
    initAPOD();
    initVisitorInfo();
});

// Fade in sections on scroll with stagger
function initAnimations() {
    const sections = document.querySelectorAll('section');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 50);
            }
        });
    }, { threshold: 0.1 });
    
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
}

// Matrix rain background effect
function initMatrixRain() {
    const canvas = document.createElement('canvas');
    canvas.id = 'matrix-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '0';
    canvas.style.opacity = '0.05';
    canvas.style.pointerEvents = 'none';
    document.body.prepend(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);
    
    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#c45a1a';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < drops.length; i++) {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);
            
            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    
    setInterval(draw, 50);
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Command Palette (Ctrl+K)
function initCommandPalette() {
    let palette = null;
    
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            togglePalette();
        }
        if (e.key === 'Escape' && palette) {
            closePalette();
        }
    });
    
    function togglePalette() {
        if (palette) {
            closePalette();
        } else {
            openPalette();
        }
    }
    
    function openPalette() {
        palette = document.createElement('div');
        palette.className = 'command-palette';
        palette.innerHTML = `
            <div class="palette-content">
                <input type="text" placeholder="Type a command... (exp, pubs, skills, proj, etc)" class="palette-input" autofocus>
                <div class="palette-results">
                    <div class="palette-item" data-target="#about">about - About me</div>
                    <div class="palette-item" data-target="#experience">exp - Experience</div>
                    <div class="palette-item" data-target="#publications">pubs - Publications</div>
                    <div class="palette-item" data-target="#education">edu - Education</div>
                    <div class="palette-item" data-target="#skills">skills - Technical Skills</div>
                    <div class="palette-item" data-target="#achievements">wins - Achievements</div>
                    <div class="palette-item" data-target="#projects">proj - Projects</div>
                    <div class="palette-item" data-target="#opensource">oss - Open Source</div>
                    <div class="palette-item" data-target="#blogs">blogs - Blog Posts</div>
                    <div class="palette-item" data-target="#contact">ping - Contact</div>
                </div>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .command-palette {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 10000;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 15vh;
                animation: fadeIn 0.2s ease;
            }
            .palette-content {
                background: #0a0a0a;
                border: 1px solid #c45a1a;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(196, 90, 26, 0.3);
            }
            .palette-input {
                width: 100%;
                padding: 16px 20px;
                background: transparent;
                border: none;
                color: #d0d0d0;
                font-family: 'JetBrains Mono', monospace;
                font-size: 16px;
                outline: none;
                border-bottom: 1px solid #151515;
            }
            .palette-results {
                max-height: 400px;
                overflow-y: auto;
            }
            .palette-item {
                padding: 12px 20px;
                color: #808080;
                cursor: pointer;
                transition: all 0.2s ease;
                border-left: 3px solid transparent;
            }
            .palette-item:hover, .palette-item.selected {
                background: rgba(196, 90, 26, 0.1);
                color: #c45a1a;
                border-left-color: #c45a1a;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(palette);
        
        const input = palette.querySelector('.palette-input');
        const items = palette.querySelectorAll('.palette-item');
        let selectedIndex = 0;
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(query) ? 'block' : 'none';
            });
        });
        
        input.addEventListener('keydown', (e) => {
            const visibleItems = Array.from(items).filter(i => i.style.display !== 'none');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % visibleItems.length;
                updateSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + visibleItems.length) % visibleItems.length;
                updateSelection();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (visibleItems[selectedIndex]) {
                    const target = visibleItems[selectedIndex].dataset.target;
                    document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
                    closePalette();
                }
            }
            
            function updateSelection() {
                items.forEach(i => i.classList.remove('selected'));
                if (visibleItems[selectedIndex]) {
                    visibleItems[selectedIndex].classList.add('selected');
                }
            }
        });
        
        items.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                document.querySelector(target).scrollIntoView({ behavior: 'smooth' });
                closePalette();
            });
        });
        
        palette.addEventListener('click', (e) => {
            if (e.target === palette) closePalette();
        });
    }
    
    function closePalette() {
        if (palette) {
            palette.remove();
            palette = null;
        }
    }
}

// Particle system for accent
function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'particles';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvas.style.pointerEvents = 'none';
    document.body.prepend(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 2
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(196, 90, 26, 0.5)';
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Connect nearby particles
        particles.forEach((p1, i) => {
            particles.slice(i + 1).forEach(p2 => {
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < 100) {
                    ctx.strokeStyle = `rgba(196, 90, 26, ${0.2 * (1 - dist / 100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// Easter eggs
function initEasterEggs() {
    const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;
    
    document.addEventListener('keydown', (e) => {
        if (e.key === konami[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konami.length) {
                triggerKonamiEasterEgg();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    });
    
    function triggerKonamiEasterEgg() {
        document.body.style.animation = 'hue-rotate 2s linear infinite';
        const style = document.createElement('style');
        style.textContent = '@keyframes hue-rotate { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }';
        document.head.appendChild(style);
        
        setTimeout(() => {
            document.body.style.animation = '';
            style.remove();
        }, 5000);
        
        console.log('%c🎮 KONAMI CODE ACTIVATED! 🎮', 'font-size: 20px; color: #c45a1a; font-weight: bold;');
    }
}

// Typing effect for tagline
function initTypingEffect() {
    const tagline = document.querySelector('.tagline');
    if (tagline) {
        const text = tagline.textContent;
        tagline.textContent = '';
        tagline.style.borderRight = '2px solid var(--accent)';
        tagline.style.animation = 'typingCursor 1s steps(1) infinite';
        
        let i = 0;
        function type() {
            if (i < text.length) {
                tagline.textContent += text.charAt(i);
                i++;
                setTimeout(type, 100);
            } else {
                setTimeout(() => {
                    tagline.style.borderRight = 'none';
                }, 500);
            }
        }
        setTimeout(type, 500);
    }
}

// Enhanced smooth scrolling
function initSmoothScrolling() {
    document.querySelectorAll('nav a, .nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                const offset = 80;
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Flash effect on target section
                target.style.filter = 'brightness(1.2)';
                setTimeout(() => {
                    target.style.filter = '';
                }, 300);
            }
        });
    });
    
    // Show scroll progress indicator
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, #c45a1a, #ff7733);
        z-index: 9999;
        transition: width 0.1s ease;
    `;
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const height = document.documentElement.scrollHeight - window.innerHeight;
        const progress = (window.pageYOffset / height) * 100;
        progressBar.style.width = progress + '%';
    });
}

// Visitor Information Widget
function initVisitorInfo() {
    // Detect browser
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';
    
    // Detect OS
    let os = 'Unknown';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';
    
    // Set browser and OS
    const browserEl = document.getElementById('visitor-browser');
    const osEl = document.getElementById('visitor-os');
    if (browserEl) browserEl.textContent = browser;
    if (osEl) osEl.textContent = os;
    
    // Fetch IP and location
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            const ipEl = document.getElementById('visitor-ip');
            const locationEl = document.getElementById('visitor-location');
            if (ipEl) ipEl.textContent = data.ip || 'Hidden';
            if (locationEl) locationEl.textContent = `${data.city || '?'}, ${data.country_code || '?'}`;
        })
        .catch(() => {
            const ipEl = document.getElementById('visitor-ip');
            const locationEl = document.getElementById('visitor-location');
            if (ipEl) ipEl.textContent = '***.***.***';
            if (locationEl) locationEl.textContent = 'VPN Detected';
        });
    
    // Track visits
    let visits = parseInt(localStorage.getItem('portfolio_visits') || '0');
    visits++;
    localStorage.setItem('portfolio_visits', visits.toString());
    const visitsEl = document.getElementById('visitor-visits');
    if (visitsEl) visitsEl.textContent = visits.toString();
    
    // Track time on site
    const startTime = Date.now();
    function updateTime() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeEl = document.getElementById('visitor-time');
        if (timeEl) {
            timeEl.textContent = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        }
    }
    setInterval(updateTime, 1000);
    updateTime();
}

// NASA APOD (Astronomy Picture of the Day)
function initAPOD() {
    const apodContent = document.getElementById('apod-content');
    if (!apodContent) return;
    
    const apiKey = typeof CONFIG !== 'undefined' ? CONFIG.NASA_API_KEY : 'DEMO_KEY';
    const apiUrl = `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`;
    
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            const isVideo = data.media_type === 'video';
            
            apodContent.innerHTML = `
                <div class="apod-image-container">
                    ${isVideo 
                        ? `<iframe src="${data.url}" frameborder="0" allowfullscreen class="apod-video"></iframe>`
                        : `<img src="${data.url}" alt="${data.title}" class="apod-image" loading="lazy">`
                    }
                </div>
                <div class="apod-details">
                    <p class="apod-title">${data.title}</p>
                    <p class="apod-date">${data.date}</p>
                    <p class="apod-explanation">${data.explanation.substring(0, 150)}...</p>
                    <a href="${data.url}" target="_blank" class="apod-link">view full ↗</a>
                </div>
            `;
        })
        .catch(error => {
            console.error('APOD fetch error:', error);
            apodContent.innerHTML = '<p class="fact-text" style="color: #808080;">Failed to load APOD. Check console.</p>';
        });
}
