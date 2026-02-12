const CONFIG = {
    apiKey: 'AIzaSyA4zAEI5Y4HR5N00DYuZp4vr5FfnXI_LDI', 

    clientId: '994191676825-fohd1rt8hfrq7ff1b2u2jr8pj8jhafca.apps.googleusercontent.com',

    masterFolderId: '1p1kQo3-Yu4NuII1DDCZlN2HGEy_VUaxH' 
};

class ClinicManager {
    constructor(playerInstance) {
        this.player = playerInstance;
        
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        this.accessToken = null;
        this.tokenClient = null;

        this.allFolders = [];

        this.containerClinics = document.getElementById('clinics-container');
        this.menuOverlay = document.getElementById('clinic-menu');
        this.clinicTitle = document.getElementById('clinic-title-display');

        this.initGoogleAuth();  
    }

    forceLogin() {
        console.warn("🔄 Token expirado. Solicitando nuevo inicio de sesión...");
        localStorage.removeItem('google_access_token');
        this.accessToken = null;
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken(); 
        }
    }

    renderLoginScreen() {
        if (!this.containerClinics) return;

        this.containerClinics.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center mt-5">
                <h4 class="text-white mb-4">Bienvenido</h4>
                <p class="text-white-50 mb-4 text-center small">Inicia sesión para acceder a tus carpetas.</p>
                <button id="btn-login-drive" class="btn btn-primary btn-lg shadow-sm">
                    🔐 Conectar con Google Drive
                </button>
            </div>
        `;

        document.getElementById('btn-login-drive').onclick = () => {
            if (this.tokenClient) {
                this.tokenClient.requestAccessToken();
            }
        };
    }

    initGoogleAuth() {
        if (window.google && window.google.accounts) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.clientId,
                scope: 'https://www.googleapis.com/auth/drive',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        this.accessToken = tokenResponse.access_token;
                        localStorage.setItem('google_access_token', tokenResponse.access_token);
                        
                        if(document.getElementById('step-dashboard') && !document.getElementById('step-dashboard').classList.contains('d-none')){
                            this.loadDashboard();
                        } else {
                            this.loadClinicsFromDrive();
                        }
                    }
                },
            });
        } else {
            setTimeout(() => this.initGoogleAuth(), 1000);
            return;
        }

        const savedToken = localStorage.getItem('google_access_token');
        
        if (savedToken) {
            console.log("✅ Token detectado. Intentando cargar...");
            this.accessToken = savedToken;
            this.loadClinicsFromDrive(); 
        } else {
            console.warn("🔒 Sin sesión. Mostrando login.");
            this.renderLoginScreen();
        }
    }

    async loadClinicsFromDrive() {
        try {
            const q = `'${CONFIG.masterFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&key=${CONFIG.apiKey}`;
            
            const headers = this.accessToken ? { 'Authorization': `Bearer ${this.accessToken}` } : {};

            const response = await fetch(url, { headers });

            if (response.status === 401 || response.status === 403) {
                console.warn("🚫 Token vencido o inválido. Volviendo al login...");
                localStorage.removeItem('google_access_token'); 
                this.accessToken = null;
                this.renderLoginScreen(); 
                return; 
            }

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
            } else if (data.error) {
                console.error("Error API:", data.error);
            }

        } catch (error) { 
            console.error("Error cargando clínicas", error);
            if(this.containerClinics) this.containerClinics.innerHTML = '<div class="text-danger">Error de conexión</div>';
        }
    }

    selectClinic(name, id) {
        this.selectedClinicName = name;
        this.selectedFolderId = id;
        if (this.clinicTitle) this.clinicTitle.innerText = name;
        this.showStep('step-decision');
    }

    showStep(stepId) {
        ['step-select', 'step-decision', 'step-dashboard'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('d-none');
        });
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

    renderFolderList(filesToRender) {
        const listContainer = document.getElementById('folders-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (!filesToRender || filesToRender.length === 0) {
            listContainer.innerHTML = '<div class="text-white-50 text-center small mt-3">No se encontraron carpetas.</div>';
            return;
        }

        filesToRender.forEach(folder => {
            const lastChar = folder.name.slice(-1).toUpperCase();
            let borderClass = 'border-intensity-B';
            if(lastChar === 'A') borderClass = 'border-intensity-A';
            if(lastChar === 'M') borderClass = 'border-intensity-M';

            const div = document.createElement('div');
            // Agregamos un ID único al div para manipularlo visualmente al subir
            div.id = `folder-card-${folder.id}`; 
            div.className = `folder-item ${borderClass} d-flex align-items-center mb-2`; // Agregué mb-2 para separación
            
            // --- EVENTOS DRAG & DROP ---
            // 1. Al entrar con el archivo
            div.addEventListener('dragenter', (e) => {
                e.preventDefault();
                div.classList.add('drag-over');
            });
            // 2. Al moverse sobre la carpeta
            div.addEventListener('dragover', (e) => {
                e.preventDefault(); 
                div.classList.add('drag-over');
            });
            // 3. Al salir (cancelar)
            div.addEventListener('dragleave', (e) => {
                div.classList.remove('drag-over');
            });
            // 4. AL SOLTAR EL ARCHIVO (DROP)
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.classList.remove('drag-over');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    // Llamamos a la función de subida
                    this.handleFileUpload(files[0], folder.id, folder.name);
                }
            });
            // ---------------------------

            div.innerHTML = `
                <div class="me-3">
                    <input class="form-check-input folder-checkbox" type="checkbox" value="${folder.id}" style="transform: scale(1.3); cursor:pointer;">
                </div>

                <div class="flex-grow-1" style="min-width: 0;">
                    <div class="fw-bold text-white small text-truncate pointer-events-none">${folder.name}</div>
                    <span class="ms-2 text-white-50 fst-italic" style="font-size: 0.65rem; opacity: 0.6;">
                            Arrastra tus videos aquí
                    </span>
                    <div class="text-white-50" style="font-size:0.7rem" id="count-${folder.id}">Calculando...</div>
                </div>
                
                <div class="btn-group ms-2" role="group">
                    <button class="btn btn-outline-light btn-sm px-2" onclick="clinicManager.openFolder('${folder.webViewLink}')" title="Ver en Drive">📂</button>
                    <button class="btn btn-outline-warning btn-sm px-2" onclick="clinicManager.editIntensity('${folder.id}', '${folder.name}')" title="Editar Prioridad">✏️</button>
                    <button class="btn btn-outline-danger btn-sm px-2" onclick="clinicManager.deleteFolderById('${folder.id}', '${folder.name}')" title="Eliminar">🗑️</button>
                </div>
            `;
            listContainer.appendChild(div);
            this.countVideos(folder.id);
        });
    }

    async handleFileUpload(file, folderId, folderName) {
        // Validar que sea video
        if (!file.type.startsWith('video/')) {
            alert('⚠️ Solo se permiten archivos de video (MP4, WEBM, etc).');
            return;
        }

        // Referencia visual a la tarjeta
        const card = document.getElementById(`folder-card-${folderId}`);
        const countLabel = document.getElementById(`count-${folderId}`);
        const originalText = countLabel.innerText;

        // Mostrar estado "Subiendo"
        if(card) {
            // Creamos un indicador visual temporal
            const uploadingBadge = document.createElement('div');
            uploadingBadge.className = 'uploading-overlay';
            uploadingBadge.innerText = '⏳ Subiendo 0%...';
            uploadingBadge.id = `upload-badge-${folderId}`;
            card.appendChild(uploadingBadge);
        }

        try {
            console.log(`Iniciando subida de ${file.name} a ${folderName}...`);

            // 1. Preparar Metadata (JSON) + Archivo (Blob)
            const metadata = {
                name: file.name,
                parents: [folderId] // ID de la carpeta destino (¡Clave!)
            };

            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', file);

            // 2. Usar XMLHttpRequest para poder medir el progreso (Fetch no tiene barra de progreso nativa fácil)
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', true);
            xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);

            // Evento de Progreso
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    const badge = document.getElementById(`upload-badge-${folderId}`);
                    if(badge) badge.innerText = `⏳ Subiendo ${percentComplete}%`;
                }
            };

            // Evento Completado
            xhr.onload = () => {
                if (xhr.status === 200) {
                    // Éxito
                    const badge = document.getElementById(`upload-badge-${folderId}`);
                    if(badge) {
                        badge.style.color = '#198754'; // Verde
                        badge.innerText = '✅ ¡Listo!';
                        setTimeout(() => badge.remove(), 2000);
                    }
                    // Actualizar contador
                    this.countVideos(folderId);
                } else {
                    console.error('Error Drive:', xhr.response);
                    alert('Error al subir el video. Revisa la consola.');
                    document.getElementById(`upload-badge-${folderId}`)?.remove();
                }
            };

            xhr.onerror = () => {
                alert('Error de red al subir el video.');
                document.getElementById(`upload-badge-${folderId}`)?.remove();
            };

            // Enviar
            xhr.send(formData);

        } catch (error) {
            console.error(error);
            alert("Ocurrió un error inesperado.");
            document.getElementById(`upload-badge-${folderId}`)?.remove();
        }
    }

    async loadDashboard() {
        if (!this.accessToken) { this.tokenClient.requestAccessToken(); return; }

        this.showStep('step-dashboard');
        this.updatePreview(); 
        
        const listContainer = document.getElementById('folders-list');
        listContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-info small"></div></div>';


        let actionArea = document.getElementById('dashboard-actions-dynamic');
        
        if(!actionArea) {
             actionArea = document.createElement('div');
             actionArea.id = 'dashboard-actions-dynamic';
             actionArea.className = 'mb-3';
             
             actionArea.innerHTML = `
                <div class="input-group mb-2">
                    <span class="input-group-text bg-dark text-white border-secondary">🔍</span>
                    <input type="text" id="folder-search-input" class="form-control bg-dark text-white border-secondary" placeholder="Buscar carpeta (Ej: ODO, PED...)">
                </div>
                <div class="d-grid">
                    <button class="btn btn-success fw-bold shadow-sm" onclick="clinicManager.playSelectedFolders()">
                        ▶ REPRODUCIR SELECCIÓN
                    </button>
                </div>
             `;
             listContainer.parentNode.insertBefore(actionArea, listContainer);

             const searchInput = document.getElementById('folder-search-input');
             
             searchInput.addEventListener('input', (e) => {
                 const text = e.target.value.toUpperCase().trim();
                 
                 if (text === "") {
                     this.renderFolderList(this.allFolders);
                     return;
                 }

                 const filtered = this.allFolders.filter(f => f.name.toUpperCase().includes(text));
                 this.renderFolderList(filtered);
             });
        }

        try {
            const q = `'${this.selectedFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&key=${CONFIG.apiKey}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });

            if (res.status === 401 || res.status === 403) { this.forceLogin(); return; }

            const data = await res.json();
            
            this.allFolders = data.files || [];
            this.allFolders.sort((a, b) => a.name.localeCompare(b.name));

            this.renderFolderList(this.allFolders);

        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<div class="text-danger small text-center">Error de conexión.</div>';
        }
    }

    playSelectedFolders() {
        const checkboxes = document.querySelectorAll('.folder-checkbox:checked');
        
        if (checkboxes.length === 0) {
            alert("⚠️Por favor selecciona al menos una carpeta para armar la playlist.");
            return;
        }

        const selectedIds = Array.from(checkboxes).map(cb => cb.value);

        console.log("Armando playlist con IDs:", selectedIds);
        
        this.menuOverlay.classList.add('slide-up'); 
        this.player.init(this.selectedFolderId, selectedIds); 
    }

    openFolder(link) {
        if(link) window.open(link, '_blank');
    }

    async editIntensity(id, oldName) {
        const baseName = oldName.slice(0, -1); 
        const currentInt = oldName.slice(-1);

        const newInt = prompt(`Cambiar prioridad de "${oldName}"\n\nEscribe A (Alta), M (Media) o B (Baja):`, currentInt);
        
        if (!newInt) return; 
        const letter = newInt.toUpperCase().trim();
        if (!['A', 'M', 'B'].includes(letter)) return alert("⚠️ Letra inválida. Usa solo A, M o B.");
        if (letter === currentInt) return; 

        const newName = baseName + letter;

        try {
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

    updatePreview() {
        const topic = document.getElementById('new-topic').value;
        const idRaw = document.getElementById('new-id').value;
        const intensity = document.querySelector('input[name="intensity-btn"]:checked').value;

        let prefix = "GEN";
        if (this.selectedClinicName) {
            prefix = this.selectedClinicName.replace(/\s+/g, '').substring(0, 3).toUpperCase();
        }

        const id = idRaw.padStart(2, '0');
        const code = `${prefix}${topic}${id}${intensity}`;

        document.getElementById('code-preview').innerText = code;
        return code;
    }

    async createFolderFromUI() {
        const folderName = this.updatePreview();
        const btn = document.querySelector('.creation-panel button');
        if (!btn) { alert('Error interno: botón no encontrado'); return; }
        const originalText = btn.innerText;
        
        btn.innerText = "⏳";
        btn.disabled = true;

        try {
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

            if (res.status === 401) { 
                this.forceLogin(); 
                return; 
            }

            if (res.ok) {
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

    async countVideos(folderId) {
        try {
            const q = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&key=${CONFIG.apiKey}`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
            const data = await res.json();
            
            const countEl = document.getElementById(`count-${folderId}`);
            if(countEl) countEl.innerText = `${data.files ? data.files.length : 0} videos`;
        } catch (e) { }
    }
}

class VideoPlayer {
    constructor() {
    this.videoElement = document.getElementById('main-player');
    this.rootFolderId = null;
    this.fadeStarted = false;
    this.audioFadeStarted = false;
    this.audioFadeInterval = null;
    this.isLoading = false; 
    this.lastFolderId = null;
    
    this.folders = { alta: [], media: [], baja: [] };
    this.shuffledQueues = {}; 
    this.currentObjectUrl = null;

    if (this.videoElement) {
        this.videoElement.onended = () => this.onVideoEnded();
        this.videoElement.onerror = () => {
            console.error("❌ Error de reproducción, recuperando...");
            this.resetFlags();
            setTimeout(() => this.playNextCycle(), 1000);
        };
    }
    this.lastPriorityUpdate = { alta: Date.now(), media: Date.now() };
}

    resetFlags() {
        this.fadeStarted = false;
        this.audioFadeStarted = false;
        this.isLoading = false;
        if (this.audioFadeInterval) {
            clearInterval(this.audioFadeInterval);
            this.audioFadeInterval = null;
        }
        if (this.videoElement) {
            this.videoElement.volume = 1;
        }
    }

    onVideoEnded() {
        if (this.fadeStarted) return;
        this.fadeStarted = true;
        console.log("🌓 Video terminado, iniciando fade-out suave...");
        
        if (!this.audioFadeStarted) {
            this.audioFadeStarted = true;
            this.fadeOutAudio(4); 
        }
        
        this.videoElement.classList.add('video-fade-out');
        
        setTimeout(() => this.playNextCycle(), 4000);
    }

    fadeOutAudio(duration) {
        if (!this.videoElement) return;
        
        if (this.audioFadeInterval) {
            clearInterval(this.audioFadeInterval);
        }
        
        const startVolume = this.videoElement.volume;
        const startTime = Date.now();
        
        this.audioFadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            this.videoElement.volume = startVolume * (1 - easeOut);
            
            if (progress >= 1) {
                clearInterval(this.audioFadeInterval);
                this.audioFadeInterval = null;
                this.videoElement.volume = 0;
            }
        }, 30);
    }

    init(folderId, allowedIds = null) {
        this.rootFolderId = folderId;
        this.allowedFolderIds = allowedIds; 
        this.scanFolders();
    }
    async scanFolders() {
        try {
            const q = `'${this.rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${CONFIG.apiKey}&fields=files(id,name)`;
            const headers = (window.clinicManager && window.clinicManager.accessToken) ? { 'Authorization': `Bearer ${window.clinicManager.accessToken}` } : {};
            const res = await fetch(url, { headers });
            const data = await res.json();

            this.folders = { alta: [], media: [], baja: [] };

            let foldersToProcess = data.files || [];

            if (this.allowedFolderIds && this.allowedFolderIds.length > 0) {
                foldersToProcess = foldersToProcess.filter(f => this.allowedFolderIds.includes(f.id));
                console.log("🎯 Reproduciendo solo selección:", this.allowedFolderIds.length, "carpetas.");
            }

            foldersToProcess.forEach(f => {
                const name = f.name.toUpperCase();
                if (name.endsWith('A')) this.folders.alta.push(f.id);
                else if (name.endsWith('M')) this.folders.media.push(f.id);
                else this.folders.baja.push(f.id);
            });

            console.log("📂 Sistema organizado:", this.folders);
            this.playNextCycle(); 
        } catch (e) {
            console.error("Error scan:", e);
        }
    }

    async playNextCycle() {
    if (this.isLoading) return;
    this.isLoading = true;

    const now = Date.now();
    let targetFolderId = null;

    if (this.folders.alta.length > 0 && (now - this.lastPriorityUpdate.alta >= 300000)) {
        targetFolderId = this.folders.alta[Math.floor(Math.random() * this.folders.alta.length)];
        this.lastPriorityUpdate.alta = now;
    } 
    else if (this.folders.media.length > 0 && (now - this.lastPriorityUpdate.media >= 480000)) {
        targetFolderId = this.folders.media[Math.floor(Math.random() * this.folders.media.length)];
        this.lastPriorityUpdate.media = now;
    } 
    else {
        let pool = [...this.folders.baja];
        if (pool.length === 0) pool = [...this.folders.media, ...this.folders.alta];

        if (pool.length > 1) {
            pool = pool.filter(id => id !== this.lastFolderId);
        }
        
        targetFolderId = pool[Math.floor(Math.random() * pool.length)];
    }

    this.lastFolderId = targetFolderId;

    if (targetFolderId) {
        this.loadVideoFromFolder(targetFolderId);
    } else {
        this.isLoading = false;
    }
    }

    async loadVideoFromFolder(folderId) {
        try {
            if (!this.shuffledQueues[folderId] || this.shuffledQueues[folderId].length === 0) {
                const q = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
                const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${CONFIG.apiKey}&fields=files(id,name)`;
                const headers = (window.clinicManager && window.clinicManager.accessToken) ? { 'Authorization': `Bearer ${window.clinicManager.accessToken}` } : {};
                const res = await fetch(url, { headers });
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
                this.videoElement.classList.add('video-fade-out');

                setTimeout(async () => {
                    try {
                        this.videoElement.pause();
                        this.videoElement.volume = 1;
                        if (this.currentObjectUrl) {
                            try { URL.revokeObjectURL(this.currentObjectUrl); } catch (e) {}
                            this.currentObjectUrl = null;
                        }

                        this.videoElement.removeAttribute('src');
                        this.videoElement.load();

                        const videoSrc = `https://www.googleapis.com/drive/v3/files/${video.id}?key=${CONFIG.apiKey}&alt=media`;

                        if (window.clinicManager && window.clinicManager.accessToken) {
                            const mediaHeaders = { 'Authorization': `Bearer ${window.clinicManager.accessToken}` };
                            const mediaRes = await fetch(videoSrc, { headers: mediaHeaders });
                            if (mediaRes.ok) {
                                const blob = await mediaRes.blob();
                                const objectUrl = URL.createObjectURL(blob);
                                this.currentObjectUrl = objectUrl;
                                this.videoElement.src = objectUrl;
                            } else {
                                this.videoElement.src = videoSrc;
                            }
                        } else {
                            this.videoElement.src = videoSrc;
                        }
                        
                        await this.videoElement.play();
                        this.videoElement.classList.remove('video-fade-out');
                        console.log(`🎬 Jugando: ${video.name}`);
                    } catch (e) {
                        console.warn("Autoplay bloqueado, reintentando...");
                        await this.videoElement.play().catch(err => console.error("Fallo total play", err));
                        this.videoElement.classList.remove('video-fade-out');
                    } finally {
                        this.resetFlags();
                    }
                }, 200); 
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
    if(dateEl) dateEl.innerText = now.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase();
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