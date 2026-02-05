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
        if (window.google && window.google.accounts) {
            try {
                this.tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CONFIG.clientId,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            console.log("🔑 Acceso concedido");
                            this.accessToken = tokenResponse.access_token;
                            // Si había una tarea pendiente, la ejecutamos
                            if (this.pendingAction) {
                                this.pendingAction();
                                this.pendingAction = null;
                            }
                        }
                    },
                });
                console.log("✅ Sistema de Login Google: LISTO");
            } catch (error) {
                console.error("⚠️ Error iniciando Google Auth:", error);
            }
        } else {
            console.log("⏳ Esperando librería de Google...");
            // Reintentar en 1 segundo si no ha cargado
            setTimeout(() => this.initGoogleAuth(), 1000);
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

        // 🛡️ SOLUCIÓN AL ERROR DE LA FOTO 2
        // Si tokenClient es null, significa que Google no cargó. Reintentamos forzosamente.
        if (!this.tokenClient) {
            console.warn("⚠️ Google Login no estaba listo. Reintentando inicializar...");
            this.initGoogleAuth();
            
            // Si sigue sin estar listo, mostramos alerta al usuario
            if (!this.tokenClient) {
                alert("⏳ El sistema de seguridad de Google está cargando. Por favor espera 2 segundos y vuelve a intentar.");
                return;
            }
        }

        if (!this.accessToken) {
            this.pendingAction = () => this.runDriveLogic(folderName);
            // Esto abrirá el popup de login
            this.tokenClient.requestAccessToken();
        } else {
            this.runDriveLogic(folderName);
        }
    }

    async runDriveLogic(folderName) {
        const btn = document.getElementById('btn-process-code');
        const originalText = btn ? btn.innerText : 'Procesando';
        if (btn) { btn.innerText = "⏳ Creando..."; btn.disabled = true; }

        const newTab = window.open('', '_blank');
        if (newTab) newTab.document.write('<h1 style="font-family:sans-serif;text-align:center;margin-top:20%">Conectando con Drive...</h1>');

        try {
            // 1. Buscar si existe
            const q = `name = '${folderName}' and '${this.selectedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,webViewLink)`;
            
            const searchRes = await fetch(searchUrl, { 
                headers: { 'Authorization': `Bearer ${this.accessToken}` } 
            });
            const searchData = await searchRes.json();

            let targetLink = null;
            let status = 'created';

            if (searchData.files && searchData.files.length > 0) {
                status = 'exists';
                targetLink = searchData.files[0].webViewLink;
            } else {
                // 2. Crear carpeta
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
                const createData = await createRes.json();
                targetLink = createData.webViewLink;
            }

            if (newTab && targetLink) {
                const color = status === 'created' ? '#28a745' : '#ffc107';
                const title = status === 'created' ? '✅ CARPETA CREADA' : '⚠️ CARPETA EXISTENTE';
                newTab.document.body.innerHTML = `
                    <div style="background:${color};height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;font-family:sans-serif;text-align:center;color:white;">
                        <h1 style="font-size:3rem;">${title}</h1>
                        <h2>${folderName}</h2>
                        <p>Abriendo en Google Drive...</p>
                    </div>`;
                setTimeout(() => newTab.location.href = targetLink, 2000);
            }

            if (this.codeInput) this.codeInput.value = '';
            this.showStep('step-decision');

        } catch (error) {
            console.error(error);
            if (newTab) newTab.close();
            alert("Error: " + error.message);
        } finally {
            if (btn) { btn.innerText = originalText; btn.disabled = false; }
        }
    }
}

// ==========================================
// 3. REPRODUCTOR Y UTILIDADES
// ==========================================
class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('main-player');
        this.rootFolderId = null;
        if (this.videoElement) {
            this.videoElement.onended = () => this.playNextCycle();
            this.videoElement.onerror = () => setTimeout(() => this.playNextCycle(), 2000);
        }
    }

    init(folderId) {
        this.rootFolderId = folderId;
        this.playNextCycle();
    }

    async playNextCycle() {
        try {
            if(this.videoElement) this.videoElement.classList.add('video-fade-out');
            
            const q = `'${this.rootFolderId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${CONFIG.apiKey}&fields=files(id)`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.files && data.files.length > 0) {
                const video = data.files[Math.floor(Math.random() * data.files.length)];
                this.videoElement.src = `https://drive.google.com/uc?export=download&id=${video.id}`;
                await this.videoElement.play();
                this.videoElement.classList.remove('video-fade-out');
            } else {
                // Si no hay videos, reintentamos en 5s
                setTimeout(() => this.playNextCycle(), 5000);
            }
        } catch (error) {
            console.error("Error reproductor:", error);
            setTimeout(() => this.playNextCycle(), 5000);
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