// --- Scroll Animations (Intersection Observer) ---
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

document.querySelectorAll('.animate-on-scroll').forEach(section => {
    observer.observe(section);
});


// --- Session Timer Info ---
const timeSpan = document.getElementById('time-here');
let seconds = 0;
setInterval(() => {
    seconds++;
    if (timeSpan) timeSpan.innerText = `${seconds}s`;
}, 1000);

// Basic OS / Browser detection
const userAgent = navigator.userAgent;
const osSpan = document.getElementById('os-info');
const browserSpan = document.getElementById('browser-info');

if (osSpan) {
    if (userAgent.indexOf("Win") !== -1) osSpan.innerText = "Windows";
    else if (userAgent.indexOf("Mac") !== -1) osSpan.innerText = "macOS";
    else if (userAgent.indexOf("Linux") !== -1) osSpan.innerText = "Linux";
}

if (browserSpan) {
    if (userAgent.indexOf("Firefox") !== -1) browserSpan.innerText = "Firefox";
    else if (userAgent.indexOf("Chrome") !== -1) browserSpan.innerText = "Chrome";
    else if (userAgent.indexOf("Safari") !== -1) browserSpan.innerText = "Safari";
}

// --- Audio Control System ---
const audio = document.getElementById('bg-audio');
const toggleBtn = document.getElementById('audio-toggle');
const statusText = document.getElementById('audio-status');

if (audio && toggleBtn && statusText) {
    toggleBtn.addEventListener('click', () => {
        if (audio.muted) {
            audio.muted = false;
            audio.play().then(() => {
                toggleBtn.innerText = '[ MUTE ]';
                statusText.innerText = 'STATUS: PLAYING // SOS.MP3';
                statusText.style.color = 'var(--accent-green)';
            }).catch(err => {
                console.log("Audio play error:", err);
                statusText.innerText = 'PLAYBACK BLOCKED';
                statusText.style.color = 'var(--accent-purple)';
            });
        } else {
            audio.muted = true;
            audio.pause();
            toggleBtn.innerText = '[ PLAY ]';
            statusText.innerText = 'STATUS: MUTED';
            statusText.style.color = 'var(--text-muted)';
        }
    });
}

// --- Random Fact Fetcher ---
const factText = document.getElementById('fact-text');
const refreshBtn = document.getElementById('refresh-fact');

async function fetchFact() {
    if (!factText) return;
    factText.innerText = "fetching new fact...";
    try {
        const response = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
        const data = await response.json();
        factText.innerText = data.text;
    } catch (err) {
        console.error(err);
        factText.innerText = "The only capital letter in the Roman alphabet with exactly one end point is P. (DB Offline)";
    }
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchFact);
}


// --- NASA APOD Fetcher ---
async function fetchAPOD() {
    let apiKey = 'DEMO_KEY';
    try {
        const envResponse = await fetch('/.env');
        if (envResponse.ok) {
            const envText = await envResponse.text();
            const match = envText.match(/NASA_API_KEY\s*=\s*([^\s#]+)/);
            if (match) {
                apiKey = match[1].trim();
            }
        }
    } catch (e) {
        console.warn("Could not fetch .env directly, using fallback.", e);
    }

    try {
        const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`);
        const data = await response.json();
        
        if (data.url) {
            const img = document.getElementById('apod-img');
            if (img) {
                img.src = data.url;
                img.style.display = 'block';
            }
            
            const title = document.getElementById('apod-title');
            if (title) title.innerText = data.title;
            
            const date = document.getElementById('apod-date');
            if (date) date.innerText = data.date;
            
            const descSpan = document.getElementById('apod-desc');
            if (descSpan) {
                const desc = data.explanation;
                descSpan.innerText = desc.substring(0, 100) + '...';
            }
            
            const link = document.getElementById('apod-link');
            if (link) {
                link.href = data.hdurl || data.url;
                link.target = "_blank";
            }
        } else {
            const title = document.getElementById('apod-title');
            if (title) title.innerText = "Rate Limited";
            const descSpan = document.getElementById('apod-desc');
            if (descSpan) descSpan.innerText = "Using DEMO_KEY. Please provide a valid NASA API key.";
        }
    } catch (error) {
        console.error("Failed to fetch APOD", error);
        const title = document.getElementById('apod-title');
        if (title) title.innerText = "Offline";
        const descSpan = document.getElementById('apod-desc');
        if (descSpan) descSpan.innerText = "Could not connect to NASA API.";
    }
}

fetchAPOD();
