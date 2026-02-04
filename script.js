class TVIPlayer {
    constructor() {
        // --- DATOS DE CONFIGURACIÓN ---
        this.cloudName = 'dpgpfeadd';     
        this.tagName = 'modo_tv';   

        this.videoElement = document.getElementById('main-player');
        this.playlist = [];
        this.currentIndex = 0;
        this.isFading = false; // Bandera para controlar el desvanecimiento

        // Binds
        this.handleVideoEnd = this.handleVideoEnd.bind(this);
        this.checkFadeOut = this.checkFadeOut.bind(this);

        // --- ASIGNACIÓN DE EVENTOS ---
        this.videoElement.onended = this.handleVideoEnd;
        
        // Evento para detectar cuándo bajar la opacidad (Fade Out)
        this.videoElement.ontimeupdate = this.checkFadeOut;

        // Seguridad: Si hay error, saltamos al siguiente inmediatamente
        this.videoElement.onerror = () => {
            console.warn("⚠️ Error en el video, saltando...");
            this.videoElement.classList.remove('video-fade-out'); // Asegurar visibilidad
            this.handleVideoEnd(); 
        };

        this.init();
    }

    // --- NUEVA FUNCIÓN: Controla el desvanecimiento antes de terminar ---
    checkFadeOut() {
        // Si no hay duración o ya estamos desvaneciendo, no hacemos nada
        if (!this.videoElement.duration || this.isFading) return;

        const timeLeft = this.videoElement.duration - this.videoElement.currentTime;

        // Cuando falten 2.5 segundos, activamos la oscuridad
        if (timeLeft < 2.5) {
            this.isFading = true; // Marcamos que ya empezamos
            this.videoElement.classList.add('video-fade-out');
        }
    }

    async init() {
        console.log("Iniciando TV Clínica San José...");
        
        // Empezamos en negro para una entrada elegante
        this.videoElement.classList.add('video-fade-out');
        
        await this.loadPlaylist();
        
        if (this.playlist.length > 0) {
            this.playVideo(0);
        }
    }

    async loadPlaylist() {
        console.log("🔄 Buscando actualizaciones de lista...");
        const listUrl = `https://res.cloudinary.com/${this.cloudName}/video/list/${this.tagName}.json?t=${Date.now()}`;

        try {
            const response = await fetch(listUrl);
            if (!response.ok) {
                console.warn("⚠️ No se pudo cargar la lista JSON.");
                return;
            }

            const data = await response.json();
            
            // 1. ORDENAMIENTO
            data.resources.sort((a, b) => a.public_id.localeCompare(b.public_id));

            // 2. CONSTRUCCIÓN DE URLS
            const newPlaylist = data.resources.map(video => {
                // Mantenemos tu lógica de codificación
                return `https://res.cloudinary.com/${this.cloudName}/video/upload/q_auto/v${video.version}/${encodeURIComponent(video.public_id)}.mp4`;
            });

            this.playlist = newPlaylist;
            console.group("📺 Lista Actualizada");
            console.table(this.playlist);
            console.groupEnd();

        } catch (error) {
            console.error("❌ Error playlist:", error);
        }
    }

    playVideo(index) {
        if (this.playlist.length === 0) return;

        this.currentIndex = index;
        
        // 1. PREPARACIÓN: Aseguramos pantalla negra antes de cargar el nuevo
        // Esto evita que se vea el frame del video anterior
        this.videoElement.classList.add('video-fade-out');
        this.isFading = false; // Reiniciamos bandera para el nuevo video

        // 2. CARGA
        this.videoElement.src = this.playlist[this.currentIndex];
        
        // 3. REPRODUCCIÓN (Con seguridad anti-pantalla negra)
        const playPromise = this.videoElement.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // ÉXITO: El video ya está corriendo en el motor del navegador.
                    // Esperamos 100ms para asegurar que el buffer tiene imagen y hacemos el Fade In.
                    setTimeout(() => {
                        this.videoElement.classList.remove('video-fade-out');
                    }, 100);
                })
                .catch(error => {
                    console.log("Autoplay bloqueado o error.", error);
                    // SEGURIDAD: Si falla el play, quitamos la oscuridad igual
                    // para que se vea el poster o el error y no quede todo negro.
                    this.videoElement.classList.remove('video-fade-out');
                });
        }
    }

    handleVideoEnd() {
        console.log("⏹️ Video terminado. Esperando 3 segundos...");

        // 1. Forzamos oscuridad (por si el checkFadeOut no se disparó exacto)
        this.videoElement.classList.add('video-fade-out');
        this.isFading = true; // Bloqueamos checks durante la pausa

        // 2. LA PAUSA DE 3 SEGUNDOS
        setTimeout(async () => {
            
            const nextIndex = this.currentIndex + 1;

            if (nextIndex >= this.playlist.length) {
                console.log("Ciclo terminado. Recargando...");
                // Esperamos la recarga antes de dar play
                await this.loadPlaylist(); 
                this.playVideo(0);
            } else {
                this.playVideo(nextIndex);
            }

        }, 3000); // 3000ms = 3 Segundos de pantalla negra
    }
}

// --- FUNCIONES EXTRAS (SIN CAMBIOS) ---

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