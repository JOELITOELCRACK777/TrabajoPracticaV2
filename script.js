// --- CLASE 1: GESTOR DE MENÚ DE CLÍNICA ---
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

    // Navegación entre pasos
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

    // --- ACCIÓN: ACTIVAR REPRODUCTOR ---
    activatePlaylist() {
        console.log(`✅ Activando playlist para: ${this.selectedClinic}`);
        // Animación de salida del menú
        this.menuOverlay.classList.add('slide-up');
        // Iniciamos el reproductor
        this.player.init();
    }

    // --- ACCIÓN: PROCESAR CÓDIGO Y REDIRECCIONAR ---
    async processCode() {
    // 1. OBTENCIÓN Y LIMPIEZA
    const rawInput = this.codeInput.value.toUpperCase().trim(); 
    
    // Validación de vacío
    if (!rawInput) { 
        alert("⚠️ Por favor escribe los datos.\nFormato: AREA, NUMERO, PRIORIDAD\nEjemplo: M, 43, A"); 
        return; 
    }
    
    const parts = rawInput.split(',').map(s => s.trim());

    // Validación de formato (deben ser 3 partes)
    if (parts.length !== 3) { 
        alert("⚠️ Formato incorrecto.\nDebe ser: AREA, NUMERO, PRIORIDAD\nEjemplo: M, 101, A\n(Donde M=Médico, T=Técnico, etc.)"); 
        return; 
    }
    
    const [area, numero, prioridad] = parts;

    // Validación de Prioridad
    if (!['A', 'M', 'B'].includes(prioridad)) { 
        alert("⚠️ La prioridad debe ser A (Alta), M (Media) o B (Baja)."); 
        return; 
    }

    // 2. CONSTRUCCIÓN DEL CÓDIGO (PREFIJO + AREA + NUMERO + PRIORIDAD)
    let prefix = 'GEN'; // Valor por defecto (Evita el error si no hay clínica)
    
    if (this.selectedClinicTag === 'clinica_1') prefix = 'CSJ';
    else if (this.selectedClinicTag === 'clinica_2') prefix = 'CDN';
    else if (this.selectedClinicTag === 'clinica_3') prefix = 'CPD';
    
    // NOTA: He quitado el "else { alert... }" para que no te bloquee si no seleccionaste nada.

    // Aquí se forma el nombre final: Ej. CSJM43A
    const folderCode = `${prefix}${area}${numero}${prioridad}`;
    
    console.log(`📡 Solicitando carpeta: ${folderCode}`);

    // --- ABRIMOS LA PESTAÑA INMEDIATAMENTE (Truco anti-bloqueo) ---
    const newTab = window.open('', '_blank');
    if (newTab) {
        newTab.document.write(`
            <html>
                <head>
                    <title>Procesando...</title>
                    <style>
                        body { background-color: #121212; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                        .loader { border: 4px solid #333; border-top: 4px solid #0dcaf0; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                </head>
                <body>
                    <div class="loader"></div>
                    <h2>Conectando con el servidor...</h2>
                    <p>Gestionando carpeta <strong>${folderCode}</strong></p>
                </body>
            </html>
        `);
    }

    // Feedback en el botón de la web
    const btn = document.querySelector('#step-code button');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Gestionando...";
    btn.disabled = true;

    try {
        const webhookUrl = 'https://hook.us2.make.com/hbr2lcucdxpbu0iphqyab09cqqfmzvyy'; // TU URL

        // Enviamos los datos a Make
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                folderName: folderCode,
                clinicTag: this.selectedClinicTag || 'GEN' // Envía GEN si está vacío
            })
        });

        // Leemos respuesta
        const textResponse = await response.text();
        console.log("📬 Respuesta Make:", textResponse);

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            // Manejo de respuesta exitosa pero sin JSON limpio
            if (response.ok) {
                 if(newTab) {
                     newTab.document.body.innerHTML = `
                        <h1 style='color:#4caf50'>✅ Listo</h1>
                        <p>Carpeta <strong>${folderCode}</strong> procesada.</p>
                        <p>Link no recibido, busca manualmente en Drive.</p>`;
                 }
                 this.showStep('step-decision');
                 return;
            }
            throw new Error("Respuesta ilegible del servidor");
        }

        // --- LÓGICA DE REDIRECCIÓN CON RETRASO (2 SEGUNDOS) ---
        if (data && data.driveLink) {
            
            // Determinamos el mensaje según si existía o es nueva
            let color = "#4caf50"; // Verde
            let titulo = "✅ Carpeta Creada";
            let desc = "Redirigiendo a Google Drive...";

            if (data.status === 'exists') {
                color = "#ffc107"; // Amarillo/Naranja
                titulo = "⚠️ Carpeta Encontrada";
                desc = "Ya existía. Abriendo carpeta...";
            }

            // 1. Mostrar mensaje visual en la pestaña
            if (newTab) {
                newTab.document.body.innerHTML = `
                    <h1 style='color:${color}; font-size:4rem; margin-bottom:0;'>${data.status === 'exists' ? '!' : '✓'}</h1>
                    <h2 style='color:${color}; margin-top:10px;'>${titulo}</h2>
                    <p style='font-size: 1.2rem;'>${desc}</p>
                    <p style='color:#666; margin-top:20px; font-size:0.9rem;'>Espera un momento...</p>
                `;

                // 2. Esperar 2 segundos y redirigir
                setTimeout(() => {
                    newTab.location.href = data.driveLink;
                }, 2000);
            }

            this.showStep('step-decision');
        } else {
            if (newTab) newTab.document.body.innerHTML = "<h2 style='color:orange'>⚠️ Carpeta creada sin Link</h2><p>Revisa Google Drive manualmente.</p>";
            this.showStep('step-decision');
        }

    } catch (error) {
        console.error("❌ Error:", error);
        if (newTab) {
            newTab.document.body.innerHTML = `<h2 style='color:#ff5252'>❌ Error</h2><p>${error.message}</p>`;
        }
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
}


// --- CLASE 2: REPRODUCTOR INTELIGENTE (RADIO LOGIC) ---
class TVIPlayer {
    constructor() {
        // --- DATOS DE CONFIGURACIÓN ---
        this.cloudName = 'dpgpfeadd';     
        this.tagName = 'modo_tv';   

        this.videoElement = document.getElementById('main-player');
        
        // CUBETAS DE CONTENIDO (Buckets)
        this.buckets = {
            A: [], // Alta Intensidad (Cada 10 min)
            M: [], // Media Intensidad (Cada 25 min)
            B: []  // Baja Intensidad (Relleno default)
        };

        // TIMERS (Para saber cuándo fue la última vez)
        this.lastTimeA = 0; // Timestamp milisegundos
        this.lastTimeM = 0; 

        // TIEMPOS DE REGLA (En milisegundos)
        this.INTERVAL_A = 10 * 60 * 1000; // 10 Minutos
        this.INTERVAL_M = 25 * 60 * 1000; // 25 Minutos

        this.isFading = false;
        
        // Binds
        this.handleVideoEnd = this.handleVideoEnd.bind(this);
        this.checkFadeOut = this.checkFadeOut.bind(this);

        // Eventos
        this.videoElement.onended = this.handleVideoEnd;
        this.videoElement.ontimeupdate = this.checkFadeOut;
        this.videoElement.onerror = () => {
            console.warn("⚠️ Error en video, saltando...");
            this.videoElement.classList.remove('video-fade-out');
            this.handleVideoEnd(); 
        };
    }

    // NOTA: init() ya no se llama en el constructor, sino desde el Menú
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
            
            // LIMPIAMOS CUBETAS
            this.buckets.A = [];
            this.buckets.M = [];
            this.buckets.B = [];

            // CLASIFICACIÓN INTELIGENTE
            data.resources.forEach(video => {
                const url = `https://res.cloudinary.com/${this.cloudName}/video/upload/q_auto/v${video.version}/${encodeURIComponent(video.public_id)}.mp4`;
                
                // DETECCIÓN POR ETIQUETA (Asumiendo que Make agrega tags o el nombre contiene '_A_')
                // Como Cloudinary List API devuelve tags limitados en versión gratuita, 
                // usaremos una lógica híbrida basada en el Public ID o Tags si existen.
                // Simulamos: Si el nombre del archivo contiene _A_, _M_, o _B_.
                
                const idUpper = video.public_id.toUpperCase();

                // LOGICA DE CLASIFICACIÓN (Ajustar según cómo Make nombre los archivos)
                if (video.context?.custom?.intensity === 'A' || idUpper.includes('_A_')) {
                    this.buckets.A.push(url);
                } else if (video.context?.custom?.intensity === 'M' || idUpper.includes('_M_')) {
                    this.buckets.M.push(url);
                } else {
                    // Por defecto todo va a Baja si no tiene etiqueta específica
                    this.buckets.B.push(url);
                }
            });

            console.group("📊 Estadísticas de Playlist");
            console.log(`🔴 Alta (10min): ${this.buckets.A.length} videos`);
            console.log(`🟡 Media (25min): ${this.buckets.M.length} videos`);
            console.log(`🟢 Baja (Relleno): ${this.buckets.B.length} videos`);
            console.groupEnd();

        } catch (error) {
            console.error("❌ Error cargando playlist:", error);
        }
    }

    // --- EL CEREBRO DE LA RADIO (ALGORITMO DE SELECCIÓN) ---
    playNextAlgorithm() {
        const now = Date.now();
        let selectedUrl = null;
        let selectedType = '';

        // 1. ¿Toca reproducir ALTA INTENSIDAD? (Pasaron 10 min y hay videos)
        // Nota: Agregamos un pequeño margen de seguridad para la primera vez (lastTimeA = 0)
        // Si lastTimeA es 0, significa que nunca se ha reproducido, así que NO forzamos A al inicio, 
        // dejamos que fluya B primero, O podemos forzarlo. Aquí opto por priorizar B al inicio puro.
        
        const timeSinceA = now - this.lastTimeA;
        const timeSinceM = now - this.lastTimeM;

        // LÓGICA DE PRIORIDAD
        if (this.buckets.A.length > 0 && (this.lastTimeA !== 0 && timeSinceA >= this.INTERVAL_A)) {
            // TOCA VIDEO TIPO A
            selectedUrl = this.getRandomVideo(this.buckets.A);
            this.lastTimeA = now; // Reseteamos contador
            selectedType = '🔴 ALTA';
        } 
        else if (this.buckets.M.length > 0 && (this.lastTimeM !== 0 && timeSinceM >= this.INTERVAL_M)) {
            // TOCA VIDEO TIPO M
            selectedUrl = this.getRandomVideo(this.buckets.M);
            this.lastTimeM = now; // Reseteamos contador
            selectedType = '🟡 MEDIA';
        } 
        else if (this.buckets.B.length > 0) {
            // RELLENO STANDARD (TIPO B)
            selectedUrl = this.getRandomVideo(this.buckets.B);
            selectedType = '🟢 BAJA';
            
            // Inicializar timers si es la primera vez que corre algo
            if(this.lastTimeA === 0) this.lastTimeA = now; 
            if(this.lastTimeM === 0) this.lastTimeM = now;
        }

        if (selectedUrl) {
            console.log(`▶ Reproduciendo: ${selectedType} | ${selectedUrl.split('/').pop()}`);
            this.playVideoFile(selectedUrl);
        } else {
            console.warn("⚠️ No hay videos disponibles en ninguna lista.");
        }
    }

    getRandomVideo(array) {
        if (array.length === 0) return null;
        // Selección totalmente aleatoria (Shuffle simple)
        const randomIndex = Math.floor(Math.random() * array.length);
        return array[randomIndex];
    }

    playVideoFile(url) {
        // Preparación Visual
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
                console.error("Autoplay error", e);
                this.videoElement.classList.remove('video-fade-out');
            });
        }
    }

    handleVideoEnd() {
        console.log("⏹️ Video terminado. Calculando siguiente slot...");
        this.videoElement.classList.add('video-fade-out');
        this.isFading = true;

        setTimeout(() => {
            // EN LUGAR DE INDICE + 1, EJECUTAMOS EL ALGORITMO
            this.playNextAlgorithm();
        }, 3000); 
    }
}

// --- FUNCIONES EXTRAS (CLIMA Y RELOJ) ---
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const horaEl = document.getElementById('hora');
    if(horaEl) horaEl.innerText = timeString;

    const dateOptions = { weekday: 'short', day: 'numeric', month: 'short' };
    const fechaEl = document.getElementById('fecha');
    if(fechaEl) fechaEl.innerText = now.toLocaleDateString('es-CL', dateOptions).replace('.', '').toUpperCase();
}

async function updateWeather() {
    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-18.47&longitude=-70.30&current_weather=true');
        const data = await response.json();
        if (data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const tempEl = document.getElementById('temperatura');
            if(tempEl) tempEl.innerText = `${temp}°C`;
        }
    } catch (error) {
        console.error("Clima Error:", error);
    }
}

// --- INICIALIZACIÓN GLOBAL ---
const player = new TVIPlayer();
const clinicManager = new ClinicManager(player);

// Hacemos clinicManager global para que los botones HTML accedan a él
window.clinicManager = clinicManager;

window.addEventListener('DOMContentLoaded', () => {
    // Ya no iniciamos el player automáticamente
    // new TVIPlayer(); -> SE ELIMINA, ahora lo controla ClinicManager

    updateClock();
    setInterval(updateClock, 1000);

    updateWeather();
    setInterval(updateWeather, 1800000);
});