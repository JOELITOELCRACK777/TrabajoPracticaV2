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
class ClinicManager {
    constructor(playerInstance) {
        this.player = playerInstance;
        
        // Estado
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        this.accessToken = null;
        this.tokenClient = null;

        // Referencias al DOM
        this.containerClinics = document.getElementById('clinics-container');
        this.menuOverlay = document.getElementById('clinic-menu');
        this.stepSelect = document.getElementById('step-select');
        this.stepDecision = document.getElementById('step-decision');
        this.stepAdd = document.getElementById('step-add-content');
        this.stepCode = document.getElementById('step-code');
        this.clinicTitle = document.getElementById('clinic-title-display');
        this.codeInput = document.getElementById('admin-code');

        // Inicializar
        this.initGoogleAuth(); // Intentamos conectar con Google
        this.loadClinicsFromDrive(); // Cargamos las clínicas
    }

    // --- A. AUTENTICACIÓN GOOGLE (A PRUEBA DE FALLOS) ---
    initGoogleAuth() {
    // 1. Intentar recuperar sesión guardada al abrir el sistema
    const savedToken = localStorage.getItem('google_access_token');
    if (savedToken) {
        this.accessToken = savedToken;
        console.log("Loing: Sesión recuperada automáticamente.");
    }

    if (window.google && window.google.accounts) {
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        
                        // Guardamos el token para que no lo pida al cerrar/abrir
                        localStorage.setItem('google_access_token', tokenResponse.access_token);
                        
                        console.log("🔑 Acceso concedido y guardado");
                        
                        // EJECUCIÓN INMEDIATA:
                        this.checkPendingActions();
                    }
                },
            });
        } catch (error) {
            console.error("⚠️ Error Auth:", error);
        }
    } else {
        setTimeout(() => this.initGoogleAuth(), 1000);
    }
}

    checkPendingActions() {
    const pending = localStorage.getItem('pending_drive_action');
    
    // Solo actuamos si hay algo pendiente Y ya tenemos el token de Google
    if (pending && this.accessToken) {
        try {
            const data = JSON.parse(pending);
            console.log("🔄 Recuperando sesión para:", data.folderName);

            // 1. VITAL: Restauramos los datos de la clínica en la memoria activa
            // Si no hacemos esto, runDriveLogic no sabrá dónde buscar
            this.selectedFolderId = data.folderId;
            this.selectedClinicName = data.clinicName;

            // 2. Limpieza del reproductor
            if (this.videoPlayer) {
                this.videoPlayer.resetFlags(); 
            }

            // 3. Borramos la memoria temporal para no repetir la acción al recargar
            localStorage.removeItem('pending_drive_action');

            // 4. Ejecutamos la lógica de Drive
            this.runDriveLogic(data.folderName);

        } catch (e) {
            console.error("❌ Error al procesar acción pendiente:", e);
            localStorage.removeItem('pending_drive_action');
        }
    }
}

    // --- B. ESCANEO DE CARPETAS ---
    async loadClinicsFromDrive() {
        console.log("📡 Escaneando sistema en Drive...");
        try {
            const q = `'${CONFIG.masterFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&key=${CONFIG.apiKey}`;

            const response = await fetch(url);
            
            // Si la respuesta es 403, es error de permisos
            if (response.status === 403) {
                console.error("⛔ Error 403: La API Key no tiene permisos o la carpeta no es pública.");
                if (this.containerClinics) this.containerClinics.innerHTML = '<p class="text-danger">Error de permisos (403). Revisa la API Key.</p>';
                return;
            }

            const data = await response.json();

            if (this.containerClinics) this.containerClinics.innerHTML = '';

            if (!data.files || data.files.length === 0) {
                if (this.containerClinics) this.containerClinics.innerHTML = '<p class="text-white">No se encontraron clínicas.</p>';
                return;
            }

            // Crear botones
            data.files.forEach(folder => {
                const btn = document.createElement('button');
                btn.className = 'btn btn-clinic btn-lg mb-3 w-100 animate-fade-in';
                btn.innerText = folder.name;
                btn.onclick = () => this.selectClinic(folder.name, folder.id);
                this.containerClinics.appendChild(btn);
            });

        } catch (error) {
            console.error("Error cargando clínicas:", error);
        }
    }

    // --- C. NAVEGACIÓN ---
    selectClinic(name, id) {
        this.selectedClinicName = name;
        this.selectedFolderId = id;
        if (this.clinicTitle) this.clinicTitle.innerText = name;
        this.showStep('step-decision');
    }

    showStep(elementId) {
        [this.stepSelect, this.stepDecision, this.stepAdd, this.stepCode].forEach(el => {
            if (el) el.classList.add('d-none');
        });
        const target = document.getElementById(elementId);
        if (target) target.classList.remove('d-none');
    }

    askModify() { this.showStep('step-add-content'); }
    showCodeInput() { this.showStep('step-code'); }
    
    reset() {
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        if(this.codeInput) this.codeInput.value = '';
        this.showStep('step-select');
    }

    activatePlaylist() {
        this.menuOverlay.classList.add('slide-up');
        this.player.init(this.selectedFolderId);
    }

    // --- D. PROCESAR CÓDIGO (¡AQUÍ ESTABA EL ERROR!) ---
    async processCode() {
        const rawInput = this.codeInput.value.toUpperCase().trim();
        if (!rawInput) return alert("⚠️ Escribe el código. Ej: M, 12, A");
        
        const parts = rawInput.split(',').map(s => s.trim());
        if (parts.length !== 3) return alert("⚠️ Formato incorrecto. Ej: M, 12, A");
        
        const [tema, numero, prioridad] = parts;
        const dynamicPrefix = (this.selectedClinicName || 'GEN').substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const folderName = `${dynamicPrefix}${tema}${numero}${prioridad}`;

        if (!this.tokenClient) {
            console.warn("⚠️ Google Login no estaba listo. Reintentando inicializar...");
            this.initGoogleAuth();
            
            if (!this.tokenClient) {
                alert("⏳ El sistema de seguridad de Google está cargando. Por favor espera 2 segundos y vuelve a intentar.");
                return;
            }
        }

        if (!this.accessToken) {
        // 1. Guardamos la intención en el disco por si la página se refresca
        const stateToSave = {
            folderId: this.selectedFolderId,
            clinicName: this.selectedClinicName,
            folderName: folderName
        };
        localStorage.setItem('pending_drive_action', JSON.stringify(stateToSave));
        
        console.log("💾 Datos guardados en LocalStorage. Pidiendo permiso a Google...");

        // 2. Pedimos el token (esto abrirá el popup o redireccionará)
        this.tokenClient.requestAccessToken();
    } else {
        // Si ya tenemos el token (porque ya iniciaste sesión antes), vamos directo
        this.runDriveLogic(folderName);
    }
}

    async runDriveLogic(folderName) {
    // 1. Verificación de Seguridad: ¿Tenemos token?
    if (!this.accessToken) {
        alert("⚠️ Sesión expirada. Por favor, inicia sesión de nuevo.");
        this.initGoogleAuth();
        return;
    }

    const btn = document.getElementById('btn-process-code');
    const originalText = btn ? btn.innerText : 'Procesando';
    if (btn) { btn.innerText = "⏳ Conectando..."; btn.disabled = true; }

    // Preparamos la pestaña con un diseño de carga más profesional
    const newTab = window.open('', '_blank');
    if (newTab) {
        newTab.document.write(`
            <div id="loader" style="height:100vh;display:flex;justify-content:center;align-items:center;font-family:sans-serif;background:#f4f4f4;">
                <div style="text-align:center;">
                    <div style="border:8px solid #f3f3f3;border-top:8px solid #3498db;border-radius:50%;width:60px;height:60px;animation:spin 2s linear infinite;margin:0 auto;"></div>
                    <h2 style="color:#555;">Conectando con Google Drive...</h2>
                    <p style="color:#888;">Preparando carpeta: ${folderName}</p>
                </div>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>
        `);
    }

    try {
        // 1. Guardar la acción actual como pendiente por si el token falla y necesitamos recargar
        localStorage.setItem('pending_drive_action', JSON.stringify({
            folderName: folderName,
            folderId: this.selectedFolderId,
            clinicName: this.selectedClinicName
        }));

        // 2. Buscar si la carpeta ya existe
        const q = `name = '${folderName}' and '${this.selectedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)`;
        
        const searchRes = await fetch(searchUrl, { 
            headers: { 'Authorization': `Bearer ${this.accessToken}` } 
        });

        // --- VALIDACIÓN DE TOKEN ---
        if (searchRes.status === 401) {
            throw new Error("UNAUTHORIZED");
        }
        // ---------------------------
        
        if (!searchRes.ok) throw new Error("Error en la comunicación con Google");
        
        const searchData = await searchRes.json();
        let targetLink = null;
        let isNew = false;

        if (searchData.files && searchData.files.length > 0) {
            targetLink = searchData.files[0].webViewLink;
        } else {
            // 3. Crear carpeta si no existe
            const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
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

            if (createRes.status === 401) throw new Error("UNAUTHORIZED");
            if (!createRes.ok) throw new Error("Error al crear la carpeta");

            const createData = await createRes.json();
            targetLink = createData.webViewLink;
            isNew = true;
        }

        // 4. Si llegamos aquí, todo salió bien: Borramos la acción pendiente
        localStorage.removeItem('pending_drive_action');

        // 5. Actualizar la pestaña con el resultado
        if (newTab && targetLink) {
            const color = isNew ? '#28a745' : '#ffc107';
            const title = isNew ? '✅ CARPETA CREADA' : '⚠️ CARPETA ENCONTRADA';
            
            newTab.document.body.innerHTML = `
                <div style="background:${color};height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif;text-align:center;color:white;transition: all 0.5s;">
                    <h1 style="font-size:3rem;margin-bottom:0;">${title}</h1>
                    <h2 style="font-weight:300;margin-top:10px;">${folderName}</h2>
                    <p style="background:rgba(0,0,0,0.1);padding:10px 20px;border-radius:20px;">Redirigiendo en segundos...</p>
                </div>`;
            
            setTimeout(() => { newTab.location.href = targetLink; }, 1500);
        }

        if (this.codeInput) this.codeInput.value = '';
        this.showStep('step-decision');

    } catch (error) {
        console.error("❌ Error en Drive Logic:", error);
        
        if (error.message === "UNAUTHORIZED") {
        if (newTab) newTab.close();
        // Ya no hace falta el alert molesto, el botón dirá qué hacer
        this.handleAuthError(); 
        } else {
            if (newTab) newTab.close();
            alert("No se pudo conectar con Drive: " + error.message);
        }
    } finally {
        if (btn) { btn.innerText = originalText; btn.disabled = false; }
    }
}

handleAuthError() {
    localStorage.removeItem('google_access_token');
    this.accessToken = null;
    this.initGoogleAuth(); // Lanza el selector de cuenta de Google
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