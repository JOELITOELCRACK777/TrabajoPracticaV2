const CONFIG = {
    apiKey: 'AIzaSyA4zAEI5Y4HR5N00DYuZp4vr5FfnXI_LDI', 
    clientId: '994191676825-fohd1rt8hfrq7ff1b2u2jr8pj8jhafca.apps.googleusercontent.com',
    masterFolderId: '1p1kQo3-Yu4NuII1DDCZlN2HGEy_VUaxH' 
};


class ScheduleManager {
    constructor() {
        // 1. Cargar datos guardados o iniciar vacío
        this.playlists = JSON.parse(localStorage.getItem('clinic_playlists')) || [];
        this.currentPlaylistId = null; // Para saber qué está sonando ahora

        // 2. Iniciar el "reloj" que revisa la agenda cada 60 segundos
        // Así, si cambia el día a medianoche, la playlist se actualiza sola.
        setInterval(() => this.checkSchedule(), 60000);
    }

    /**
     * Guarda una nueva playlist y verifica si debe activarse ya.
     * @param {string} name - Nombre de la playlist
     * @param {string} start - Fecha inicio (YYYY-MM-DD)
     * @param {string} end - Fecha fin (YYYY-MM-DD)
     * @param {Array} folderIds - Lista de IDs de carpetas seleccionadas
     */
    savePlaylist(name, start, end, folderIds) {
        if (!name || !start || !end || folderIds.length === 0) {
            alert("⚠️ Faltan datos (nombre, fechas o carpetas).");
            return false;
        }

        const newPlaylist = {
            id: Date.now().toString(), // ID único
            name: name,
            start: start,
            end: end,
            folders: folderIds,
            createdAt: new Date().toISOString()
        };

        // Guardamos en la lista y en memoria del navegador
        this.playlists.push(newPlaylist);
        this.persist();

        console.log(`💾 Playlist guardada: ${name} (${folderIds.length} carpetas)`);
        alert("✅ Playlist guardada correctamente. Usa 'Activar' para añadirla a la programación activa.");

        // NO llamamos a checkSchedule() aquí - el usuario debe activar manualmente
        // y luego usar "INICIAR TV" para comenzar la reproducción
        return true;
    }

    /**
     * Borrar una playlist por ID.
     * No se llama a checkSchedule(): la programación activa solo cambia cuando el usuario pulsa "Activar".
     * Si la playlist borrada era la que estaba activa, se limpia la programación activa.
     */
    deletePlaylist(id) {
        const wasActive = (() => {
            try {
                const raw = localStorage.getItem('activeScheduleData');
                return raw && JSON.parse(raw).id === id;
            } catch (e) { return false; }
        })();
        this.playlists = this.playlists.filter(p => p.id !== id);
        this.persist();
        if (wasActive) {
            localStorage.removeItem('activeScheduleData');
            window.currentPlaylistSelection = [];
            const scheduleList = document.getElementById('schedule-list');
            if (scheduleList) {
                scheduleList.innerHTML = '<div class="text-center text-muted py-4 small">No hay programación definida.</div>';
            }
        }
    }

    loadPlaylist(id) {
        if (!id) return; // Si eligió "-- Seleccionar --" no hacemos nada

        // 1. Buscar la playlist en la memoria
        const playlist = this.playlists.find(p => p.id === id);
        
        if (!playlist) {
            alert("Error: No se encontró la playlist.");
            return;
        }

        // 2. Rellenar los campos visuales
        document.getElementById('playlist-name-input').value = playlist.name;
        document.getElementById('date-start').value = playlist.start;
        document.getElementById('date-end').value = playlist.end;

        // 3. (Opcional) Si quieres que también marque los checkboxes de las carpetas:
        // Primero desmarcamos todo
        document.querySelectorAll('.folder-checkbox').forEach(cb => cb.checked = false);
        
        // Marcamos los que están en la playlist
        playlist.folders.forEach(folderId => {
            const checkbox = document.querySelector(`.folder-checkbox[value="${folderId}"]`);
            if (checkbox) checkbox.checked = true;
        });

        // Actualizamos el contador visual si existe la función
        if (typeof openScheduleManager === 'function') {
             // Esto es un truco para refrescar la vista de "seleccionados"
             // Simplemente actualizamos la variable global
             window.currentPlaylistSelection = playlist.folders;
             const badge = document.getElementById('selected-count-badge');
             if(badge) badge.innerText = `${playlist.folders.length} carpetas (Cargado)`;
        }

        alert(`📂 Playlist "${playlist.name}" cargada en el editor.`);
    }

    /**
     * Guardar en LocalStorage (para que no se borre al cerrar la ventana)
     */
    persist() {
        localStorage.setItem('clinic_playlists', JSON.stringify(this.playlists));
    }

    /**
     * EL CEREBRO: Revisa qué playlist está activa hoy (solo actualiza UI, NO inicia reproducción)
     * La reproducción solo se inicia cuando el usuario presiona "INICIAR TV"
     */
    checkSchedule() {
        // Obtenemos la fecha de hoy en formato YYYY-MM-DD (igual que los inputs HTML)
        const today = new Date().toISOString().split('T')[0];

        // Buscamos si hay alguna playlist activa para hoy
        // Lógica: Hoy debe ser mayor/igual al Inicio Y menor/igual al Fin
        const activePlaylist = this.playlists.find(p => 
            today >= p.start && today <= p.end
        );

        // Referencia al manager (asegurándonos de que existe)
        const manager = window.clinicManager;
        if (!manager) return;

        // CASO A: Hay una playlist activa hoy
        if (activePlaylist) {
            // Solo actuamos si la playlist activa es DIFERENTE a la que ya está configurada
            if (this.currentPlaylistId !== activePlaylist.id) {
                console.log(`📅 Playlist activa detectada: ${activePlaylist.name}`);
                
                this.currentPlaylistId = activePlaylist.id;

                // Actualizamos la selección global para que "INICIAR TV" la use
                window.currentPlaylistSelection = activePlaylist.folders;

                // Actualizamos la UI de programación activa si estamos en la pantalla de playlist
                const activeScheduleData = localStorage.getItem('activeScheduleData');
                if (!activeScheduleData || JSON.parse(activeScheduleData).id !== activePlaylist.id) {
                    // Solo actualizamos si no está ya cargada o es diferente
                    localStorage.setItem('activeScheduleData', JSON.stringify(activePlaylist));
                    if (typeof cargarProgramacionVisual === 'function') {
                        cargarProgramacionVisual(activePlaylist);
                    }
                }
                
                this.updateUIStatus(`Modo Playlist: ${activePlaylist.name}`);
            }
        } 
        // CASO B: No hay nada programado hoy
        else {
            if (this.currentPlaylistId !== 'DEFAULT') {
                console.log("📅 Sin programación específica para hoy.");
                
                this.currentPlaylistId = 'DEFAULT';
                
                // Limpiamos la programación activa si no hay nada programado
                localStorage.removeItem('activeScheduleData');
                const scheduleList = document.getElementById('schedule-list');
                if (scheduleList) {
                    scheduleList.innerHTML = '<div class="text-center text-muted py-4 small">No hay programación definida.</div>';
                }
                
                this.updateUIStatus("Modo: Sin programación activa");
            }
        }
        
        // IMPORTANTE: NO iniciamos reproducción automáticamente aquí
        // El usuario debe presionar "INICIAR TV" manualmente
    }

    /**
     * Actualiza algún texto en pantalla para saber qué está pasando (Opcional)
     */
    updateUIStatus(text) {
        const statusEl = document.getElementById('playlist-status-indicator');
        if (statusEl) statusEl.innerText = text;
    }
}

// =========================================
// INICIALIZACIÓN PRINCIPAL (CONSOLIDADA)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar VideoPlayer primero
    const player = new VideoPlayer();
    
    // 2. Iniciamos ClinicManager (verifica si ya existe para no duplicar)
    if (!window.clinicManager) {
        window.clinicManager = new ClinicManager(player);
    } else {
        // Si ya existe, asegurarnos de que tenga el player
        if (!window.clinicManager.player) {
            window.clinicManager.player = player;
        }
    }

    // 3. Iniciamos ScheduleManager (solo una instancia)
    if (!window.scheduleManager) {
        window.scheduleManager = new ScheduleManager();
    }

    // 3b. Al cerrar el modal de carpeta de categoría, resetear la vista de subcarpeta
    const folderModalEl = document.getElementById('folderContentModal');
    if (folderModalEl) {
        folderModalEl.addEventListener('hidden.bs.modal', function () {
            if (window.clinicManager && typeof window.clinicManager.exitSubfolder === 'function') {
                window.clinicManager.exitSubfolder();
            }
        });
    }

    // 4. Inicializar reloj y clima
    updateClock(); 
    setInterval(updateClock, 1000);
    updateWeather(); 
    setInterval(updateWeather, 1800000);

    // 5. Renderizar playlists guardadas
    renderSavedPlaylists();
    
    // 6. Restaurar programación activa si existe
    const savedData = localStorage.getItem('activeScheduleData');
    if (savedData) {
        try {
            const playlist = JSON.parse(savedData);
            console.log("🔄 Restaurando programación activa:", playlist.name);
            setTimeout(() => {
                cargarProgramacionVisual(playlist);
            }, 1000); 
        } catch (e) {
            console.error("Error recuperando programación", e);
        }
    }
    
    console.log("✅ Sistemas iniciados correctamente");
});

class ClinicManager {
    constructor(playerInstance) {
        this.player = playerInstance;

        // Estado de selección
        this.selectedClinicName = localStorage.getItem('savedClinicName') || null;
        this.selectedFolderId = localStorage.getItem('savedClinicId') || null;
        
        // Autenticación y Seguridad
        this.accessToken = null;
        this.tokenExpiration = 0; 
        this.tokenClient = null;
        
        // Estado de Navegación
        this.currentFolderId = null;
        this.currentFolderName = ""; 
        this.allFolders = [];
        
        // Playlist
        this.playlistSelection = new Map();

        // Elementos UI
        this.containerClinics = document.getElementById('clinics-container');
        this.menuOverlay = document.getElementById('clinic-menu');
        this.clinicTitle = document.getElementById('clinic-title-display');
        this.selectionBar = document.getElementById('selection-bar');

        this.initGoogleAuth();   
        this.initSearch();
    }

    // ==========================================
    // 1. SEGURIDAD Y CONEXIÓN (NÚCLEO)
    // ==========================================

    initGoogleAuth() {
        if (window.google && window.google.accounts) {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CONFIG.clientId,
                scope: 'https://www.googleapis.com/auth/drive',
                prompt: '',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        console.log("🔐 Token renovado.");
                        this.accessToken = tokenResponse.access_token;
                        const expiresIn = tokenResponse.expires_in || 3599;
                        this.tokenExpiration = Date.now() + (expiresIn * 1000) - 60000;

                        localStorage.setItem('google_access_token', this.accessToken);
                        localStorage.setItem('google_token_expiration', this.tokenExpiration);

                        if (this.pendingResolver) {
                            this.pendingResolver(this.accessToken);
                            this.pendingResolver = null;
                        } else {
                            if(document.getElementById('step-dashboard') && !document.getElementById('step-dashboard').classList.contains('d-none')){
                                this.loadDashboard();
                            } else {
                                this.loadClinicsFromDrive();
                            }
                        }
                    }
                },
            });
        } else {
            setTimeout(() => this.initGoogleAuth(), 250);
            return;
        }

        const savedToken = localStorage.getItem('google_access_token');
        const savedExpiration = localStorage.getItem('google_token_expiration');
        const now = Date.now();

        if (savedToken && savedExpiration && now < parseInt(savedExpiration)) {
            this.accessToken = savedToken;
            this.tokenExpiration = parseInt(savedExpiration);
            this.loadClinicsFromDrive();
        } else {
            this.renderLoginScreen();
        }
    }

    async ensureValidToken() {
        return new Promise((resolve) => {
            const now = Date.now();
            // Si no tenemos token en memoria (p. ej. al reabrir la app), intentar restaurar desde localStorage
            if (!this.accessToken && typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('google_access_token');
                const exp = localStorage.getItem('google_token_expiration');
                if (saved && exp && now < parseInt(exp, 10)) {
                    this.accessToken = saved;
                    this.tokenExpiration = parseInt(exp, 10);
                }
            }
            if (this.accessToken && now < this.tokenExpiration) {
                resolve(this.accessToken);
                return;
            }
            if (!this.tokenClient) {
                resolve(this.accessToken || null);
                return;
            }
            console.log("🔄 Renovando token...");
            this.pendingResolver = resolve;
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    async safeDriveFetch(url, options = {}) {
        try {
            await this.ensureValidToken(); 
            const headers = {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers
            };
            if (options.body instanceof FormData) delete headers['Content-Type'];

            let response = await fetch(url, { ...options, headers });

            if (response.status === 401) {
                this.tokenExpiration = 0; 
                await this.ensureValidToken(); 
                const newHeaders = { ...headers, 'Authorization': `Bearer ${this.accessToken}` };
                response = await fetch(url, { ...options, headers: newHeaders });
            }
            return response;
        } catch (error) {
            console.error("🔥 Error red:", error);
            throw error;
        }
    }

    renderLoginScreen() {
        if (!this.containerClinics) return;
        this.containerClinics.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center mt-5">
                <h4 class="text-white mb-4">Bienvenido</h4>
                <button id="btn-login-drive" class="btn btn-primary btn-lg shadow-sm">🔐 Conectar</button>
            </div>`;
        document.getElementById('btn-login-drive').onclick = () => {
            if (this.tokenClient) this.tokenClient.requestAccessToken({ prompt: 'consent' });
        };
    }

    // ==========================================
    // 2. VISUALIZACIÓN DE CONTENIDO (MODAL)
    // ==========================================

    async viewFolderContent(folderId, folderName) {
        // 1. Configuración inicial y Limpieza
        
        const cleanId = String(folderId).split(',')[0].trim();
        this.currentFolderId = cleanId;
        
        if (folderName) this.currentFolderName = folderName;
        else folderName = this.currentFolderName;

        document.getElementById('modal-folder-name').innerText = folderName;
        const grid = document.getElementById('modal-files-grid');
        // Spinner de carga
        grid.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div><p class="mt-2 text-white-50">Cargando...</p></div>';

        // 2. Abrimos el Modal usando Bootstrap
        const modalEl = document.getElementById('folderContentModal');
        // Instancia segura (verifica si ya existe para no duplicar listeners)
        let modal = bootstrap.Modal.getInstance(modalEl);
        if (!modal) {
            modal = new bootstrap.Modal(modalEl);
        }
        modal.show();

        try {
            // 3. Consultamos a Google Drive (Usando safeDriveFetch para seguridad)
            const q = `'${cleanId}' in parents and (mimeType contains 'video/' or mimeType contains 'image/') and trashed = false`;
            const fields = 'files(id, name, mimeType, thumbnailLink, webViewLink)';
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`;
            
            const res = await this.safeDriveFetch(url);
            const data = await res.json();

            grid.innerHTML = '';

            if (!data.files || data.files.length === 0) {
                grid.innerHTML = '<div class="col-12 text-center text-white-50 py-4">Esta carpeta está vacía 🤷‍♂️</div>';
                return;
            }

            data.files.forEach(file => {
                const isVideo = file.mimeType.includes('video');
                const badgeClass = isVideo ? 'badge-video' : 'badge-image';
                const badgeText = isVideo ? 'VIDEO' : 'FOTO';
                const thumbUrl = file.thumbnailLink || 'img/logoclinica.png'; 

                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3 mb-3';
                col.innerHTML = `
                    <div class="file-thumbnail-card h-100 position-relative bg-dark border border-secondary rounded overflow-hidden">
                        <span class="position-absolute top-0 start-0 badge bg-${isVideo ? 'danger' : 'primary'} m-2">${badgeText}</span>
                        
                        <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2" 
                                style="z-index:10;"
                                onclick="clinicManager.deleteFile('${file.id}', '${cleanId}', '${folderName}')" 
                                title="Eliminar archivo">✕</button>
                        
                        <a href="${file.webViewLink || 'https://drive.google.com/file/d/' + file.id + '/view'}" target="_blank" class="d-block ratio ratio-16x9">
                            <img src="${thumbUrl}" class="w-100 h-100 object-fit-cover" alt="${file.name}" referrerpolicy="no-referrer">
                        </a>
                        
                        <div class="p-2 bg-black bg-opacity-50">
                            <div class="text-white small text-truncate" title="${file.name}">${file.name}</div>
                        </div>
                    </div>
                `;
                grid.appendChild(col);
            });

        } catch (error) {
            console.error(error);
            grid.innerHTML = '<div class="text-danger text-center">Error al conectar con Drive.</div>';
        }
    }

    async deleteFile(fileId) { 
    if(!confirm('¿Estás seguro de eliminar este archivo permanentemente?')) return;
    
    const btn = (typeof event !== 'undefined' && event) ? event.currentTarget : null; 
    if (btn) { btn.disabled = true; btn.innerText = "..."; }

    try {
        const res = await this.safeDriveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
            method: 'PATCH',
            body: JSON.stringify({ trashed: true })
        });

        if (res.ok) {
            console.log("✅ Eliminado correctamente.");
            
            // 4. Recuperamos el nombre de la carpeta actual para no perdernos
            const folderNameElement = document.getElementById('modal-folder-name');
            const folderName = folderNameElement ? folderNameElement.innerText : 'Carpeta';
            
            // 5. Recargamos la VISTA (los iconos) inmediatamente
            if (this.currentOpenFolderId) {
                await this.renderFolderContents(this.currentOpenFolderId, folderName);
            } else {
                this.renderFolderList();
            }
            
            // 6. ACTUALIZACIÓN DIFERIDA DEL CONTADOR (El truco para arreglar el error)
            // Esperamos 1.5s para que Google actualice sus índices antes de contar
            if (this.currentOpenFolderId) {
                setTimeout(() => {
                    // Llamamos a tu nuevo método blindado
                    this.updateFolderStatsDeep(this.currentOpenFolderId);
                }, 1500);
            }

        } else {
            alert("No se pudo eliminar. Revisa los permisos.");
            if (btn) { btn.disabled = false; btn.innerText = "🗑"; }
        }
    } catch (e) {
        console.error("Error al eliminar:", e);
        alert("Error de conexión al intentar eliminar.");
        if (btn) { btn.disabled = false; btn.innerText = "🗑"; }
    }
}

    // ==========================================
    // 3. SUBIDA DE ARCHIVOS (OPTIMIZADA: MULTIPART/RESUMIBLE + PARALELO)
    // ==========================================
    static get RESUMABLE_THRESHOLD() { return 5 * 1024 * 1024; }  // > 5 MB → resumible
    static get MAX_PARALLEL_UPLOADS() { return 2; }

    /** MIME type correcto para que Drive procese el vídeo (evita "Procesando" infinito por tipo genérico) */
    _getMimeForFile(file) {
        const t = (file.type || '').toLowerCase();
        if (t.startsWith('video/')) return file.type;
        const ext = (file.name || '').split('.').pop().toLowerCase();
        const map = { mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska' };
        return map[ext] || 'video/mp4';
    }

    async _uploadOneFile(file, accessToken, targetFolderId, onProgress) {
        const useResumable = file.size > ClinicManager.RESUMABLE_THRESHOLD;
        if (!useResumable) return this._uploadMultipart(file, accessToken, targetFolderId, onProgress);
        return this._uploadResumable(file, accessToken, targetFolderId, onProgress);
    }

    _uploadMultipart(file, accessToken, targetFolderId, onProgress) {
        return new Promise((resolve, reject) => {
            const mimeType = this._getMimeForFile(file);
            const metadata = { name: file.name, parents: [targetFolderId], mimeType };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            const fileToSend = file.type && file.type.startsWith('video/') ? file : new File([file], file.name, { type: mimeType });
            form.append('file', fileToSend);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name');
            xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
            xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); };
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || 'Error subida')));
            xhr.onerror = () => reject(new Error("Error de red"));
            xhr.send(form);
        });
    }

    async _uploadResumable(file, accessToken, targetFolderId, onProgress) {
        const mimeType = this._getMimeForFile(file);
        const metadata = { name: file.name, parents: [targetFolderId], mimeType };
        const startRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        });
        if (!startRes.ok) throw new Error(await startRes.text());
        const uploadUrl = startRes.headers.get('Location');
        if (!uploadUrl) throw new Error('No se obtuvo URL de subida resumible');
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', mimeType);
            xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total); };
            xhr.onload = () => (xhr.status === 200 || xhr.status === 201 ? resolve() : reject(new Error(xhr.responseText || 'Error subida resumible')));
            xhr.onerror = () => reject(new Error("Error de red"));
            xhr.send(file);
        });
    }

    async handleFileUpload(event) {
        const files = (event.target && event.target.files) ? event.target.files : event;
        if (!files || files.length === 0) return;

        const targetFolderId = this.activeSubfolderId || this.currentFolderId;
        if (!targetFolderId) {
            alert("⚠️ Error: No se detectó una carpeta de destino.");
            return;
        }

        const accessToken = await this.ensureValidToken();
        const container = document.getElementById('upload-progress-container');
        const statusText = document.getElementById('upload-status');
        const percentageText = document.getElementById('upload-percentage');
        const progressBar = document.getElementById('upload-progress-bar');

        const filesArray = Array.from(files);
        const totalFiles = filesArray.length;
        const totalBytes = filesArray.reduce((s, f) => s + f.size, 0);
        const loadedByIndex = filesArray.map(() => 0);
        let completedCount = 0;

        const updateUI = () => {
            const loaded = loadedByIndex.reduce((a, b) => a + b, 0);
            const percent = totalBytes > 0 ? Math.round((loaded / totalBytes) * 100) : 0;
            if (progressBar) progressBar.style.width = percent + '%';
            if (percentageText) percentageText.innerText = percent + '%';
            if (statusText) statusText.innerText = totalFiles === 1 ? `Subiendo: ${filesArray[0].name}` : `Subiendo ${completedCount}/${totalFiles} archivos — ${percent}%`;
        };

        if (container) { container.classList.remove('d-none'); container.classList.add('d-block'); }
        updateUI();

        const maxParallel = ClinicManager.MAX_PARALLEL_UPLOADS;
        const queue = filesArray.map((file, index) => ({ file, index }));
        let active = 0;

        const runNext = () => {
            while (queue.length > 0 && active < maxParallel) {
                const { file, index } = queue.shift();
                active++;
                this._uploadOneFile(file, accessToken, targetFolderId, (loaded, total) => {
                    loadedByIndex[index] = total ? loaded : 0;
                    updateUI();
                }).then(() => {
                    loadedByIndex[index] = file.size;
                    completedCount++;
                    updateUI();
                    console.log(`✅ Subido: ${file.name}`);
                }).catch((err) => {
                    console.error("Error upload:", err);
                    alert(`❌ Falló la subida de: ${file.name}`);
                }).finally(() => {
                    active--;
                    runNext();
                });
            }
        };

        runNext();

        await new Promise((resolve) => {
            const waitDone = () => {
                if (active === 0 && queue.length === 0) return resolve();
                setTimeout(waitDone, 120);
            };
            waitDone();
        });

        if (statusText) statusText.innerText = "✅ ¡Todo listo!";
        if (progressBar) progressBar.style.width = '100%';
        if (percentageText) percentageText.innerText = '100%';

        if (this.currentFolderId) this.updateFolderStatsDeep(this.currentFolderId);

        setTimeout(() => {
            if (container) { container.classList.add('d-none'); container.classList.remove('d-block'); }
            if (this.activeSubfolderId) this.renderSubfolderFiles(this.activeSubfolderId);
            else this.renderFolderContents(this.currentFolderId);
        }, 1500);

        if (event.target && event.target.tagName === 'INPUT') event.target.value = '';
    }

    // ==========================================
    // 4. DASHBOARD Y CARPETAS
    // ==========================================

    async loadDashboard() {
    // 1. Recuperamos el ID (de la memoria o del localStorage)
    let targetId = this.selectedFolderId || localStorage.getItem('savedClinicId');
    
    if (!targetId) { 
        this.reset(); 
        this.loadClinicsFromDrive(); 
        return; 
    }
    
    // Limpieza de ID por si viene con nombres extra
    targetId = String(targetId).split(',')[0].trim();
    
    // 2. SINCRONIZACIÓN: Guardamos el ID en todas las variables necesarias
    this.selectedFolderId = targetId; 
    this.rootClinicId = targetId;     // Variable maestra para la raíz
    this.currentFolderId = targetId;
    
    // 3. UI: Mostrar dashboard y spinner
    this.showStep('step-dashboard');
    this.updatePreview(); 
    
    const listContainer = document.getElementById('folders-list');
    listContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-info small"></div></div>';

    try {
        const q = `'${targetId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
        const res = await this.safeDriveFetch(url); 
        const data = await res.json();
        this.allFolders = data.files || [];
        this.allFolders.sort((a, b) => a.name.localeCompare(b.name));
        this.renderFolderList(this.allFolders);
    } catch (e) {
        console.error("Error en loadDashboard:", e);
        listContainer.innerHTML = '<div class="text-danger small text-center">Error al cargar carpetas.</div>';
    }
}

    async loadClinicsFromDrive() {
        try {
            const q = `'${CONFIG.masterFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`;
            const response = await this.safeDriveFetch(url); 

            if (!response.ok) throw new Error("Error API");
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
        } catch (error) { 
            if(this.containerClinics) this.containerClinics.innerHTML = '<div class="text-danger">Error de conexión</div>';
        }
    }

    async createFolderFromUI() {
    // 1. Validación de IDs (buscamos en cualquier variable disponible)
    const clinicId = this.rootClinicId || this.selectedFolderId;

    if (!clinicId) {
        return alert("Error: No se encontró el ID de la clínica. Intenta seleccionar la clínica de nuevo.");
    }

    // 2. Obtenemos el nombre generado por el preview
    const folderName = this.updatePreview();
    if (!folderName) return alert("El nombre de la carpeta no es válido.");

    const btn = document.querySelector('.creation-panel button');
    const originalText = btn.innerText;
    
    // Feedback visual (Spinner)
    btn.innerText = "⏳ Creando..."; 
    btn.disabled = true;

    try {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [clinicId]
        };
        const res = await this.safeDriveFetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fileMetadata)
        });
        if (res.ok) {
            console.log(`✅ Carpeta "${folderName}" creada con éxito.`);
            await this.loadDashboard();

            // Limpiamos el input del ID (número) para la siguiente creación
            const idInput = document.getElementById('new-id');
            if(idInput) idInput.value = ""; 
            
            this.updatePreview(); 
        } else {
            const errData = await res.json();
            console.error("Error API Drive:", errData);
            throw new Error("No se pudo crear la carpeta.");
        }

    } catch (e) { 
        console.error("Error en createFolderFromUI:", e);
        alert("❌ Error al crear la carpeta. Revisa la consola."); 
    } finally { 
        // Restauramos el estado original del botón
        btn.innerText = originalText; 
        btn.disabled = false; 
    }
}

    /**
     * Muestra el contenido (Subcarpetas y Videos) dentro del Modal
     * @param {string} folderId - ID de la carpeta a inspeccionar (Ej: La carpeta CSJGEO12)
     * @param {string} folderName - Nombre para poner en el título del modal (Opcional)
     */
    async renderFolderContents(folderId, folderName = null) {
        // 1. Guardamos el ID actual para saber dónde crear subcarpetas nuevas si el usuario quiere
        this.currentOpenFolderId = folderId;

        // 2. Referencias al DOM del Modal
        const grid = document.getElementById('modal-files-grid');
        const titleLabel = document.getElementById('modal-folder-name');
        
        // Si nos pasaron un nombre, actualizamos el título del modal
        if (folderName && titleLabel) {
            titleLabel.innerText = folderName;
        }

        // 3. Mostrar Spinner de carga
        grid.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-info" role="status"></div><p class="text-muted mt-2">Cargando bloques...</p></div>';

        try {
            // 4. Petición a Drive: Traer archivos y carpetas dentro de este ID
            // Pedimos: id, name, mimeType, thumbnailLink (para videos)
            const q = `'${folderId}' in parents and trashed = false`;
            const response = await this.safeDriveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink,webViewLink,description)&orderBy=folder,name`);
            
            if (!response.ok) throw new Error("Error cargando contenido");
            
            const data = await response.json();
            const files = data.files || [];

            // 5. Limpiamos el grid
            grid.innerHTML = '';

            if (files.length === 0) {
                grid.innerHTML = `
                    <div class="col-12 text-center text-muted py-4">
                        <p>📂 Esta carpeta está vacía.</p>
                        <small>Usa el panel de arriba para crear un bloque de contenido.</small>
                    </div>`;
                return;
            }

            // 6. Generamos el HTML para cada elemento
            files.forEach(file => {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                
                // Creamos un elemento visual (Card pequeña)
                const col = document.createElement('div');
                col.className = 'col-12'; // Ocupa todo el ancho para que sea una lista
                if (isFolder) {
    // --- DISEÑO PARA SUBCARPETA (BLOQUE) ---
    
    // 1. Obtener intensidad: Prioridad a 'description', respaldo en el nombre (carpetas viejas)
                    const intensityRaw = (file.description || '').toUpperCase();
                    const fileName = file.name.toUpperCase();
    
                    let badgeClass = 'bg-success'; // Por defecto BAJA (Verde)
                    let intensityLabel = 'BAJA';

                    if (intensityRaw.includes('ALTA') || fileName.includes('[A]')) {
                        badgeClass = 'bg-danger';
                        intensityLabel = 'ALTA';
                    } else if (intensityRaw.includes('MEDIA') || fileName.includes('[M]')) {
                        badgeClass = 'bg-warning text-dark';
                        intensityLabel = 'MEDIA';
                    }

    // 2. Limpiar el nombre para que no se vean los tags [A], [M] o [B] si existieran
                    const cleanName = file.name.replace(/\[[AMB]\]/g, '').trim();

                    col.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center bg-dark border border-secondary p-3 rounded mb-2">
                            <div class="d-flex align-items-center">
                                <span class="fs-2 me-3">📁</span>
                                <div>
                                    <h6 class="mb-0 text-white">${cleanName}</h6>
                                    <span class="badge ${badgeClass}" style="font-size:0.7rem; letter-spacing: 0.5px;">${intensityLabel}</span>
                                </div>
                            </div>
                            <div>
                                <button class="btn btn-outline-info btn-sm me-2" onclick="clinicManager.enterSubfolder('${file.id}', '${file.name}')">
                                    Contenido/Subir
                                </button>
                                <button class="btn btn-outline-danger btn-sm" onclick="clinicManager.deleteFile('${file.id}')" title="Borrar carpeta">
                                    🗑
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    // --- DISEÑO PARA VIDEO SUELTO (Si hubiera) ---
                    // (Aunque idealmente deberían estar dentro de subcarpetas)
                    col.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center bg-black border border-secondary p-2 rounded">
                            <div class="d-flex align-items-center">
                                <span class="fs-4 me-3">🎬</span>
                                <div class="text-truncate" style="max-width: 250px;">
                                    <span class="text-white-50 small">${file.name}</span>
                                </div>
                            </div>
                            <button class="btn btn-sm text-danger" onclick="clinicManager.deleteFile('${file.id}')">×</button>
                        </div>
                    `;
                }

                grid.appendChild(col);
            });

        } catch (error) {
            console.error(error);
            grid.innerHTML = '<div class="text-danger text-center">Error al cargar contenido.</div>';
        }
    }


    async deleteFolderById(folderId, name, event) {
        if (event) { event.stopPropagation(); event.preventDefault(); }
        const cleanId = String(folderId).split(',')[0].trim();
        if(!confirm(`¿Eliminar carpeta "${name}"?`)) return;

        try {
            const res = await this.safeDriveFetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
                method: 'PATCH',
                body: JSON.stringify({ trashed: true })
            });
            if(res.ok) this.loadDashboard();
        } catch (e) { console.error(e); }
    }

    // ==========================================
    // 5. PLAYLIST (LÓGICA)
    // ==========================================

    async launchPlaylist() {
        try {
            await this.ensureValidToken();
            if (this.accessToken) {
                localStorage.setItem('google_access_token', this.accessToken);
                localStorage.setItem('google_token_expiration', String(this.tokenExpiration));
            } else {
                return alert("⚠️ Debes iniciar sesión en Google para reproducir. Abre el menú de clínicas e inicia sesión.");
            }
        } catch (e) {
            console.error("No se pudo obtener token para reproducir:", e);
            return alert("⚠️ Debes iniciar sesión en Google para reproducir. Abre el menú de clínicas e inicia sesión.");
        }

        let idsParaReproducir = [];
        let videosBAJA = [];
        let videosALTA = [];
        let videosMEDIA = [];
        let usarMixGuardado = false;

        // Prioridad 1: Programación activa con mix ya aleatorizado
        const activeScheduleData = localStorage.getItem('activeScheduleData');
        if (activeScheduleData) {
            try {
                const active = JSON.parse(activeScheduleData);
                if (active.shuffledBaja || active.shuffledAlta || active.shuffledMedia) {
                    videosBAJA = active.shuffledBaja || [];
                    videosALTA = active.shuffledAlta || [];
                    videosMEDIA = active.shuffledMedia || [];
                    usarMixGuardado = true;
                    console.log(`📺 Usando mix guardado de programación activa: ${active.name}`);
                } else if (active.folders && active.folders.length > 0) {
                    idsParaReproducir = active.folders;
                    console.log(`📺 Usando programación activa (sin mix): ${active.name}`);
                }
            } catch (e) {
                console.error("Error leyendo programación activa:", e);
            }
        }
        
        // Prioridad 2: Selección actual si no hay mix guardado
        if (!usarMixGuardado && idsParaReproducir.length === 0) {
            if (window.currentPlaylistSelection && window.currentPlaylistSelection.length > 0) {
                idsParaReproducir = window.currentPlaylistSelection;
            } else if (this.playlistSelection && this.playlistSelection.size > 0) {
                idsParaReproducir = Array.from(this.playlistSelection.keys());
            }
        }
        
        if (!usarMixGuardado && idsParaReproducir.length === 0) {
            return alert("⚠️ No hay programación activa ni carpetas seleccionadas.\n\nActiva una playlist guardada o selecciona carpetas manualmente.");
        }

        if (!usarMixGuardado) {
            document.body.style.cursor = 'wait';

            for (const idRaw of idsParaReproducir) {
                const id = String(idRaw).split(',')[0].trim();
                let folder = this.allFolders.find(f => f.id == id);
                
                if (!folder || !folder.files || folder.files.length === 0) {
                    const videos = await this.fetchVideosFromFolder(id);
                    if (folder) folder.files = videos;
                    else {
                        const folderName = this.allFolders.find(f => f.id == id)?.name || "Carpeta " + id;
                        folder = { id: id, name: folderName, files: videos };
                    }
                }

                if (folder.files && folder.files.length > 0) {
                    folder.files.forEach(video => {
                        const intensity = video.intensity || 'BAJA';
                        const videoWithMeta = { ...video, originFolder: folder.name || "Desconocida" };
                        if (intensity === 'ALTA') videosALTA.push(videoWithMeta);
                        else if (intensity === 'MEDIA') videosMEDIA.push(videoWithMeta);
                        else videosBAJA.push(videoWithMeta);
                    });
                }
            }
            
            document.body.style.cursor = 'default';

            videosBAJA.sort(() => Math.random() - 0.5);
            videosALTA.sort(() => Math.random() - 0.5);
            videosMEDIA.sort(() => Math.random() - 0.5);
        }

        const totalVideos = videosBAJA.length + videosALTA.length + videosMEDIA.length;
        if (totalVideos === 0) {
            return alert("❌ No se encontraron videos en las carpetas seleccionadas.");
        }

        console.log(`📊 Videos: ${videosBAJA.length} BAJA, ${videosALTA.length} ALTA, ${videosMEDIA.length} MEDIA`);

        this.menuOverlay.classList.add('slide-up');
        if (this.player && this.player.startQueueWithIntensity) {
            this.player.startQueueWithIntensity(videosBAJA, videosALTA, videosMEDIA);
        } else if (this.player && this.player.startQueue) {
            const allVideos = [...videosBAJA, ...videosALTA, ...videosMEDIA];
            allVideos.sort(() => Math.random() - 0.5);
            this.player.startQueue(allVideos);
        }
    }

    /**
     * Genera el mix aleatorio para una playlist (todas las carpetas, separado por intensidad, ya mezclado).
     * Se guarda para esa playlist y su duración; INICIAR TV usará este mix sin volver a aleatorizar.
     * @param {Object} playlist - { id, name, start, end, folders }
     * @returns {Promise<{shuffledBaja:Array, shuffledAlta:Array, shuffledMedia:Array}>}
     */
    async generarMixParaPlaylist(playlist) {
        const idsParaReproducir = (playlist.folders || []).map(id => String(id).split(',')[0].trim());
        const videosBAJA = [];
        const videosALTA = [];
        const videosMEDIA = [];

        for (const id of idsParaReproducir) {
            const folder = this.allFolders.find(f => f.id === id);
            let files = folder && folder.files && folder.files.length > 0
                ? folder.files
                : await this.fetchVideosFromFolder(id);
            if (folder && !folder.files) folder.files = files;
            (files || []).forEach(video => {
                const intensity = video.intensity || 'BAJA';
                const videoWithMeta = { ...video, originFolder: (folder && folder.name) || 'Desconocida' };
                if (intensity === 'ALTA') videosALTA.push(videoWithMeta);
                else if (intensity === 'MEDIA') videosMEDIA.push(videoWithMeta);
                else videosBAJA.push(videoWithMeta);
            });
        }

        videosBAJA.sort(() => Math.random() - 0.5);
        videosALTA.sort(() => Math.random() - 0.5);
        videosMEDIA.sort(() => Math.random() - 0.5);

        return { shuffledBaja: videosBAJA, shuffledAlta: videosALTA, shuffledMedia: videosMEDIA };
    }

    /**
     * Busca videos recursivamente en una carpeta y sus subcarpetas (bloques)
     * Asigna la intensidad de cada bloque a sus videos
     */
    async fetchVideosFromFolder(folderId) {
        const cleanId = String(folderId).split(',')[0].trim();
        let videosFound = [];

        try {
            const q = `'${cleanId}' in parents and (mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.folder') and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,description,size,videoMediaMetadata)`;
            const response = await this.safeDriveFetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            const files = data.files || [];

            // 2. Procesamos los resultados
            for (const file of files) {
                if (file.mimeType.includes('video/')) {
                    // A. Si es video directo (sin bloque), lo marcamos como BAJA por defecto
                    videosFound.push({
                        ...file,
                        intensity: 'BAJA', // Por defecto
                        originBlock: null
                    });
                } else if (file.mimeType === 'application/vnd.google-apps.folder') {
                    // B. Si es carpeta (BLOQUE), obtenemos su intensidad
                    const intensityRaw = (file.description || '').toUpperCase();
                    const fileName = file.name.toUpperCase();
                    
                    let intensity = 'BAJA'; // Por defecto
                    if (intensityRaw.includes('ALTA') || fileName.includes('[A]')) {
                        intensity = 'ALTA';
                    } else if (intensityRaw.includes('MEDIA') || fileName.includes('[M]')) {
                        intensity = 'MEDIA';
                    }
                    
                    // Buscamos videos dentro de este bloque
                    const blockVideos = await this.fetchVideosFromBlock(file.id);
                    
                    // Asignamos la intensidad del bloque a cada video
                    const videosWithIntensity = blockVideos.map(video => ({
                        ...video,
                        intensity: intensity,
                        originBlock: file.name
                    }));
                    
                    videosFound = [...videosFound, ...videosWithIntensity];
                }
            }

            return videosFound;

        } catch (error) {
            console.error("Error buscando en profundidad:", error);
            return [];
        }
    }

    /**
     * Busca videos dentro de un bloque (subcarpeta) específico
     */
    async fetchVideosFromBlock(blockId) {
        try {
            const q = `'${blockId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,videoMediaMetadata)`;
            
            const response = await this.safeDriveFetch(url);
            if (!response.ok) return [];
            
            const data = await response.json();
            return data.files || [];
        } catch (error) {
            console.error("Error buscando videos en bloque:", error);
            return [];
        }
    }

    // ==========================================
    // 6. UI HELPERS (SELECCIÓN, EDICIÓN, ETC)
    // ==========================================

    selectClinic(name, id) {
        this.selectedClinicName = name;
        this.selectedFolderId = String(id).split(',')[0].trim();
        localStorage.setItem('savedClinicName', name);
        localStorage.setItem('savedClinicId', this.selectedFolderId);
        this.playlistSelection.clear();
        this.updateFloatingBar();
        if (this.clinicTitle) this.clinicTitle.innerText = name;
        this.showStep('step-decision');
    }

    showStep(stepId) {
        const container = document.querySelector('.menu-container');
        const wideSteps = ['step-playlist', 'step-visualizar'];
        if (container) {
            container.style.maxWidth = wideSteps.includes(stepId) ? '1300px' : '600px';
            if (wideSteps.includes(stepId)) container.classList.add('container-wide');
            else container.classList.remove('container-wide');
        }
        ['step-select', 'step-decision', 'step-dashboard', 'step-playlist', 'step-visualizar'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('d-none');
        });
        const target = document.getElementById(stepId);
        if(target) target.classList.remove('d-none');

        if (stepId === 'step-visualizar') {
            renderVisualizarPlaylist();
        }
        if (stepId === 'step-dashboard') {
            this.renderFolderList();
            setTimeout(() => this.updateFloatingBar(), 150); 
        } else if (stepId === 'step-playlist') {
            const fromMap = this.playlistSelection && this.playlistSelection.size > 0
                ? Array.from(this.playlistSelection.keys())
                : [];
            if (fromMap.length > 0 && (!window.currentPlaylistSelection || window.currentPlaylistSelection.length === 0)) {
                window.currentPlaylistSelection = fromMap;
            }
            if (typeof this.showPlaylistReview === 'function') this.showPlaylistReview();
            if (this.selectionBar) this.selectionBar.classList.remove('active');
        } else {
            if (this.selectionBar) this.selectionBar.classList.remove('active');
        }
    }

    renderFolderList(filesToRender) {
    const listContainer = document.getElementById('folders-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    listContainer.onclick = (e) => {
        if (e.target.classList.contains('folder-checkbox')) {
            this.toggleFolderSelection({id: e.target.value, name: e.target.dataset.name}, e.target.checked);
        }
    };

    const foldersToShow = filesToRender || this.allFolders || [];

    if (foldersToShow.length === 0) {
        listContainer.innerHTML = '<div class="text-white-50 text-center small mt-3">No hay carpetas creadas.</div>';
        return;
    }

    foldersToShow.forEach(folder => {
        const isChecked = this.playlistSelection.has(folder.id) ? 'checked' : '';
        const div = document.createElement('div');
        div.className = `folder-item border border-secondary d-flex align-items-center mb-2`;
        
        // Drag & Drop
        div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
        div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
        div.addEventListener('drop', (e) => {
            e.preventDefault(); div.classList.remove('drag-over');
            this.openFolderModal(folder.id, folder.name);
        });

        div.innerHTML = `
            <div class="me-3">
                <input class="form-check-input folder-checkbox" type="checkbox" value="${folder.id}" data-name="${folder.name}" ${isChecked} style="transform: scale(1.3); cursor:pointer;">
            </div>
            
            <div class="flex-grow-1 clickable-folder px-2 py-1" onclick="clinicManager.openFolderModal('${folder.id}', '${folder.name}')" style="cursor: pointer;">
                <div class="fw-bold text-white small text-truncate pointer-events-none">${folder.name}</div>
                <div class="text-white-50" style="font-size:0.7rem" id="count-${folder.id}">Calculando...</div>
            </div>
            
            <div class="btn-group ms-2">
                <button class="btn btn-outline-danger btn-sm px-2" onclick="clinicManager.deleteFolderById('${folder.id}', '${folder.name}', event)">🗑️</button>
            </div>
        `;
        
        listContainer.appendChild(div);
        
        // Llamamos a la nueva función de conteo profundo
        this.updateFolderStatsDeep(folder.id);
    });
}

    openFolderModal(folderId, folderName) {
        // 1. Instanciar y mostrar el modal de Bootstrap
        const modalEl = document.getElementById('folderContentModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // 2. Llamar a la función que carga las subcarpetas y videos
        this.renderFolderContents(folderId, folderName);
    }

    toggleFolderSelection(folder, isChecked) {
        if (isChecked) this.playlistSelection.set(folder.id, folder);
        else this.playlistSelection.delete(folder.id);
        this.updateFloatingBar();
    }

    updateFloatingBar() {
        if (!this.selectionBar) return;
        const count = this.playlistSelection.size;
        document.getElementById('selection-count').innerText = count;
        const isPlaylistActive = !document.getElementById('step-playlist')?.classList.contains('d-none');
        if (count > 0 && !isPlaylistActive) {
            this.selectionBar.style.display = "flex";
            setTimeout(() => this.selectionBar.classList.add('active'), 10);
        } else {
            this.selectionBar.classList.remove('active');
            setTimeout(() => { if (!this.selectionBar.classList.contains('active')) this.selectionBar.style.display = "none"; }, 500);
        }
    }

    showPlaylistReview() {
        const container = document.getElementById('playlist-preview-list');
        if (!container) return;
        container.innerHTML = '';
        if (this.playlistSelection.size === 0) {
            container.innerHTML = `<div class="text-center py-3 text-white-50 small">No hay carpetas</div>
                <button type="button" class="btn btn-outline-info btn-sm w-100 mt-2" onclick="clinicManager.showStep('step-dashboard')">Ir a agregar</button>`;
            return;
        }
        
        this.playlistSelection.forEach((folder) => {
            const item = document.createElement('div');
            item.className = 'playlist-item d-flex justify-content-between align-items-center p-2 mb-2 bg-white bg-opacity-10 border-start border-info border-3 rounded animate-fade-in';
            item.innerHTML = `
                <div class="ps-2"><div class="text-white fw-bold small">📂 ${folder.name}</div></div>
                <button class="btn btn-link text-danger p-0 me-2" onclick="clinicManager.removeFromPlaylist('${folder.id}')">&times;</button>
            `;
            container.appendChild(item);
        });
    }

    removeFromPlaylist(id) {
        this.playlistSelection.delete(id);
        this.updateFloatingBar();
        this.showPlaylistReview(); 
    }

    // NOTA: countVideos() fue eliminada porque no se usa en ningún lugar.
    // Se usa updateFolderStatsDeep() en su lugar, que cuenta bloques y videos de forma recursiva.

    async editIntensity(id, oldName) {
        const cleanId = String(id).split(',')[0].trim();
        const baseName = oldName.slice(0, -1); 
        const newInt = prompt(`Cambiar prioridad (A, M, B):`, oldName.slice(-1));
        if (!newInt || !['A', 'M', 'B'].includes(newInt.toUpperCase())) return;
        try {
            await this.safeDriveFetch(`https://www.googleapis.com/drive/v3/files/${cleanId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: baseName + newInt.toUpperCase() })
            });
            this.loadDashboard();
        } catch (e) { alert("Error al editar."); }
    }

    initSearch() {
        const searchInput = document.getElementById('folder-search-input');
        if(!searchInput) return;
        searchInput.addEventListener('input', (e) => {
            const text = e.target.value.toUpperCase().trim();
            if (text === "") { this.renderFolderList(this.allFolders); return; }
            this.renderFolderList(this.allFolders.filter(f => f.name.toUpperCase().includes(text)));
        });
    }

    // 1. Método para entrar en un bloque (al dar click en "Subir Videos")
async enterSubfolder(subfolderId, subfolderName) {
    this.activeSubfolderId = subfolderId; // Guardamos el ID donde subiremos archivos
    
    // Ocultamos la lista de bloques y el panel de creación de bloques
    document.getElementById('modal-files-grid').style.display = 'none';
    const subCreationPanel = document.querySelector('.creation-panel-sub');
    if(subCreationPanel) subCreationPanel.style.display = 'none';

    // Mostramos la vista de contenido del bloque
    const contentView = document.getElementById('block-content-view');
    contentView.style.display = 'block';
    
    // Actualizamos el título del modal
    document.getElementById('modal-folder-name').innerText = `Bloque: ${subfolderName}`;

    // Cargamos lo que ya existe
    await this.renderSubfolderFiles(subfolderId);
}

// 2. Método para salir y volver a la lista de bloques
exitSubfolder() {
    this.activeSubfolderId = null;
    
    // Invertimos la visibilidad
    document.getElementById('modal-files-grid').style.display = 'flex';
    document.getElementById('block-content-view').style.display = 'none';
    const subCreationPanel = document.querySelector('.creation-panel-sub');
    if(subCreationPanel) subCreationPanel.style.display = 'block';
    
    // Restauramos el título original (el de la carpeta principal)
    const originalName = document.querySelector('.folder-item.active')?.dataset.name || "Bloques";
    document.getElementById('modal-folder-name').innerText = originalName;
}

// 3. Ver archivos dentro del bloque
async renderSubfolderFiles(folderId) {
    const grid = document.getElementById('block-files-grid');
    grid.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-info"></div></div>';

    try {
        const q = `'${folderId}' in parents and trashed = false`;
        const res = await this.safeDriveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink)`);
        const data = await res.json();
        
        grid.innerHTML = '';
        if (data.files.length === 0) {
            grid.innerHTML = '<p class="text-muted text-center py-4">Este bloque no tiene videos aún.</p>';
            return;
        }

        data.files.forEach(file => {
            const col = document.createElement('div');
            col.className = 'col'; 

            const isVideo = file.mimeType.includes('video');
            const hasThumb = !!file.thumbnailLink;
            const thumbHtml = hasThumb
                ? `<img src="${file.thumbnailLink.replace('=s220', '=s400')}" 
                         class="thumb-img" 
                         alt="${file.name}">`
                : `<div class="thumb-img processing-thumb" title="En Drive sigue procesándose (vista previa), pero ya se puede reproducir en la playlist.">
                        <span class="processing-label">Procesando, listo para reproducir</span>
                   </div>`;

            const fileViewUrl = file.webViewLink || ('https://drive.google.com/file/d/' + file.id + '/view');
            col.innerHTML = `
        <div class="file-thumbnail-card h-100" style="cursor: pointer;" onclick="window.open('${fileViewUrl}', '_blank')">
            <span class="file-type-badge ${isVideo ? 'badge-video' : 'badge-image'}">
                ${isVideo ? 'VIDEO' : 'FOTO'}
            </span>

            <button class="delete-file-btn" onclick="event.stopPropagation(); clinicManager.deleteFile('${file.id}')">
                ×
            </button>

            ${thumbHtml}
            
            <div class="p-2">
                <p class="text-white-50 m-0 x-small-text text-truncate" title="${file.name}">
                    ${file.name}
                </p>
            </div>
        </div>
    `;
            grid.appendChild(col);
        });
    } catch (e) { console.error(e); }
}


    updatePreview() {
        const topic = document.getElementById('new-topic').value;
        const idRaw = document.getElementById('new-id').value;
        
        // 1. ELIMINADO: Ya no capturamos 'intensity' aquí porque borramos esos botones del dashboard.

        // 2. Generamos el prefijo (CSJ, GEN, etc.)
        let prefix = this.selectedClinicName ? this.selectedClinicName.replace(/\s+/g, '').substring(0, 3).toUpperCase() : "GEN";
        
        // 3. MODIFICADO: El código final ahora es solo PREFIJO + TEMA + ID
        // (Ej: CSJGEO12) - Se eliminó la variable intensity del final string
        const code = `${prefix}${topic}${idRaw.padStart(2, '0')}`;
        
        // 4. Actualizamos la vista previa en el HTML
        const previewEl = document.getElementById('code-preview');
        if(previewEl) previewEl.innerText = code;
        
        return code;
    }
    async createSubfolderFromUI() {
    const nameInput = document.getElementById('subfolder-name-input');
    const name = nameInput.value.trim();
    
    // Obtenemos el radio button seleccionado
    const intensityCheck = document.querySelector('input[name="sub-intensity"]:checked');
    const intensity = intensityCheck ? intensityCheck.value : 'MEDIA'; 

    if (!name) return alert("⚠️ Escribe un nombre para el bloque.");
    if (!this.currentOpenFolderId) return alert("Error: No hay carpeta padre seleccionada.");

    const finalName = name.toUpperCase();

    try {
        console.log(`Creando bloque: ${finalName} con intensidad: ${intensity}`);
        
        // 1. Crear la carpeta en Drive
        await this.createFolderInDrive(finalName, this.currentOpenFolderId, intensity);
        
        // 2. Limpiar el campo
        nameInput.value = '';

        // --- EL CAMBIO ESTÁ AQUÍ ---
        // Actualizamos el contador inmediatamente para que sume el nuevo bloque
        // Usamos await para asegurarnos de que se actualice antes de seguir
        await this.updateFolderStatsDeep(this.currentOpenFolderId); 
        
        // 3. Refrescar el contenido visual del modal
        const modalTitle = document.getElementById('modal-folder-name').innerText;
        await this.renderFolderContents(this.currentOpenFolderId, modalTitle);
        
        console.log("✅ Bloque creado y contadores actualizados.");
    } catch (error) {
        console.error("Error al crear el bloque:", error);
        alert("Error creando el bloque.");
    }
}

    /**
     * Crea una carpeta física en Google Drive y devuelve su ID.
     * @param {string} folderName - Nombre de la nueva carpeta
     * @param {string} parentFolderId - ID de la carpeta padre donde se creará
     */
    async createFolderInDrive(folderName, parentFolderId, intensity) {
    // 1. Verificamos que tengamos un token disponible
    if (!this.accessToken) {
        console.error("No hay token de acceso disponible");
        throw new Error("Sesión no iniciada en Google");
    }

    // 2. IMPORTANTE: Le decimos a GAPI que use nuestro token actual
    gapi.client.setToken({ access_token: this.accessToken });

    const fileMetadata = {
        'name': folderName,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parentFolderId],
        'description': intensity
    };

    try {
        const response = await gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        
        console.log(`✅ Carpeta creada con éxito: ${folderName}`);
        return response.result.id;
    } catch (error) {
        // Si aquí da 401, es que el token en el localStorage expiró realmente
        if (error.status === 401) {
            console.warn("El token expiró. Intentando renovar...");
            // Aquí podrías llamar a tu función de login si quisieras
        }
        console.error("Error en la creación física:", error);
        throw error;
    }
}

    
    backToDecision() { this.showStep('step-decision'); }
    reset() {
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        localStorage.removeItem('savedClinicName');
        localStorage.removeItem('savedClinicId');
        this.playlistSelection.clear();
        this.showStep('step-select');
    }

    async updateFolderStatsDeep(folderId, attempt = 0) {
    const statsElement = document.getElementById(`count-${folderId}`);
    if (!statsElement) return;

    try {
        // 1. Obtener Token
        let token = null;
        const tokenObj = gapi.auth.getToken();
        
        if (tokenObj && tokenObj.access_token) {
            token = tokenObj.access_token;
        } else if (typeof this.ensureValidToken === 'function') {
            token = await this.ensureValidToken();
        }

        // Si no hay token, reintentamos un par de veces
        if (!token) {
            if (attempt < 2) setTimeout(() => this.updateFolderStatsDeep(folderId, attempt + 1), 1000);
            return;
        }

        // 2. Obtener Bloques (Usamos nocache para evitar datos viejos)
        const nocache = Date.now();
        const subRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&nocache=${nocache}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const subData = await subRes.json();
        const subfolders = subData.files || [];
        const totalBlocks = subfolders.length;

        // Si no hay bloques, mostramos 0 y salimos
        if (totalBlocks === 0) {
            statsElement.innerHTML = `<span style="color: #0dcaf0; font-weight: 600;">0 bloques</span> | <span class="text-white-50">0 videos</span>`;
            return;
        }

        // 3. Contar Videos dentro de los bloques
        const videoCounts = await Promise.all(subfolders.map(async (folder) => {
            try {
                const fRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folder.id}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)&nocache=${nocache}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const fData = await fRes.json();
                return (fData.files || []).length;
            } catch (err) { return 0; }
        }));

        const totalVideos = videoCounts.reduce((a, b) => a + b, 0);

        // 4. Renderizar Resultado Final
        statsElement.innerHTML = `
            <span style="color: #0dcaf0; font-weight: 600;">${totalBlocks} bloques</span> | 
            <span class="text-white-50">${totalVideos} videos</span>
        `;

    } catch (error) {
        console.error("Error stats:", error);
        statsElement.innerHTML = `<span class="text-white-50">Calculando...</span>`;
    }
}
}


class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('main-video') || document.getElementById('main-player');
        
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src');
        }

        this.container = document.getElementById('video-container');
        this.menu = document.getElementById('clinic-menu');
        this.weatherWidget = document.getElementById('weather-widget');

        this.queue = [];          
        this.currentIndex = 0;    

        this.playerSection = document.querySelector('.player-section');
        
        this.fadeStarted = false;
        this.audioFadeStarted = false;
        this.audioFadeInterval = null;
        this.isLoading = false; 
        this.currentObjectUrl = null; 

        // Variables para sistema de intensidades
        this.videosBAJA = [];
        this.videosALTA = [];
        this.videosMEDIA = [];
        this.bajaIndex = 0;
        this.altaIndex = 0;
        this.mediaIndex = 0;
        this.startTime = null; // Tiempo de inicio de reproducción
        this.nextAltaTime = 0; // Próximo momento para reproducir ALTA (en ms desde startTime)
        this.nextMediaTime = 0; // Próximo momento para reproducir MEDIA (en ms desde startTime)
        this.intensityMode = false; // Indica si estamos usando el modo de intensidades

        // Eventos del Video
        if (this.videoElement) {
            // Usamos 'addEventListener' para ser más seguros
            this.videoElement.addEventListener('ended', () => this.onVideoEnded());
            
            this.videoElement.addEventListener('error', (e) => {
                console.error("❌ Error playback, recuperando...", e);
                this.resetFlags();
                const next = this.intensityMode ? () => this.playNextWithIntensity() : () => this.playNextCycle();
                setTimeout(next, 1000);
            });
        }
    }

    // --- 1. FUNCIÓN DE ENTRADA CON INTENSIDADES ---
    startQueueWithIntensity(videosBAJA, videosALTA, videosMEDIA) {
        if ((!videosBAJA || videosBAJA.length === 0) && 
            (!videosALTA || videosALTA.length === 0) && 
            (!videosMEDIA || videosMEDIA.length === 0)) {
            return alert("Lista vacía");
        }

        if (this.videoElement) {
            this.videoElement.pause();
            this.resetFlags();
        }

        this.videosBAJA = videosBAJA || [];
        this.videosALTA = videosALTA || [];
        this.videosMEDIA = videosMEDIA || [];
        this.orderedSequence = typeof buildOrderedSequence === 'function'
            ? buildOrderedSequence(this.videosBAJA, this.videosALTA, this.videosMEDIA)
            : [];
        this.sequenceIndex = 0;
        this.intensityMode = true;

        document.body.classList.add('tv-started');
        if (this.menu) this.menu.classList.add('slide-up');
        if (this.container) {
            this.container.classList.remove('d-none');
            this.container.classList.add('d-block');
        }
        if (this.weatherWidget) this.weatherWidget.style.display = 'block';

        console.log(`📺 Player iniciado: ${this.orderedSequence.length} ítems`);
        this.playNextWithIntensity();
    }

    // --- FUNCIÓN DE ENTRADA LEGACY (sin intensidades) ---
    startQueue(generatedList) {
        // 1. Validaciones
        if (!generatedList || generatedList.length === 0) return alert("Lista vacía");

        // 2. Detener reproducción anterior
        if (this.videoElement) {
            this.videoElement.pause();
            this.resetFlags();
        }

        // 3. Cargar nueva lista (modo legacy sin intensidades)
        this.queue = generatedList;
        this.currentIndex = 0;
        this.intensityMode = false;
        console.log(`📺 Player recibió ${this.queue.length} videos (modo legacy).`);

        // 4. MANEJO DE INTERFAZ (solo al dar INICIAR TV)
        document.body.classList.add('tv-started');
        if (this.menu) this.menu.classList.add('slide-up');
        if (this.container) {
            this.container.classList.remove('d-none');
            this.container.classList.add('d-block');
        }
        if (this.weatherWidget) this.weatherWidget.style.display = 'block';

        // 5. Arrancar el ciclo
        this.playNextCycle();
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
            this.videoElement.classList.remove('video-fade-out'); // Limpiar clase CSS
        }
    }

    onVideoEnded() {
        if (this.fadeStarted) return;
        if (this.isLoading) return; // Ignorar 'ended' fantasma al cambiar src (evita doble siguiente y pantalla negra)
        this.fadeStarted = true;

        this.isLoading = false;

        console.log("🏁 Video terminado. Iniciando transición...");

        // Iniciar Fade de Audio
        if (!this.audioFadeStarted) {
            this.audioFadeStarted = true;
            this.fadeOutAudio(2); // Reducido a 2s para agilidad (opcional)
        }
        
        // Iniciar Fade de Video (CSS)
        if (this.videoElement) this.videoElement.classList.add('video-fade-out');
        
        // Esperamos un momento breve y lanzamos el siguiente
        // (Coordinado con la animación CSS)
        setTimeout(() => {
            if (this.intensityMode) {
                this.playNextWithIntensity();
            } else {
                this.playNextCycle();
            }
        }, 1000); 
    }

    fadeOutAudio(duration) {
        if (!this.videoElement) return;
        if (this.audioFadeInterval) clearInterval(this.audioFadeInterval);
        
        const startVolume = this.videoElement.volume;
        const startTime = Date.now();
        
        this.audioFadeInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / (duration * 1000), 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            // Evitar errores si el video ya no existe
            if(this.videoElement) {
                this.videoElement.volume = Math.max(0, startVolume * (1 - easeOut));
            }
            
            if (progress >= 1) {
                clearInterval(this.audioFadeInterval);
                if(this.videoElement) this.videoElement.volume = 0;
            }
        }, 50);
    }

    // --- 2. CICLO POR ORDEN (misma secuencia que Visualizador; solo se repite al terminar la lista) ---
    async playNextWithIntensity() {
        if (this.isLoading && this.currentObjectUrl) return;

        if (!this.orderedSequence || this.orderedSequence.length === 0) {
            this.isLoading = false;
            console.warn("⚠️ Secuencia vacía.");
            return;
        }

        this.isLoading = true;
        this.resetFlags();

        const item = this.orderedSequence[this.sequenceIndex];
        this.sequenceIndex = (this.sequenceIndex + 1) % this.orderedSequence.length;
        if (this.sequenceIndex === 0) {
            console.log("🔄 Lista completada: se repite el orden del Visualizador.");
        }

        await this.playVideoFile(item.video, item.intensity);
    }

    // --- 2. CICLO LEGACY (sin intensidades) ---
    async playNextCycle() {
        // Evitar doble carga simultánea
        if (this.isLoading && this.currentObjectUrl) return; 
        
        this.isLoading = true;
        this.resetFlags(); // Reseteamos volumen y clases antes de cargar

        if (!this.queue || this.queue.length === 0) {
            console.warn("⚠️ Lista vacía.");
            this.isLoading = false;
            return;
        }

        // Loop Infinito
        if (this.currentIndex >= this.queue.length) {
            console.log("🔄 Reiniciando lista...");
            this.currentIndex = 0;
        }

        const nextVideo = this.queue[this.currentIndex];
        this.currentIndex++; // Avanzamos índice

        await this.playVideoFile(nextVideo);
    }

    // --- 3. CARGA (BLOB) ---
    async playVideoFile(video, intensity = null) {
    if (!this.videoElement) return;
    if (!video || !video.id) {
        console.warn("⚠️ Video sin id, saltando...", video);
        this.isLoading = false;
        const next = this.intensityMode ? () => this.playNextWithIntensity() : () => this.playNextCycle();
        setTimeout(next, 500);
        return;
    }

    const intensityLabel = intensity ? ` [${intensity}]` : '';
    const sizeMB = video.size != null ? (Number(video.size) / (1024 * 1024)).toFixed(2) : '?';
    const durationSec = (video.videoMediaMetadata && video.videoMediaMetadata.durationMillis) ? (Number(video.videoMediaMetadata.durationMillis) / 1000).toFixed(1) : '?';
    console.log(`🎬 Cargando: "${video.name || video.id}"${intensityLabel} | tamaño: ${sizeMB} MB | duración: ${durationSec} s`);
    this.isLoading = true;

    // Limpiar estado del video anterior
    this.videoElement.classList.remove('video-fade-out', 'video-visible');
    this.videoElement.volume = 1;
    // Modo por defecto hasta que tengamos dimensiones reales (evita dejar vertical del video anterior si el nuevo reporta 0x0)
    if (this.playerSection) {
        this.playerSection.classList.add('is-horizontal-mode');
        this.playerSection.classList.remove('is-vertical-mode');
    }
    this.fadeStarted = false;
    this.audioFadeStarted = false;
    if (this.audioFadeInterval) {
        clearInterval(this.audioFadeInterval);
        this.audioFadeInterval = null;
    }

    try {
        let token = null;
        if (window.clinicManager && typeof window.clinicManager.ensureValidToken === 'function') {
            await window.clinicManager.ensureValidToken();
            token = window.clinicManager.accessToken || localStorage.getItem('google_access_token');
            if (token && window.clinicManager.accessToken) {
                localStorage.setItem('google_access_token', window.clinicManager.accessToken);
                localStorage.setItem('google_token_expiration', String(window.clinicManager.tokenExpiration || 0));
            }
        }
        if (!token) token = localStorage.getItem('google_access_token');
        if (!token && typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken()) {
            token = gapi.client.getToken().access_token;
        }
        if (!token) throw new Error("No hay token disponible");

        const url = `https://www.googleapis.com/drive/v3/files/${video.id}?alt=media`;
        const doFetch = (t) => fetch(url, { headers: { 'Authorization': `Bearer ${t}` } });
        let response = await doFetch(token);
        if (response.status === 401 && window.clinicManager && typeof window.clinicManager.ensureValidToken === 'function') {
            window.clinicManager.tokenExpiration = 0;
            await window.clinicManager.ensureValidToken();
            const newToken = window.clinicManager.accessToken || localStorage.getItem('google_access_token');
            if (newToken) { response = await doFetch(newToken);
                if (response.ok && window.clinicManager.accessToken) {
                    localStorage.setItem('google_access_token', window.clinicManager.accessToken);
                    localStorage.setItem('google_token_expiration', String(window.clinicManager.tokenExpiration || 0));
                }
            }
        }
        if (!response.ok) {
            this.isLoading = false;
            const next = this.intensityMode ? () => this.playNextWithIntensity() : () => this.playNextCycle();
            if (response.status === 403 || response.status === 404) {
                console.warn(`⏭ Saltando "${video.name || video.id}": Drive devolvió ${response.status}. Si en la carpeta dice "Procesando", espera a que termine o vuelve a subir el archivo.`);
                setTimeout(next, 800);
            } else {
                console.error(`❌ Error en Drive: ${response.status}`);
                setTimeout(next, 2000);
            }
            return;
        }
        const blob = await response.blob();
        const newObjectUrl = URL.createObjectURL(blob);
        const oldUrl = this.currentObjectUrl;
        this.currentObjectUrl = newObjectUrl;

        this.videoElement.classList.remove('video-fade-out');
        this.videoElement.style.opacity = "0";

        if (this._showVideoTimeout) {
            clearTimeout(this._showVideoTimeout);
            this._showVideoTimeout = null;
        }

        // Reset del elemento para que la siguiente carga dispare eventos correctamente (evita negro en 3.º, 5.º, etc.)
        this.videoElement.pause();
        this.videoElement.currentTime = 0;

        let shown = false;
        const showVideo = () => {
            if (shown) return;
            if (this.currentObjectUrl !== newObjectUrl) return;
            shown = true;
            if (this._showVideoTimeout) {
                clearTimeout(this._showVideoTimeout);
                this._showVideoTimeout = null;
            }
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            this.videoElement.classList.remove('video-fade-out');
            this.videoElement.classList.add('video-visible');
            this.videoElement.style.setProperty('opacity', '1', 'important');
            this.isLoading = false;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (this.currentObjectUrl !== newObjectUrl) return;
                    this.videoElement.classList.add('video-visible');
                    this.videoElement.style.setProperty('opacity', '1', 'important');
                    void this.videoElement.offsetHeight;
                });
            });
            // Forzar que el navegador pinte el frame (algunos codecs suenan pero no muestran imagen)
            const forcePaint = () => {
                if (this.currentObjectUrl !== newObjectUrl || !this.videoElement.src) return;
                const v = this.videoElement;
                v.classList.add('video-visible');
                v.style.setProperty('opacity', '1', 'important');
                v.style.removeProperty('visibility');
                if (v.readyState >= 2) {
                    const t = v.currentTime;
                    v.currentTime = t + 0.001;
                    v.currentTime = t;
                }
            };
            if (typeof this.videoElement.requestVideoFrameCallback === 'function') {
                this.videoElement.requestVideoFrameCallback(forcePaint);
            }
            setTimeout(forcePaint, 150);
            setTimeout(forcePaint, 500);
        };

        // 4. Actualizar modo vertical/horizontal solo cuando haya dimensiones válidas (evita negro si el codec reporta 0x0 o tarde)
        const applyOrientation = () => {
            if (!this.playerSection || this.currentObjectUrl !== newObjectUrl) return;
            const w = this.videoElement.videoWidth || 0;
            const h = this.videoElement.videoHeight || 0;
            if (w > 0 && h > 0) {
                if (h > w) {
                    this.playerSection.classList.add('is-vertical-mode');
                    this.playerSection.classList.remove('is-horizontal-mode');
                } else {
                    this.playerSection.classList.add('is-horizontal-mode');
                    this.playerSection.classList.remove('is-vertical-mode');
                }
            }
            // Si w o h son 0, no tocamos el modo (dejamos el anterior o el que venga por defecto) para no romper el layout
        };

        this.videoElement.onloadedmetadata = () => {
            showVideo();
            applyOrientation();
        };

        this.videoElement.onloadeddata = () => {
            applyOrientation();
            this.videoElement.play().then(() => {
                showVideo();
                applyOrientation();
                console.log("✅ Reproduciendo ahora.");
            }).catch(err => {
                console.warn("Autoplay bloqueado, intentando sin audio...", err);
                this.videoElement.muted = true;
                this.videoElement.play();
                showVideo();
                applyOrientation();
            });
        };

        this.videoElement.addEventListener('playing', () => {
            const w = this.videoElement.videoWidth || 0;
            const h = this.videoElement.videoHeight || 0;
            if (w === 0 || h === 0) {
                console.warn(`⚠️ "${video.name || video.id}" está en reproducción pero el navegador reporta dimensiones 0×0. Es probable que el CODEC de vídeo no sea compatible (solo se decodifica el audio). Prueba abrir el mismo archivo en VLC o en la vista previa de Drive: si ahí también se ve negro, el archivo tiene el vídeo dañado o en un codec no soportado.`);
            } else {
                console.log(`✅ Reproduciendo: ${w}×${h}`);
            }
            applyOrientation();
            showVideo();
        }, { once: true });
        this.videoElement.addEventListener('canplay', () => { showVideo(); }, { once: true });
        this.videoElement.addEventListener('canplaythrough', () => { showVideo(); }, { once: true });
        this.videoElement.addEventListener('timeupdate', () => { showVideo(); }, { once: true });

        // 5. Asignar nuevo src (después del reset para que el elemento emita eventos de carga)
        this.videoElement.src = this.currentObjectUrl;
        this.videoElement.load();

        // Red de seguridad: si en 2.5 s no se disparó ningún evento, forzar visibilidad
        this._showVideoTimeout = setTimeout(() => {
            this._showVideoTimeout = null;
            showVideo();
        }, 2500);

    } catch (error) {
        console.error("❌ Error fatal cargando archivo:", error);
        if (this._showVideoTimeout) {
            clearTimeout(this._showVideoTimeout);
            this._showVideoTimeout = null;
        }
        this.isLoading = false;
        const next = this.intensityMode ? () => this.playNextWithIntensity() : () => this.playNextCycle();
        setTimeout(next, 2000);
    }
}
}

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('hora');
    const dateEl = document.getElementById('fecha');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if (dateEl) dateEl.innerText = now.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '').toUpperCase();
}

async function updateWeather() {
    try {
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-18.47&longitude=-70.30&current_weather=true');
        const data = await response.json();
        if (data.current_weather) {
            const tempEl = document.getElementById('temperatura');
            if (tempEl) tempEl.innerText = `${Math.round(data.current_weather.temperature)}°C`;
        }
    } catch (e) { console.error("Clima off"); }
}

// NOTA: La inicialización de ClinicManager se hace en el DOMContentLoaded principal (línea 167)
// Esta inicialización duplicada fue eliminada para evitar conflictos

// Inicializar reloj y clima (estas funciones son independientes y pueden ejecutarse múltiples veces sin problema)
document.addEventListener('DOMContentLoaded', () => {
    updateClock(); 
    setInterval(updateClock, 1000);
    updateWeather(); 
    setInterval(updateWeather, 1800000);
});

// Variable global unificada para la selección de playlist
window.currentPlaylistSelection = window.currentPlaylistSelection || []; 

// NOTA: openScheduleManager() fue eliminada porque no se usa en ningún lugar.
// Se usa prepararYMostrarPlaylist() en su lugar, que es la función activa.

// NOTA: ScheduleManager ya se inicializa en el DOMContentLoaded principal (línea 167)
// No crear otra instancia aquí para evitar duplicados

function updateBottomBar() {
    const checkboxes = document.querySelectorAll('.folder-checkbox:checked');
    const count = checkboxes.length;
    const bar = document.getElementById('bottom-action-bar');
    const counterText = document.getElementById('selection-counter');

    if (counterText) counterText.innerText = count;

    if (count > 0) {
        bar.classList.remove('d-none');
        bar.classList.add('d-block');
    } else {
        bar.classList.add('d-none');
        bar.classList.remove('d-block');
    }
}

document.addEventListener('click', function(e) {
    if (e.target.closest('.btn-close') || e.target.closest('[data-bs-dismiss="modal"]') || e.target.innerText === "Cerrar" || e.target.innerText.includes("Volver")) {
        
        console.log("🧹 Limpiando residuos del modal...");
        
        setTimeout(() => {
            const backdrops = document.querySelectorAll('.modal-backdrop');
            backdrops.forEach(backdrop => backdrop.remove());

            document.body.classList.remove('modal-open');
            document.body.style.overflow = 'auto';
            document.body.style.paddingRight = '0';
        }, 300);
    }
});

function guardarPlaylistDesdeUI() {
    console.log("💾 Intentando guardar playlist...");

    // 1. OBTENER LOS ELEMENTOS EXACTOS DE TU HTML
    const nameInput = document.getElementById('playlist-name-input');
    const startInput = document.getElementById('date-start'); // ID corregido según tu HTML
    const endInput = document.getElementById('date-end');     // ID corregido según tu HTML

    // 2. VALIDAR QUE EXISTAN (Seguridad)
    if (!nameInput || !startInput || !endInput) {
        console.error("Error: No encuentro los inputs. IDs buscados: playlist-name-input, date-start, date-end");
        alert("Error interno: Faltan campos en la interfaz.");
        return;
    }

    // 3. RECUPERAR DATOS
    const name = nameInput.value;
    const start = startInput.value;
    const end = endInput.value;
    
    // Recuperar carpetas seleccionadas: currentPlaylistSelection o, si está vacía, playlistSelection (Map)
    let seleccion = window.currentPlaylistSelection && window.currentPlaylistSelection.length > 0
        ? window.currentPlaylistSelection
        : (window.clinicManager && window.clinicManager.playlistSelection && window.clinicManager.playlistSelection.size > 0
            ? Array.from(window.clinicManager.playlistSelection.keys())
            : []);

    // 4. VALIDACIONES LÓGICAS
    if (!name) {
        alert("⚠️ Por favor, escribe un nombre para la playlist.");
        return;
    }
    if (seleccion.length === 0) {
        alert("⚠️ No has seleccionado ninguna carpeta. Marca carpetas en el constructor y luego usa 'Programar playlist' en la barra, o vuelve al constructor y entra de nuevo al programador.");
        return;
    }
    // Nota: Si quieres permitir guardar sin fechas, quita este if
    if (!start || !end) {
        alert("⚠️ Por favor, selecciona las fechas de inicio y fin en el calendario (Panel derecho).");
        return;
    }

    // 5. GUARDAR (Llamada a la clase)
    if (window.scheduleManager) {
        const exito = window.scheduleManager.savePlaylist(name, start, end, seleccion);

        if (exito) {
            // Limpiar campos
            nameInput.value = '';
            startInput.value = '';
            endInput.value = '';
            
            // Actualizar el menú desplegable de "Cargar Playlist"
            renderSavedPlaylists();
            
            // No poner la playlist en "Programación activa" al guardar.
            // Solo entra ahí cuando el usuario pulse "Activar" en esa playlist.
        }
    } else {
        alert("Error: El sistema (ScheduleManager) no está listo.");
    }
}

function renderSavedPlaylists() {
    const container = document.getElementById('saved-playlists-container');
    
    // Validación de seguridad
    if (!container || !window.scheduleManager) return;

    const playlists = window.scheduleManager.playlists || [];
    container.innerHTML = '';

    if (playlists.length === 0) {
        container.innerHTML = '<p class="text-muted small text-center my-3">No hay playlists guardadas.</p>';
        return;
    }

    playlists.forEach(p => {
        const item = document.createElement('div');
        // Mantenemos exactamente tus clases de diseño originales
        item.className = 'd-flex justify-content-between align-items-center bg-dark border border-secondary p-1 px-2 rounded mb-1';
    
        item.innerHTML = `
            <div class="d-flex align-items-center flex-grow-1" style="cursor: pointer;" onclick="verDetallesPlaylist('${p.id}')">
                <div class="me-2 fs-5">💿</div> 
                <div class="overflow-hidden">
                    <div class="d-flex align-items-center">
                        <span class="text-warning fw-bold text-truncate me-2" style="max-width: 120px;">${p.name}</span>
                        <span class="text-white-50 small" style="font-size: 0.75rem;">(${p.folders.length} carpetas)</span>
                    </div>
                </div>
            </div>

            <div class="d-flex align-items-center gap-1">
                <button class="btn btn-outline-success btn-sm py-0 px-2 me-1" 
                        onclick="event.stopPropagation(); activarPlaylist('${p.id}')" 
                        title="Poner en pantalla ahora">
                    ▶ Activar
                </button>

                <button class="btn btn-outline-danger btn-sm py-0 px-2" 
                        onclick="borrarPlaylist('${p.id}', event)" 
                        title="Eliminar">
                    ×
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

// Función auxiliar para borrar
function borrarPlaylist(id, event) {
    // Evita que el clic active el "ver detalles" del contenedor padre
    event.stopPropagation(); 

    if (confirm("¿Estás seguro de que quieres ELIMINAR esta playlist?")) {
        // Llamamos al manager para borrarla de la memoria
        window.scheduleManager.deletePlaylist(id);
        
        // Volvemos a pintar la lista actualizada
        renderSavedPlaylists();
    }
}

// NOTA: verDetallesPlaylist está definida más abajo (línea 1903) con la implementación completa
// Esta función placeholder fue eliminada para evitar duplicados

function prepararYMostrarPlaylist() {
    console.log("🔄 Preparando datos para la playlist...");

    // 1. Obtener selección: primero de checkboxes, si está vacía usar playlistSelection (Map)
    const checkboxes = document.querySelectorAll('.folder-checkbox:checked');
    let seleccionados = Array.from(checkboxes).map(cb => cb.value);
    if (seleccionados.length === 0 && window.clinicManager && window.clinicManager.playlistSelection && window.clinicManager.playlistSelection.size > 0) {
        seleccionados = Array.from(window.clinicManager.playlistSelection.keys());
    }

    // 2. Guardar en la variable global que usa el botón Guardar
    window.currentPlaylistSelection = seleccionados;

    console.log("✅ IDs capturados:", window.currentPlaylistSelection);

    if (seleccionados.length === 0) {
        alert("⚠️ No hay carpetas seleccionadas. Marca algunas casillas en la lista del constructor y vuelve a intentar.");
        return;
    }

    // 4. Actualizamos la lista visual en el paso de Playlist (Opcional, pero recomendado)
    const previewContainer = document.getElementById('playlist-preview-list');
    const badge = document.getElementById('selected-count-badge');
    
    if (previewContainer) {
        previewContainer.innerHTML = ''; // Limpiar
        // Recorremos los checkboxes para sacar también el nombre (data-name o el label cercano)
        checkboxes.forEach(cb => {
            // Intentamos obtener el nombre. Si no tienes data-name, intentamos buscar el label
            let nombre = cb.getAttribute('data-folder-name') || "Carpeta " + cb.value;
            
            const div = document.createElement('div');
            div.className = "border-bottom border-secondary py-1";
            div.innerHTML = `Running: <span class="text-info">${nombre}</span>`;
            previewContainer.appendChild(div);
        });
    }

    if (badge) {
        badge.innerText = `${seleccionados.length} carpetas`;
    }

    // NOTA: Se eliminó la línea que sobrescribía currentPlaylistSelection porque ya se estableció arriba
    // Si clinicManager.playlistSelection tiene datos adicionales, se pueden combinar así:
    if (window.clinicManager && window.clinicManager.playlistSelection && window.clinicManager.playlistSelection.size > 0) {
        const mapSelection = Array.from(window.clinicManager.playlistSelection.keys());
        // Combinar ambas fuentes, evitando duplicados
        window.currentPlaylistSelection = [...new Set([...window.currentPlaylistSelection, ...mapSelection])];
    }

    if (window.clinicManager) {
        window.clinicManager.showStep('step-playlist');
    } else {
        // Fallback manual por si acaso
        document.getElementById('step-dashboard').classList.remove('d-block');
        document.getElementById('step-dashboard').classList.add('d-none');
        document.getElementById('step-playlist').classList.remove('d-none');
        document.getElementById('step-playlist').classList.add('d-block');
    }
}

/**
 * Abrir el programador de playlist (desde la barra flotante u otro lugar).
 */
function abrirProgramadorPlaylist() {
    const previewContainer = document.getElementById('playlist-preview-list');
    const badge = document.getElementById('selected-count-badge');
    if (previewContainer) {
        previewContainer.innerHTML = `<div class="text-center py-3 text-white-50 small">No hay carpetas</div>
            <button type="button" class="btn btn-outline-info btn-sm w-100 mt-2" onclick="clinicManager.showStep('step-dashboard')">Ir a agregar</button>`;
    }
    if (badge) badge.innerText = '0 carpetas';
    if (window.clinicManager) {
        window.clinicManager.showStep('step-playlist');
    } else {
        const dash = document.getElementById('step-dashboard');
        const play = document.getElementById('step-playlist');
        if (dash && play) {
            dash.classList.add('d-none'); dash.classList.remove('d-block');
            play.classList.remove('d-none'); play.classList.add('d-block');
        }
    }
}

/** Duración por defecto por video (segundos) cuando no está guardada. */
const DEFAULT_VIDEO_DURATION_SEC = 120;

/**
 * Construye el orden de reproducción según reglas de intensidad:
 * - Solo el tiempo de los videos BAJA (comunes) cuenta para los intervalos.
 * - Cada 5 min de tiempo de BAJA → se inserta un video ALTA (su duración no cuenta).
 * - Cada 8 min de tiempo de BAJA → se inserta un video MEDIA (su duración no cuenta).
 * - Si se acaban los BAJA pero aún hay ALTA/MEDIA por insertar, se recicla la lista BAJA desde el inicio
 *   para seguir "llenando" tiempo (tanque que se llena con BAJA y se drena con ALTA/MEDIA).
 * @returns {Array<{video: object, intensity: string}>}
 */
function buildOrderedSequence(shuffledBaja, shuffledAlta, shuffledMedia) {
    const getDurSec = (v) => {
        if (v.durationSec != null && typeof v.durationSec === 'number') return v.durationSec;
        const millis = v.videoMediaMetadata && v.videoMediaMetadata.durationMillis;
        if (millis != null) return Number(millis) / 1000;
        return DEFAULT_VIDEO_DURATION_SEC;
    };
    const baja = (shuffledBaja || []).map(v => ({ ...v, _dur: getDurSec(v) }));
    const alta = (shuffledAlta || []).map(v => ({ ...v, _dur: getDurSec(v) }));
    const media = (shuffledMedia || []).map(v => ({ ...v, _dur: getDurSec(v) }));

    const sequence = [];
    let timeSec = 0; // Solo aumenta con videos BAJA
    const ALTA_INTERVAL_SEC = 5 * 60;
    const MEDIA_INTERVAL_SEC = 8 * 60;
    let nextAltaSec = ALTA_INTERVAL_SEC;
    let nextMediaSec = MEDIA_INTERVAL_SEC;
    let bi = 0, ai = 0, mi = 0;
    const maxItems = 2000;

    while (sequence.length < maxItems) {
        let chosen = null;
        let intensity = 'BAJA';

        if (ai < alta.length && timeSec >= nextAltaSec) {
            chosen = alta[ai++];
            intensity = 'ALTA';
            nextAltaSec += ALTA_INTERVAL_SEC;
            // NO sumar chosen._dur a timeSec: el tiempo de ALTA no cuenta
        } else if (mi < media.length && timeSec >= nextMediaSec) {
            chosen = media[mi++];
            intensity = 'MEDIA';
            nextMediaSec += MEDIA_INTERVAL_SEC;
            // NO sumar chosen._dur a timeSec: el tiempo de MEDIA no cuenta
        } else if (baja.length > 0) {
            chosen = baja[bi++];
            intensity = 'BAJA';
            timeSec += chosen._dur;
            if (bi >= baja.length) bi = 0; // Reciclar: volver a usar BAJA desde el inicio para seguir llenando tiempo
        } else if (ai < alta.length || mi < media.length) {
            // Sin videos BAJA y aún hay ALTA/MEDIA: avanzar reloj e insertar el siguiente (caso borde)
            timeSec = Math.min(
                ai < alta.length ? nextAltaSec : Infinity,
                mi < media.length ? nextMediaSec : Infinity
            );
            continue;
        } else {
            break;
        }
        if (chosen) sequence.push({ video: chosen, intensity });
    }
    return sequence;
}

/**
 * Abre la vista "Visualizar Playlist" con la programación activa y el orden de reproducción.
 */
function abrirVisualizarPlaylist() {
    if (window.clinicManager) {
        window.clinicManager.showStep('step-visualizar');
    } else {
        const dash = document.getElementById('step-dashboard');
        const vis = document.getElementById('step-visualizar');
        if (dash && vis) {
            dash.classList.add('d-none'); dash.classList.remove('d-block');
            vis.classList.remove('d-none'); vis.classList.add('d-block');
        }
        renderVisualizarPlaylist();
    }
}

/**
 * Rellena la vista "Visualizar Playlist": programa activa, vigencia y orden de videos (con intensidad).
 */
function renderVisualizarPlaylist() {
    const container = document.getElementById('visualizar-content');
    if (!container) return;

    const raw = localStorage.getItem('activeScheduleData');
    if (!raw) {
        container.innerHTML = `
            <div class="alert alert-warning bg-dark border-warning text-start">
                <strong>No hay programación activa.</strong><br>
                Activa una playlist desde "Programación de Playlist" (guardada → Activar) y luego podrás ver aquí su contenido y orden de reproducción.
            </div>
            <button class="btn btn-outline-light btn-sm mt-2" onclick="clinicManager.showStep('step-playlist')">Ir a Programación</button>
        `;
        return;
    }

    let active;
    try {
        active = JSON.parse(raw);
    } catch (e) {
        container.innerHTML = '<div class="text-danger">Error al leer programación activa.</div>';
        return;
    }

    const hasMix = (active.shuffledBaja && active.shuffledBaja.length) ||
                  (active.shuffledAlta && active.shuffledAlta.length) ||
                  (active.shuffledMedia && active.shuffledMedia.length);

    if (!hasMix) {
        container.innerHTML = `
            <div class="alert alert-info bg-dark border-info text-start">
                <strong>${active.name || 'Playlist'}</strong><br>
                Vigencia: ${active.start || '?'} al ${active.end || '?'}.<br>
                Esta playlist está activa pero aún no se ha generado el mix. Actívala de nuevo para aleatorizar el contenido.
            </div>
        `;
        return;
    }

    const sequence = buildOrderedSequence(active.shuffledBaja, active.shuffledAlta, active.shuffledMedia);
    const vigencia = (active.start && active.end) ? `Vigencia: ${active.start} al ${active.end}` : 'Sin fechas';

    let listHtml = sequence.map((item, i) => {
        const name = (item.video && item.video.name) ? item.video.name : 'Sin nombre';
        const int = (item.intensity || 'BAJA').toLowerCase();
        const badgeClass = item.intensity === 'ALTA' ? 'bg-danger' : item.intensity === 'MEDIA' ? 'bg-warning text-dark' : 'bg-success';
        return `<div class="d-flex align-items-center py-2 border-bottom border-secondary border-opacity-25">
            <span class="text-white-50 me-3" style="min-width: 2rem">${i + 1}.</span>
            <span class="text-white text-truncate flex-grow-1" title="${name}">${name}</span>
            <span class="badge ${badgeClass} ms-2">${int}</span>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="mb-4">
            <h5 class="text-white mb-1">${active.name || 'Playlist'}</h5>
            <p class="text-white-50 small mb-0">${vigencia}</p>
        </div>
        <h6 class="text-white-50 mb-2">Orden de reproducción (según duración e intensidad: ALTA cada 5 min, MEDIA cada 8 min)</h6>
        <div class="bg-dark rounded border border-secondary p-2" style="max-height: 400px; overflow-y: auto;">
            ${listHtml || '<p class="text-muted small">Sin ítems.</p>'}
        </div>
        <p class="text-white-50 small mt-2 mb-0">Total: ${sequence.length} ítems. Duración por video por defecto: ${DEFAULT_VIDEO_DURATION_SEC / 60} min (si no está guardada).</p>
    `;
}

setTimeout(() => {
    renderSavedPlaylists();
}, 500);

let playlistSeleccionadaParaReproducir = null; // Variable global temporal

function verDetallesPlaylist(id) {
    const playlist = window.scheduleManager.playlists.find(p => p.id === id);
    if (!playlist) return;

    playlistSeleccionadaParaReproducir = playlist;

    document.getElementById('modalPlaylistName').innerText = playlist.name;
    document.getElementById('modalPlaylistDates').innerText = `${playlist.start} al ${playlist.end}`;
    document.getElementById('modalPlaylistCount').innerText = `${playlist.folders.length} Carpeta(s)`;

    const contentDiv = document.getElementById('modalPlaylistContent');
    contentDiv.innerHTML = '';

    let totalVideosCount = 0;
    const totalEl = document.createElement('p');
    totalEl.id = 'playlist-modal-total-videos';
    totalEl.className = 'text-white-50 small mt-3 mb-0';
    totalEl.style.opacity = '0.85';
    totalEl.innerText = 'Total: — videos';
    contentDiv.appendChild(totalEl);

    const onFolderDone = (count) => {
        totalVideosCount += count;
        totalEl.innerText = `Total: ${totalVideosCount} videos`;
    };

    playlist.folders.forEach(folderId => {
        const folderData = window.clinicManager && window.clinicManager.allFolders
            ? window.clinicManager.allFolders.find(f => f.id === folderId) : null;
        const folderName = folderData ? folderData.name : "Carpeta de Playlist";

        const folderEl = document.createElement('div');
        folderEl.className = 'bg-secondary bg-opacity-10 p-2 rounded mb-2 border-start border-info border-3';
        folderEl.innerHTML = `
            <div class="fw-bold text-info small">📁 ${folderName}</div>
            <div class="ps-3 mt-1 d-flex align-items-center gap-2 flex-wrap">
                <span id="count-of-${folderId}" class="small text-white-50">— videos</span>
                <button type="button" class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size: 0.75rem;" onclick="togglePlaylistFolderList('${folderId}')" id="btn-toggle-${folderId}">▼ Ver lista</button>
            </div>
            <div id="list-of-${folderId}" class="ps-3 mt-1 small text-white-50" style="display:none; font-size: 0.8rem;"></div>
        `;
        contentDiv.insertBefore(folderEl, totalEl);

        obtenerVideosDeCarpeta(folderId, onFolderDone);
    });

    const modalElement = document.getElementById('playlistDetailsModal');
    const myModal = new bootstrap.Modal(modalElement);
    myModal.show();
}

// Lista videos de una carpeta (incluye subcarpetas/bloques). Actualiza count + lista oculta; el usuario despliega con "Ver lista".
async function obtenerVideosDeCarpeta(folderId, onDone) {
    const countEl = document.getElementById(`count-of-${folderId}`);
    const listEl = document.getElementById(`list-of-${folderId}`);
    if (!countEl || !listEl) return;

    try {
        const manager = window.clinicManager;
        const videos = manager ? await manager.fetchVideosFromFolder(folderId) : [];
        const n = videos ? videos.length : 0;

        countEl.textContent = n === 1 ? '1 video' : `${n} videos`;
        if (n > 0) {
            listEl.innerHTML = videos.map(v => `• ${v.name}`).join('<br>');
        } else {
            listEl.innerHTML = '<span class="fst-italic">No se encontraron videos.</span>';
        }
        if (typeof onDone === 'function') onDone(n);
    } catch (e) {
        console.error("Error listando videos de carpeta:", e);
        countEl.textContent = '0 videos';
        listEl.innerHTML = '<span class="text-muted small">No se pudo cargar la lista.</span>';
        if (typeof onDone === 'function') onDone(0);
    }
}

function togglePlaylistFolderList(folderId) {
    const listEl = document.getElementById(`list-of-${folderId}`);
    const btn = document.getElementById(`btn-toggle-${folderId}`);
    if (!listEl || !btn) return;
    const isHidden = listEl.style.display === 'none';
    listEl.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? '▲ Ocultar lista' : '▼ Ver lista';
}

function reproducirPlaylistActual() {
    if (!playlistSeleccionadaParaReproducir) return;
    
    alert(`🎬 Iniciando reproducción de: ${playlistSeleccionadaParaReproducir.name}\n(Aquí conectaremos con tu reproductor de video)`);
    
    // Aquí es donde en el futuro llamarás a tu función de pantalla completa
    // Por ejemplo: iniciarReproductor(playlistSeleccionadaParaReproducir.folders);
}

function desactivarProgramacion() {
    if(!confirm("¿Deseas quitar la programación activa?")) return;

    // 1. Borrar de la memoria
    localStorage.removeItem('activeScheduleData');
    window.currentPlaylistSelection = []; // Limpiar variable del TV

    // 2. Limpiar UI (volver al mensaje "No hay programación")
    const activeContainer = document.getElementById('schedule-list');
    if(activeContainer) {
        activeContainer.innerHTML = '<div class="text-center text-muted py-4 small">No hay programación definida.</div>';
    }

    // 3. Limpiar fechas
    document.getElementById('date-start').value = '';
    document.getElementById('date-end').value = '';
}


function cargarProgramacionVisual(playlist) {
    window.currentPlaylistSelection = playlist.folders || [];

    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    if (startInput) startInput.value = playlist.start || '';
    if (endInput) endInput.value = playlist.end || '';

    const activeContainer = document.getElementById('schedule-list');
    if (!activeContainer) return;

    activeContainer.innerHTML = '';
    const count = (playlist.folders || []).length;
    const vigencia = (playlist.start && playlist.end) 
        ? `Vigencia: ${playlist.start} al ${playlist.end}` 
        : 'Sin fechas';

    const card = document.createElement('div');
    card.className = "position-relative p-3 rounded border border-success";
    card.style.background = "linear-gradient(45deg, rgba(25, 135, 84, 0.2), rgba(20, 20, 20, 0.8))";

    card.innerHTML = `
        <button onclick="desactivarProgramacion()" 
                class="btn btn-sm btn-outline-danger position-absolute top-0 end-0 m-2 border-0" 
                title="Quitar programación" style="font-size: 1.2rem; line-height: 1;">
            &times;
        </button>

        <div class="d-flex align-items-center">
            <div class="me-3 text-success">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" class="bi bi-play-circle-fill" viewBox="0 0 16 16">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                </svg>
            </div>
            <div>
                <h5 class="m-0 fw-bold text-white">${playlist.name || 'Playlist'}</h5>
                <div class="text-white-50 small mt-1">
                    <span class="badge bg-success bg-opacity-75 me-1">${count} Carpetas</span>
                    <span class="d-block mt-1" style="font-size: 0.75rem;">${vigencia}</span>
                </div>
                <p class="m-0 mt-2 text-success small fw-bold">✓ Listo para reproducir</p>
            </div>
        </div>

        <div class="progress mt-3" style="height: 4px; background-color: rgba(255,255,255,0.1);">
            <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" role="progressbar" style="width: 100%"></div>
        </div>
    `;

    activeContainer.appendChild(card);
}

function mostrarAleatorizandoEnProgramacion(playlist) {
    const activeContainer = document.getElementById('schedule-list');
    if (!activeContainer) return;

    activeContainer.innerHTML = '';
    const vigencia = (playlist.start && playlist.end)
        ? `${playlist.start} al ${playlist.end}`
        : 'Sin fechas';

    const card = document.createElement('div');
    card.id = 'schedule-card-aleatorizando';
    card.className = "position-relative p-3 rounded border border-warning";
    card.style.background = "linear-gradient(45deg, rgba(255, 193, 7, 0.15), rgba(20, 20, 20, 0.9))";

    card.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="me-3 text-warning">
                <span class="spinner-border spinner-border-sm" role="status"></span>
            </div>
            <div>
                <h5 class="m-0 fw-bold text-white">${playlist.name || 'Playlist'}</h5>
                <div class="text-white-50 small mt-1">
                    <span>Vigencia: ${vigencia}</span>
                </div>
                <p class="m-0 mt-2 text-warning small fw-bold">Aleatorizando contenido…</p>
            </div>
        </div>
        <div class="progress mt-3" style="height: 8px; background-color: rgba(255,255,255,0.1);">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-warning" role="progressbar" style="width: 100%"></div>
        </div>
    `;

    activeContainer.appendChild(card);
}

async function activarPlaylist(id, event) {
    if (event) event.stopPropagation();

    const playlist = window.scheduleManager.playlists.find(p => p.id === id);
    if (!playlist) return alert("❌ Error: Playlist no encontrada.");

    const manager = window.clinicManager;
    if (!manager) return alert("❌ Error: Sistema no listo.");

    // 1. Rellenar fechas en el calendario y mostrar duración
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    if (startInput) startInput.value = playlist.start || '';
    if (endInput) endInput.value = playlist.end || '';

    // 2. Mostrar barra "Aleatorizando..." (vigencia + progreso)
    mostrarAleatorizandoEnProgramacion(playlist);

    try {
        // 3. Generar mix aleatorio (fetch + separar por intensidad + shuffle)
        const mix = await manager.generarMixParaPlaylist(playlist);
        const total = (mix.shuffledBaja.length + mix.shuffledAlta.length + mix.shuffledMedia.length);
        if (total === 0) {
            alert("❌ No se encontraron videos en las carpetas de esta playlist.");
            document.getElementById('schedule-list').innerHTML = '<div class="text-center text-muted py-4 small">No hay programación definida.</div>';
            return;
        }

        // 4. Guardar programación activa con el mix ya aleatorizado (para su duración)
        const activeData = {
            id: playlist.id,
            name: playlist.name,
            start: playlist.start,
            end: playlist.end,
            folders: playlist.folders,
            shuffledBaja: mix.shuffledBaja,
            shuffledAlta: mix.shuffledAlta,
            shuffledMedia: mix.shuffledMedia,
            activatedAt: Date.now()
        };
        localStorage.setItem('activeScheduleData', JSON.stringify(activeData));
        window.currentPlaylistSelection = playlist.folders;

        // 5. Reemplazar por la barra verde "Listo para reproducir" con vigencia
        cargarProgramacionVisual(activeData);

        console.log(`✅ Playlist "${playlist.name}" activada. Mix de ${total} items. Vigencia: ${playlist.start} al ${playlist.end}. Presiona "INICIAR TV" para comenzar.`);
    } catch (err) {
        console.error("Error al activar playlist:", err);
        alert("❌ Error al aleatorizar el contenido. Revisa la consola.");
        document.getElementById('schedule-list').innerHTML = '<div class="text-center text-muted py-4 small">No hay programación definida.</div>';
    }
}

// NOTA: La restauración de programación activa se movió al DOMContentLoaded principal (línea 167)
// para consolidar todas las inicializaciones en un solo lugar