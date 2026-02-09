// ==========================================
// 1. CONFIGURACIÓN DEL SISTEMA
// ==========================================
const CONFIG = {
    // 🔑 TU API KEY (Debe estar habilitada para Google Drive API)
    apiKey: 'AIzaSyA4zAEI5Y4HR5N00DYuZp4vr5FfnXI_LDI', 

    // 🔑 TU CLIENT ID
    clientId: '994191676825-fohd1rt8hfrq7ff1b2u2jr8pj8jhafca.apps.googleusercontent.com',

    // 📂 ID DE LA CARPETA MAESTRA
    masterFolderId: '1p1kQo3-Yu4NuII1DDCZlN2HGEy_VUaxH' 
};

// ==========================================
// 2. GESTOR DE CLÍNICAS (MENÚ E INTERFAZ)
// ==========================================
// ==========================================
// 2. GESTOR DE CLÍNICAS (ACTUALIZADO DASHBOARD)
// ==========================================
class ClinicManager {
    constructor(playerInstance) {
        this.player = playerInstance;
        
        // Estado
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        this.accessToken = null;
        this.tokenClient = null;

        // Referencias DOM
        this.containerClinics = document.getElementById('clinics-container');
        this.menuOverlay = document.getElementById('clinic-menu');
        this.clinicTitle = document.getElementById('clinic-title-display');

        // Inicializar Auth y Carga
        this.initGoogleAuth(); 
        this.loadClinicsFromDrive(); 
    }

    // --- A. AUTENTICACIÓN GOOGLE (Igual que antes) ---
    initGoogleAuth() {
        const savedToken = localStorage.getItem('google_access_token');
        if (savedToken) { this.accessToken = savedToken; }

        if (window.google && window.google.accounts) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.clientId,
                scope: 'https://www.googleapis.com/auth/drive', // Scope un poco más amplio para borrar
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        localStorage.setItem('google_access_token', tokenResponse.access_token);
                        // Si estábamos en el dashboard, recargar lista
                        if(!document.getElementById('step-dashboard').classList.contains('d-none')){
                            this.loadDashboard();
                        }
                    }
                },
            });
        } else {
            setTimeout(() => this.initGoogleAuth(), 1000);
        }
    }

    // --- B. CARGA INICIAL ---
    async loadClinicsFromDrive() {
        // (Tu lógica original de carga de clínicas se mantiene igual en estructura)
        try {
            const q = `'${CONFIG.masterFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&key=${CONFIG.apiKey}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (this.containerClinics) this.containerClinics.innerHTML = '';
            
            if (data.files) {
                data.files.forEach(folder => {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-clinic btn-lg mb-3 w-100 animate-fade-in';
                    btn.innerText = folder.name;
                    btn.onclick = () => this.selectClinic(folder.name, folder.id);
                    this.containerClinics.appendChild(btn);
                });
            }
        } catch (error) { console.error("Error cargando clínicas", error); }
    }

    // --- C. NAVEGACIÓN ---
    selectClinic(name, id) {
        this.selectedClinicName = name;
        this.selectedFolderId = id;
        if (this.clinicTitle) this.clinicTitle.innerText = name;
        this.showStep('step-decision');
    }

    showStep(stepId) {
        // Ocultar todos los pasos
        ['step-select', 'step-decision', 'step-dashboard'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('d-none');
        });
        // Mostrar el deseado
        const target = document.getElementById(stepId);
        if(target) target.classList.remove('d-none');
    }

    backToDecision() { this.showStep('step-decision'); }

    reset() {
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        this.showStep('step-select');
    }

    activatePlaylist() {
        this.menuOverlay.classList.add('slide-up');
        this.player.init(this.selectedFolderId);
    }

    // ==========================================
    // D. DASHBOARD INTELIGENTE (NUEVO CÓDIGO)
    // ==========================================

    async loadDashboard() {
        if (!this.accessToken) {
            this.tokenClient.requestAccessToken();
            return;
        }

        this.showStep('step-dashboard');
        this.updatePreview(); 
        
        const listContainer = document.getElementById('folders-list');
        listContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-info small"></div></div>';

        try {
            const q = `'${this.selectedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            
            // ACTUALIZACIÓN: Ahora pedimos también 'webViewLink' para poder abrir la carpeta
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&key=${CONFIG.apiKey}`;
            
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
            const data = await res.json();

            listContainer.innerHTML = '';
            
            if (!data.files || data.files.length === 0) {
                listContainer.innerHTML = '<div class="text-white-50 text-center small mt-3">No hay carpetas creadas.</div>';
                return;
            }

            data.files.sort((a, b) => a.name.localeCompare(b.name));

            data.files.forEach(folder => {
                const lastChar = folder.name.slice(-1).toUpperCase();
                let borderClass = 'border-intensity-B';
                if(lastChar === 'A') borderClass = 'border-intensity-A';
                if(lastChar === 'M') borderClass = 'border-intensity-M';

                const div = document.createElement('div');
                div.className = `folder-item ${borderClass}`;
                
                // ACTUALIZACIÓN: Añadidos botones de Drive y Edición
                div.innerHTML = `
                    <div class="d-flex flex-column justify-content-center" style="max-width: 50%;">
                        <div class="fw-bold text-white small text-truncate">${folder.name}</div>
                        <div class="text-white-50" style="font-size:0.7rem" id="count-${folder.id}">Calculando...</div>
                    </div>
                    
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-light btn-sm px-2" onclick="clinicManager.openFolder('${folder.webViewLink}')" title="Abrir en Google Drive">
                            📂
                        </button>
                        <button class="btn btn-outline-warning btn-sm px-2" onclick="clinicManager.editIntensity('${folder.id}', '${folder.name}')" title="Cambiar Intensidad">
                            ✏️
                        </button>
                        <button class="btn btn-outline-danger btn-sm px-2" onclick="clinicManager.deleteFolderById('${folder.id}', '${folder.name}')" title="Eliminar Carpeta">
                            🗑️
                        </button>
                    </div>
                `;
                listContainer.appendChild(div);
                
                this.countVideos(folder.id);
            });

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div class="text-danger small text-center">Error de conexión.</div>';
        }
    }

    openFolder(link) {
        if(link) window.open(link, '_blank');
    }

    // 2. Editar Intensidad (Renombrar)
    async editIntensity(id, oldName) {
        // Obtenemos la base del nombre (Todo menos la última letra)
        const baseName = oldName.slice(0, -1); 
        const currentInt = oldName.slice(-1);

        // Pedimos la nueva letra
        const newInt = prompt(`Cambiar prioridad de "${oldName}"\n\nEscribe A (Alta), M (Media) o B (Baja):`, currentInt);
        
        // Validación básica
        if (!newInt) return; // Cancelado
        const letter = newInt.toUpperCase().trim();
        if (!['A', 'M', 'B'].includes(letter)) return alert("⚠️ Letra inválida. Usa solo A, M o B.");
        if (letter === currentInt) return; // Es la misma

        const newName = baseName + letter;

        // Llamada a la API para renombrar
        try {
            // UI Feedback visual rápido (opcional, pero mejora UX)
            document.body.style.cursor = 'wait';
            
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newName })
            });

            if (res.ok) {
                // Recargamos el dashboard para ver el cambio
                await this.loadDashboard();
            } else {
                alert("Error al renombrar en Drive.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión.");
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    // Generador de Código en Tiempo Real
    updatePreview() {
        const topic = document.getElementById('new-topic').value;
        const idRaw = document.getElementById('new-id').value;
        const intensity = document.querySelector('input[name="intensity-btn"]:checked').value;

        // Prefijo: Primeras 3 letras de la clínica (o GEN si falla)
        let prefix = "GEN";
        if (this.selectedClinicName) {
            // Elimina espacios y coge 3 letras mayúsculas
            prefix = this.selectedClinicName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
        }

        const id = idRaw.padStart(2, '0'); // "1" -> "01"
        const code = `${prefix}${topic}${id}${intensity}`;

        document.getElementById('code-preview').innerText = code;
        return code;
    }

    // Crear Carpeta (API)
    async createFolderFromUI() {
        const folderName = this.updatePreview();
        const btn = document.querySelector('.creation-panel button');
        const originalText = btn.innerText;
        
        btn.innerText = "⏳";
        btn.disabled = true;

        try {
            // 1. Crear
            const res = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [this.selectedFolderId]
                })
            });

            if (res.ok) {
                // Recargar lista y limpiar ID
                await this.loadDashboard();
                document.getElementById('new-id').value = ""; 
                this.updatePreview(); 
            } else {
                alert("Error al crear. Verifica permisos.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de red.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }

    // Eliminar Carpeta (API)
    async deleteFolderById(folderId, name) {
        if(!confirm(`¿Eliminar carpeta "${name}" y sus videos?`)) return;

        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ trashed: true })
            });
            
            if(res.ok) this.loadDashboard();
        } catch (e) { console.error(e); }
    }

    // Helper: Contar videos para mostrar en dashboard
    async countVideos(folderId) {
        try {
            const q = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&key=${CONFIG.apiKey}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
            const data = await res.json();
            
            const countEl = document.getElementById(`count-${folderId}`);
            if(countEl) countEl.innerText = `${data.files ? data.files.length : 0} videos`;
        } catch (e) { /* silent fail */ }
    }
}

// ==========================================
// 3. REPRODUCTOR Y UTILIDADES
// ==========================================
class VideoPlayer {
    constructor() {
    this.videoElement = document.getElementById('main-player');
    this.rootFolderId = null;
    this.fadeStarted = false;
    this.isLoading = false; 
    this.lastFolderId = null;
    
    this.folders = { alta: [], media: [], baja: [] };
    this.shuffledQueues = {}; 

    if (this.videoElement) {
        this.videoElement.ontimeupdate = () => this.checkVideoTime();
        // Si el video falla, desbloqueamos y saltamos al siguiente
        this.videoElement.onerror = () => {
            console.error("❌ Error de reproducción, recuperando...");
            this.resetFlags();
            setTimeout(() => this.playNextCycle(), 1000);
        };
    }
    this.lastPriorityUpdate = { alta: Date.now(), media: Date.now() };
}

// Función auxiliar para limpiar estados
resetFlags() {
    this.fadeStarted = false;
    this.isLoading = false;
}

    checkVideoTime() {
        if (!this.videoElement || !this.videoElement.duration) return;

        const triggerTime = 2.5; // 2 segundos antes del final
        const timeLeft = this.videoElement.duration - this.videoElement.currentTime;

        // Si falta poco y no hemos iniciado la transición
        if (timeLeft <= triggerTime && !this.fadeStarted) {
        this.fadeStarted = true;
        console.log("🌓 Iniciando transición anticipada...");
        
        // Iniciamos el fundido negro inmediatamente
        this.videoElement.classList.add('video-fade-out');
        
        // Ejecutamos la carga del siguiente
        this.playNextCycle(); 
    }
    }

    init(folderId) {
        this.rootFolderId = folderId;
        this.scanFolders();
    }

    async scanFolders() {
        try {
            const q = `'${this.rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${CONFIG.apiKey}&fields=files(id,name)`;
            const res = await fetch(url);
            const data = await res.json();

            this.folders = { alta: [], media: [], baja: [] };
            data.files.forEach(f => {
                const name = f.name.toUpperCase();
                if (name.endsWith('A')) this.folders.alta.push(f.id);
                else if (name.endsWith('M')) this.folders.media.push(f.id);
                else this.folders.baja.push(f.id);
            });

            console.log("📂 Sistema organizado:", this.folders);
            this.playNextCycle();
        } catch (e) { console.error("Error scan:", e); }
    }

    async playNextCycle() {
    // Si ya estamos cargando un video, ignoramos cualquier otra orden
    if (this.isLoading) return;
    this.isLoading = true;

    const now = Date.now();
    let targetFolderId = null;

    // 1. Lógica de Intensidad A (5 min)
    if (this.folders.alta.length > 0 && (now - this.lastPriorityUpdate.alta >= 300000)) {
        targetFolderId = this.folders.alta[Math.floor(Math.random() * this.folders.alta.length)];
        this.lastPriorityUpdate.alta = now;
    } 
    // 2. Lógica de Intensidad M (8 min)
    else if (this.folders.media.length > 0 && (now - this.lastPriorityUpdate.media >= 480000)) {
        targetFolderId = this.folders.media[Math.floor(Math.random() * this.folders.media.length)];
        this.lastPriorityUpdate.media = now;
    } 
    // 3. Reproducción Normal
    else {
        let pool = [...this.folders.baja];
        if (pool.length === 0) pool = [...this.folders.media, ...this.folders.alta];

        // 🛡️ EVITAR REPETIR CARPETA:
        // Si hay más de una carpeta disponible, filtramos la que acabamos de usar
        if (pool.length > 1) {
            pool = pool.filter(id => id !== this.lastFolderId);
        }
        
        targetFolderId = pool[Math.floor(Math.random() * pool.length)];
    }

    this.lastFolderId = targetFolderId; // Recordamos esta carpeta para la próxima

    if (targetFolderId) {
        this.loadVideoFromFolder(targetFolderId);
    } else {
        this.isLoading = false;
    }
}

    async loadVideoFromFolder(folderId) {
    try {
        // 1. Preparar la cola de la carpeta
        if (!this.shuffledQueues[folderId] || this.shuffledQueues[folderId].length === 0) {
            const q = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${CONFIG.apiKey}&fields=files(id,name)`;
            const res = await fetch(url);
            const data = await res.json();

            if (!data.files || data.files.length === 0) {
                this.resetFlags();
                return this.playNextCycle();
            }

            let videos = [...data.files];
            for (let i = videos.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [videos[i], videos[j]] = [videos[j], videos[i]];
            }
            this.shuffledQueues[folderId] = videos;
        }

        const video = this.shuffledQueues[folderId].shift();

        if (this.videoElement) {
            // Reforzamos el fade out
            this.videoElement.classList.add('video-fade-out');

            setTimeout(async () => {
                try {
                    // Limpieza agresiva del video anterior
                    this.videoElement.pause();
                    this.videoElement.removeAttribute('src'); 
                    this.videoElement.load();

                    const videoSrc = `https://www.googleapis.com/drive/v3/files/${video.id}?key=${CONFIG.apiKey}&alt=media`;
                    this.videoElement.src = videoSrc;
                    
                    await this.videoElement.play();
                    this.videoElement.classList.remove('video-fade-out');
                    console.log(`🎬 Jugando: ${video.name}`);
                } catch (e) {
                    console.warn("Autoplay bloqueado, reintentando con mute...");
                    this.videoElement.muted = true;
                    await this.videoElement.play().catch(err => console.error("Fallo total play", err));
                    this.videoElement.classList.remove('video-fade-out');
                } finally {
                    // PASE LO QUE PASE, desbloqueamos para el siguiente video
                    this.resetFlags();
                }
            }, 1000); 
        }
    } catch (error) {
        console.error("Error en carga:", error);
        this.resetFlags();
        if(this.videoElement) this.videoElement.classList.remove('video-fade-out');
        setTimeout(() => this.playNextCycle(), 3000);
    }
}
}

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

document.addEventListener('DOMContentLoaded', () => {
    updateClock(); setInterval(updateClock, 1000);
    updateWeather(); setInterval(updateWeather, 1800000);
    window.clinicManager = new ClinicManager(new VideoPlayer()); 
});