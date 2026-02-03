class TVIPlayer {
    constructor() {
        // --- TUS DATOS CONFIGURADOS ---
        this.cloudName = 'dpgpfeadd';     
        this.tagName = 'modo_tv';   

        this.videoElement = document.getElementById('main-player');
        this.playlist = [];
        this.currentIndex = 0;

        // Binds para no perder el contexto 'this'
        this.handleVideoEnd = this.handleVideoEnd.bind(this);
        this.videoElement.onended = this.handleVideoEnd;
        this.videoElement.onerror = () => {
            console.warn("Error al reproducir video, saltando al siguiente...");
            this.handleVideoEnd();
        };

        this.init();
    }

    async init() {
        console.log("Iniciando TV Clínica San José...");
        await this.loadPlaylist();
        
        // Arrancamos si hay videos
        if (this.playlist.length > 0) {
            this.playVideo(0);
        }
    }

    async loadPlaylist() {
        console.log("🔄 Buscando actualizaciones de lista...");
        
        // Añadimos timestamp para evitar caché
        const listUrl = `https://res.cloudinary.com/${this.cloudName}/video/list/${this.tagName}.json?t=${Date.now()}`;

        try {
            const response = await fetch(listUrl);
            
            if (!response.ok) {
                // Si falla (ej: 404 porque no hay videos aun), no rompemos nada
                console.warn("⚠️ No se pudo cargar la lista JSON. ¿Tal vez no hay videos con esa etiqueta?");
                return;
            }

            const data = await response.json();

            // 1. ORDENAMIENTO (Por nombre)
            data.resources.sort((a, b) => a.public_id.localeCompare(b.public_id));

            // 2. CONSTRUCCIÓN DE URLS ROBUSTA
            const newPlaylist = data.resources.map(video => {
                // TRUCO: Codificamos el public_id por si tiene espacios o tildes
                // Y forzamos la extensión .mp4 al final para máxima compatibilidad
                const safeId = encodeURIComponent(video.public_id); // Espacios -> %20
                
                // Url final forzando formato MP4
                return `https://res.cloudinary.com/${this.cloudName}/video/upload/q_auto/v${video.version}/${video.public_id}.mp4`;
            });

            this.playlist = newPlaylist;
            
            // 3. REPORTE VISUAL EN CONSOLA (Para que veas si los cargó)
            console.group("📺 Lista de Reproducción Actualizada");
            console.table(this.playlist);
            console.groupEnd();

        } catch (error) {
            console.error("❌ Error crítico actualizando playlist:", error);
        }
    }

    playVideo(index) {
        // Validación de seguridad
        if (this.playlist.length === 0) return;

        // Establecer índice actual
        this.currentIndex = index;
        
        // Cargar fuente
        this.videoElement.src = this.playlist[this.currentIndex];
        
        // Intentar reproducir
        const playPromise = this.videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("Autoplay bloqueado o error de carga. Interactúa con la pantalla si es la primera vez.", error);
            });
        }
    }

    async handleVideoEnd() {
        const nextIndex = this.currentIndex + 1;

        // Si llegamos al final de la lista
        if (nextIndex >= this.playlist.length) {
            console.log("Ciclo terminado. Verificando si hay videos nuevos...");
            
            // Intentamos recargar la lista antes de volver a empezar
            await this.loadPlaylist();
            
            // Reiniciamos al primero
            this.playVideo(0);
        } else {
            // Pasamos al siguiente
            this.playVideo(nextIndex);
        }
    }
}

// --- FUNCIONES EXTRAS: RELOJ Y CLIMA (ARICA) - NO MODIFICADAS ---

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
        console.error("No se pudo actualizar el clima:", error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new TVIPlayer();

    updateClock();
    setInterval(updateClock, 1000);

    updateWeather();
    setInterval(updateWeather, 1800000);
});