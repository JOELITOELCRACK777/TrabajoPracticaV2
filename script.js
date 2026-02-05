// --- CLASE 1: GESTOR DE MENÚ DE CLÍNICA (Sin cambios, funciona bien) ---
class ClinicManager {
    constructor(playerInstance) {
        this.player = playerInstance;
        this.selectedClinic = null;

        // Elementos del DOM
        this.menuOverlay = document.getElementById('clinic-menu');
        this.stepSelect = document.getElementById('step-select');
        this.stepDecision = document.getElementById('step-decision');
        this.stepAdd = document.getElementById('step-add-content');
        this.stepCode = document.getElementById('step-code');
        this.clinicTitle = document.getElementById('clinic-title-display');
        this.codeInput = document.getElementById('admin-code');
    }

    showStep(elementId) {
        [this.stepSelect, this.stepDecision, this.stepAdd, this.stepCode].forEach(el => el.classList.add('d-none'));
        document.getElementById(elementId).classList.remove('d-none');
    }

    selectClinic(name) {
        this.selectedClinic = name;
        this.clinicTitle.innerText = name;
        this.showStep('step-decision');
    }

    askModify() {
        this.showStep('step-add-content');
    }

    showCodeInput() {
        this.showStep('step-code');
    }

    reset() {
        this.selectedClinic = null;
        this.codeInput.value = '';
        this.showStep('step-select');
    }

    activatePlaylist() {
        console.log(`✅ Activando playlist para: ${this.selectedClinic}`);
        this.menuOverlay.classList.add('slide-up');
        this.player.init();
    }

    async processCode() {
        const rawInput = this.codeInput.value.toUpperCase().trim(); 
        
        if (!rawInput) { 
            alert("⚠️ Por favor escribe los datos.\nFormato: AREA, NUMERO, PRIORIDAD\nEjemplo: M, 43, A"); 
            return; 
        }
        
        const parts = rawInput.split(',').map(s => s.trim());

        if (parts.length !== 3) { 
            alert("⚠️ Formato incorrecto.\nDebe ser: AREA, NUMERO, PRIORIDAD\nEjemplo: M, 101, A"); 
            return; 
        }
        
        const [area, numero, prioridad] = parts;

        if (!['A', 'M', 'B'].includes(prioridad)) { 
            alert("⚠️ La prioridad debe ser A (Alta), M (Media) o B (Baja)."); 
            return; 
        }

        let prefix = 'GEN'; 
        if (this.selectedClinic === 'Clínica San José') prefix = 'CSJ'; // Ajusta según tus nombres reales del HTML
        else if (this.selectedClinic === 'Clínica del Norte') prefix = 'CDN';
        
        const folderCode = `${prefix}${area}${numero}${prioridad}`;
        console.log(`📡 Solicitando carpeta: ${folderCode}`);

        const newTab = window.open('', '_blank');
        if (newTab) {
            newTab.document.write(`<html><head><title>Procesando...</title><style>body{background:#121212;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center}.loader{border:4px solid #333;border-top:4px solid #0dcaf0;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin-bottom:20px}@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style></head><body><div class="loader"></div><h2>Conectando...</h2><p>Gestionando <strong>${folderCode}</strong></p></body></html>`);
        }

        const btn = document.querySelector('#step-code button');
        const originalText = btn.innerText;
        btn.innerText = "⏳ Gestionando...";
        btn.disabled = true;

        try {
            const webhookUrl = 'https://hook.us2.make.com/hbr2lcucdxpbu0iphqyab09cqqfmzvyy'; 

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderName: folderCode,
                    clinicTag: this.selectedClinic || 'GEN'
                })
            });

            const textResponse = await response.text();
            let data;
            try { data = JSON.parse(textResponse); } catch (e) { if(response.ok) { if(newTab) newTab.close(); this.showStep('step-decision'); return; } throw new Error("Error servidor"); }

           if (data && data.driveLink) {
                
                // 1. Preparamos el diseño (Verde por defecto = Nueva)
                let color = "#4caf50"; 
                let symbol = "✓";
                let titulo = "✅ Carpeta Creada";
                let desc = "Redirigiendo a Google Drive...";

                // 2. Si Make nos dice que ya existía (Amarillo)
                if (data.status === 'exists') {
                    color = "#ffc107"; 
                    symbol = "!";
                    titulo = "⚠️ Carpeta Encontrada";
                    desc = "Ya existía. Abriendo carpeta...";
                }

                // 3. Pintamos el HTML en la pestaña que abrimos antes
                if (newTab) {
                    newTab.document.body.innerHTML = `
                        <h1 style='color:${color}; font-size:4rem; margin-bottom:0;'>${symbol}</h1>
                        <h2 style='color:${color}; margin-top:10px;'>${titulo}</h2>
                        <p style='font-size: 1.2rem; font-family: sans-serif; color: #ddd;'>${desc}</p>
                        <div style='margin-top:20px; border-top:1px solid #333; paddingTop:10px; color:#666;'>
                            <small>Espera unos segundos...</small>
                        </div>
                    `;

                    // 4. Esperamos 2 segundos para que se lea el mensaje y REDIRIGIMOS
                    setTimeout(() => {
                        newTab.location.href = data.driveLink;
                    }, 2000);
                }

                this.showStep('step-decision');

            } else {
                // Caso de error: Make respondió pero sin link
                if (newTab) newTab.document.body.innerHTML = "<h2 style='color:orange'>⚠️ Sin Link</h2><p>Carpeta procesada pero no se recibió enlace.</p>";
                this.showStep('step-decision');
            }

        } catch (error) {
            console.error("❌ Error:", error);
            if (newTab) newTab.document.body.innerHTML = `<h2 style='color:red'>Error</h2><p>${error.message}</p>`;
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}


// --- CLASE 2: REPRODUCTOR INTELIGENTE (RADIO LOGIC) ---
class TVIPlayer {
    constructor() {
        // --- CONFIGURACIÓN ---
        this.cloudName = 'dpgpfeadd';     
        this.tagName = 'modo_tv';   

        this.videoElement = document.getElementById('main-player');
        
        // CUBETAS DE CONTENIDO
        this.buckets = {
            A: [], // Alta Prioridad
            M: [], // Media Prioridad
            B: []  // Baja / Relleno (Cola normal)
        };

        // TIMERS (Marcas de tiempo de la última vez que se reprodujo)
        this.lastTimeA = 0; 
        this.lastTimeM = 0; 

        // TIEMPOS DE REGLA (AJUSTADOS) ---
        this.INTERVAL_A = 5 * 60 * 1000;  // 5 Minutos
        this.INTERVAL_M = 8 * 60 * 1000;  // 8 Minutos

        this.isFading = false;

        // MEMORIA (Para no repetir videos seguidos) ---
        this.lastPlayedUrl = null; 
        
        // Binds
        this.handleVideoEnd = this.handleVideoEnd.bind(this);
        this.checkFadeOut = this.checkFadeOut.bind(this);

        // Eventos
        this.videoElement.onended = this.handleVideoEnd;
        this.videoElement.ontimeupdate = this.checkFadeOut;
        this.videoElement.onerror = () => {
            console.warn("⚠️ Error en video, saltando...");
            this.handleVideoEnd(); 
        };
    }

    async init() {
        console.log("🚀 Iniciando Motor TV...");
        this.videoElement.classList.add('video-fade-out');
        
        await this.loadPlaylist();
        
        // Primera reproducción
        this.playNextAlgorithm();
    }

    checkFadeOut() {
        if (!this.videoElement.duration || this.isFading) return;
        const timeLeft = this.videoElement.duration - this.videoElement.currentTime;
        if (timeLeft < 2.5) {
            this.isFading = true;
            this.videoElement.classList.add('video-fade-out');
        }
    }

    async loadPlaylist() {
        console.log("🔄 Descargando y clasificando contenido...");
        const listUrl = `https://res.cloudinary.com/${this.cloudName}/video/list/${this.tagName}.json?t=${Date.now()}`;

        try {
            const response = await fetch(listUrl);
            if (!response.ok) throw new Error("Fallo fetch Cloudinary");
            const data = await response.json();
            
            // LIMPIAR
            this.buckets.A = [];
            this.buckets.M = [];
            this.buckets.B = [];

            // CLASIFICACIÓN INTELIGENTE
            data.resources.forEach(video => {
                const url = `https://res.cloudinary.com/${this.cloudName}/video/upload/q_auto/v${video.version}/${encodeURIComponent(video.public_id)}.mp4`;
                
                // Limpieza de nombre y detección de última letra
                const cleanName = video.public_id.split('/').pop().toUpperCase();
                const lastChar = cleanName.slice(-1); 

                if (lastChar === 'A') {
                    this.buckets.A.push(url);
                } else if (lastChar === 'M') {
                    this.buckets.M.push(url);
                } else {
                    this.buckets.B.push(url);
                }
            });

            console.group("📊 Playlist Cargada");
            console.log(`🔴 Alta (A): ${this.buckets.A.length}`);
            console.log(`🟡 Media (M): ${this.buckets.M.length}`);
            console.log(`🟢 Baja (B): ${this.buckets.B.length}`);
            console.groupEnd();

        } catch (error) {
            console.error("❌ Error cargando playlist:", error);
            setTimeout(() => this.loadPlaylist(), 10000);
        }
    }

    // --- ALGORITMO DE SELECCIÓN ---
    playNextAlgorithm() {
        const now = Date.now();
        let selectedUrl = null;
        let selectedType = '';

        const timeSinceA = now - this.lastTimeA;
        const timeSinceM = now - this.lastTimeM;

        // 1. PRIORIDAD ALTA (A)
        if (this.buckets.A.length > 0 && (this.lastTimeA !== 0 && timeSinceA >= this.INTERVAL_A)) {
            selectedUrl = this.getRandomVideo(this.buckets.A);
            this.lastTimeA = now; 
            selectedType = '🔴 ALTA (A)';
        } 
        // 2. PRIORIDAD MEDIA (M)
        else if (this.buckets.M.length > 0 && (this.lastTimeM !== 0 && timeSinceM >= this.INTERVAL_M)) {
            selectedUrl = this.getRandomVideo(this.buckets.M);
            this.lastTimeM = now; 
            selectedType = '🟡 MEDIA (M)';
        } 
        // 3. COLA NORMAL (B)
        else if (this.buckets.B.length > 0) {
            selectedUrl = this.getRandomVideo(this.buckets.B);
            selectedType = '🟢 BAJA (B)';
            
            if(this.lastTimeA === 0) this.lastTimeA = now; 
            if(this.lastTimeM === 0) this.lastTimeM = now;
        }
        // 4. FALLBACK (Si no hay B, usar lo que haya)
        else {
            if (this.buckets.A.length > 0) {
                 selectedUrl = this.getRandomVideo(this.buckets.A);
                 selectedType = '🔴 ALTA (Fallback)';
            } else if (this.buckets.M.length > 0) {
                 selectedUrl = this.getRandomVideo(this.buckets.M);
                 selectedType = '🟡 MEDIA (Fallback)';
            }
        }

        if (selectedUrl) {
            console.log(`▶ Reproduciendo: ${selectedType} | ${selectedUrl.split('/').pop()}`);
            this.playVideoFile(selectedUrl);
        } else {
            console.warn("⚠️ ALERTA: No hay videos disponibles.");
            setTimeout(() => this.playNextAlgorithm(), 5000);
        }
    }

    // --- 🎲 SELECCIÓN ALEATORIA SIN REPETICIÓN ---
    getRandomVideo(array) {
        if (!array || array.length === 0) return null;
        
        // Si solo hay 1 video, no queda otra que repetir
        if (array.length === 1) return array[0];

        let selected;
        // Intentar buscar uno nuevo hasta que sea diferente al anterior
        // (Máximo de intentos implícito por estadística, pero seguro con >1 video)
        do {
            const randomIndex = Math.floor(Math.random() * array.length);
            selected = array[randomIndex];
        } while (selected === this.lastPlayedUrl);

        return selected;
    }

    playVideoFile(url) {
        // Guardamos este video en la memoria para no repetir el mismo inmediatamente
        this.lastPlayedUrl = url;

        this.videoElement.classList.add('video-fade-out');
        this.isFading = false;
        this.videoElement.src = url;

        const playPromise = this.videoElement.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                setTimeout(() => {
                    this.videoElement.classList.remove('video-fade-out');
                }, 100);
            }).catch(e => {
                console.error("Autoplay error:", e);
                setTimeout(() => this.handleVideoEnd(), 2000);
            });
        }
    }

    handleVideoEnd() {
        console.log("⏹️ Video terminado.");
        this.videoElement.classList.add('video-fade-out');
        this.isFading = true;

        setTimeout(() => {
            this.playNextAlgorithm();
        }, 1500); 
    }
}

// --- UTILIDADES ---
function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('hora');
    const dateEl = document.getElementById('fecha');
    
    if(timeEl) timeEl.innerText = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
}

async function updateWeather() {
    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-18.47&longitude=-70.30&current_weather=true');
        const data = await response.json();
        if (data.current_weather) {
            const tempEl = document.getElementById('temperatura');
            if(tempEl) tempEl.innerText = `${Math.round(data.current_weather.temperature)}°C`;
        }
    } catch (e) { console.error("Clima off"); }
}

// --- ARRANQUE ---
const player = new TVIPlayer();
const clinicManager = new ClinicManager(player);
window.clinicManager = clinicManager; // Exponer al HTML

window.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    updateWeather();
    setInterval(updateWeather, 1800000); // 30 min
});