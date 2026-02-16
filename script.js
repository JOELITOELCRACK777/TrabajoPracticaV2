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
        alert("✅ Playlist programada correctamente.");

        // Verificamos inmediatamente por si la fecha es HOY
        this.checkSchedule();
        return true;
    }

    /**
     * Borrar una playlist por ID
     */
    deletePlaylist(id) {
        this.playlists = this.playlists.filter(p => p.id !== id);
        this.persist();
        this.checkSchedule(); // Re-verificar estado
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
     * EL CEREBRO: Revisa qué toca reproducir hoy
     */
    checkSchedule() {
        // Obtenemos la fecha de hoy en formato YYYY-MM-DD (igual que los inputs HTML)
        const today = new Date().toISOString().split('T')[0];

        // Buscamos si hay alguna playlist activa para hoy
        // Lógica: Hoy debe ser mayor/igual al Inicio Y menor/igual al Fin
        const activePlaylist = this.playlists.find(p => 
            today >= p.start && today <= p.end
        );

        // Referencia al reproductor (asegurándonos de que existe)
        const manager = window.clinicManager;
        if (!manager || !manager.videoPlayer) return;

        // CASO A: Hay una playlist activa hoy
        if (activePlaylist) {
            // Solo actuamos si la playlist activa es DIFERENTE a la que ya está sonando
            if (this.currentPlaylistId !== activePlaylist.id) {
                console.log(`📅 ¡CAMBIO DE PROGRAMACIÓN! Activando: ${activePlaylist.name}`);
                
                this.currentPlaylistId = activePlaylist.id;

                // REINICIAMOS EL REPRODUCTOR CON FILTRO
                // Le pasamos la carpeta raíz actual y la lista de IDs permitidos.
                // El VideoPlayer se encargará de clasificar (A/M/B) solo lo que esté en esa lista.
                manager.videoPlayer.init(manager.currentFolderId, activePlaylist.folders);
                
                this.updateUIStatus(`Modo Playlist: ${activePlaylist.name}`);
            }
        } 
        // CASO B: No hay nada programado hoy (Volver a la normalidad)
        else {
            if (this.currentPlaylistId !== 'DEFAULT') {
                console.log("📅 Sin programación específica. Volviendo a modo DEFAULT (Todo).");
                
                this.currentPlaylistId = 'DEFAULT';

                // Reiniciamos el reproductor SIN filtros (null)
                manager.videoPlayer.init(manager.currentFolderId, null);
                
                this.updateUIStatus("Modo: Reproducción General");
            }
        }
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
// INICIALIZACIÓN (ESTO DEBE IR AL FINAL ABSOLUTO)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Iniciamos ClinicManager
    // Verifica si ya existe para no duplicar, si no, créalo
    if (!window.clinicManager) {
        window.clinicManager = new ClinicManager();
    }

    // 2. Iniciamos ScheduleManager (AHORA SÍ FUNCIONARÁ)
    window.scheduleManager = new ScheduleManager();

    actualizarListaPlaylistsGuardadas();
    renderSavedPlaylists();
    
    console.log("Sistemas iniciados correctamente");
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
            if (this.accessToken && now < this.tokenExpiration) {
                resolve(this.accessToken);
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
            // Eliminamos apiKey para usar solo Token Bearer (más seguro)
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`;
            
            const res = await this.safeDriveFetch(url); // USAMOS LA VERSIÓN SEGURA
            const data = await res.json();

            grid.innerHTML = ''; // Limpiamos el spinner

            // 4. Si no hay archivos
            if (!data.files || data.files.length === 0) {
                grid.innerHTML = '<div class="col-12 text-center text-white-50 py-4">Esta carpeta está vacía 🤷‍♂️</div>';
                return;
            }

            // 5. Generamos las tarjetas
            data.files.forEach(file => {
                const isVideo = file.mimeType.includes('video');
                const badgeClass = isVideo ? 'badge-video' : 'badge-image'; // Asegúrate de tener CSS para esto
                const badgeText = isVideo ? 'VIDEO' : 'FOTO';
                const thumbUrl = file.thumbnailLink || 'img/logoclinica.png'; 

                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3 mb-3'; // Agregué mb-3 para espacio
                col.innerHTML = `
                    <div class="file-thumbnail-card h-100 position-relative bg-dark border border-secondary rounded overflow-hidden">
                        <span class="position-absolute top-0 start-0 badge bg-${isVideo ? 'danger' : 'primary'} m-2">${badgeText}</span>
                        
                        <button class="btn btn-sm btn-danger position-absolute top-0 end-0 m-2" 
                                style="z-index:10;"
                                onclick="clinicManager.deleteFile('${file.id}', '${cleanId}', '${folderName}')" 
                                title="Eliminar archivo">✕</button>
                        
                        <a href="${file.webViewLink}" target="_blank" class="d-block ratio ratio-16x9">
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

    async deleteFile(fileId, folderId, folderName) {
        if(!confirm('¿Estás seguro de eliminar este archivo permanentemente?')) return;
        
        const btn = event.target; // Feedback visual inmediato
        btn.disabled = true; btn.innerText = "...";

        try {
            // Usamos safeDriveFetch para manejar tokens expirados automáticamente
            const res = await this.safeDriveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'PATCH',
                body: JSON.stringify({ trashed: true })
            });

            if (res.ok) {
                this.viewFolderContent(folderId, folderName); // Recarga modal
                this.countVideos(folderId); // Recarga dashboard
            } else {
                alert("No se pudo eliminar. Revisa los permisos.");
                btn.disabled = false; btn.innerText = "✕";
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión.");
            btn.disabled = false; btn.innerText = "✕";
        }
    }

    // ==========================================
    // 3. SUBIDA DE ARCHIVOS (CON BARRA DE PROGRESO)
    // ==========================================

    // Esta función reemplaza a handleFileUpload antigua
    async handleFileUpload(inputData) {
        // Detectar si viene de un input event o drag&drop
        let files = (inputData.target && inputData.target.files) ? inputData.target.files : inputData;
        
        // Si inputData es una FileList (Drag & Drop), úsala directamente
        if (inputData instanceof FileList) files = inputData;
        // Si inputData es un solo File (Drag & Drop individual)
        if (inputData instanceof File) files = [inputData];

        if (!files || files.length === 0) return;
        const file = files[0];

        // 1. Asegurar Token Válido antes de empezar
        // Importante: xhr no usa safeDriveFetch, así que validamos manualmente aquí
        const accessToken = await this.ensureValidToken();

        if (!this.currentFolderId) {
            alert("⚠️ Error: No hay carpeta seleccionada.");
            return;
        }

        // Elementos del DOM (Asegúrate de tenerlos en tu HTML)
        const container = document.getElementById('upload-progress-container');
        const statusText = document.getElementById('upload-status');
        const percentageText = document.getElementById('upload-percentage');
        const progressBar = document.getElementById('upload-progress-bar');

        // 2. Mostrar UI
        if (container) {
            container.classList.remove('d-none');
            container.classList.add('d-block');
        }
        if (progressBar) progressBar.style.width = '0%';
        if (percentageText) percentageText.innerText = '0%';
        if (statusText) statusText.innerText = `Subiendo: ${file.name}`;

        // Desactivar botón de subida
        const uploadBtn = document.getElementById('file-upload-input')?.nextElementSibling;
        if(uploadBtn) uploadBtn.disabled = true;

        // 3. Preparar datos
        const metadata = { 
            'name': file.name, 
            'parents': [this.currentFolderId],
            // Forzar video si es posible para generar thumbnails
            'mimeType': file.type || 'video/mp4' 
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const xhr = new XMLHttpRequest();
        // Solicitamos campos específicos para ahorrar datos
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name');
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

        // Evento de Progreso
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                if (progressBar) progressBar.style.width = percent + '%';
                if (percentageText) percentageText.innerText = percent + '%';
            }
        };

        // Evento Completado
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (statusText) statusText.innerText = "✅ Procesando...";
                // Pequeño delay para que el usuario vea el 100%
                setTimeout(() => {
                    this.viewFolderContent(this.currentFolderId, this.currentFolderName);
                    this.countVideos(this.currentFolderId);
                    alert(`✅ "${file.name}" subido con éxito.`);
                    
                    if (container) {
                        container.classList.add('d-none');
                        container.classList.remove('d-block');
                    }
                }, 1000);
            } else {
                console.error("Error upload:", xhr.responseText);
                alert("❌ Error en la subida. Verifica tu conexión.");
                if (container) container.classList.add('d-none');
            }
            if(uploadBtn) uploadBtn.disabled = false;
        };

        xhr.onerror = () => {
            alert("❌ Error crítico de red.");
            if (container) container.classList.add('d-none');
            if(uploadBtn) uploadBtn.disabled = false;
        };

        xhr.send(form);
    }

    // ==========================================
    // 4. DASHBOARD Y CARPETAS
    // ==========================================

    async loadDashboard() {
        let targetId = this.selectedFolderId || localStorage.getItem('savedClinicId');
        if (!targetId) { this.reset(); this.loadClinicsFromDrive(); return; }
        
        targetId = String(targetId).split(',')[0].trim();
        this.selectedFolderId = targetId; 
        this.currentFolderId = targetId;
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
            listContainer.innerHTML = '<div class="text-danger small text-center">Error al cargar.</div>';
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
        const folderName = this.updatePreview();
        const btn = document.querySelector('.creation-panel button');
        const originalText = btn.innerText;
        btn.innerText = "⏳"; btn.disabled = true;

        try {
            const res = await this.safeDriveFetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [this.selectedFolderId]
                })
            });
            if (res.ok) {
                await this.loadDashboard();
                document.getElementById('new-id').value = ""; 
                this.updatePreview(); 
            } 
        } catch (e) { alert("Error al crear."); } 
        finally { btn.innerText = originalText; btn.disabled = false; }
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
        let idsParaReproducir = [];
        if (window.currentPlaylistSelection && window.currentPlaylistSelection.length > 0) {
            idsParaReproducir = window.currentPlaylistSelection;
        } else if (this.playlistSelection && this.playlistSelection.size > 0) {
            idsParaReproducir = Array.from(this.playlistSelection.keys());
        } else {
            return alert("⚠️ Selecciona al menos una carpeta.");
        }

        document.body.style.cursor = 'wait';
        let finalQueue = [];

        for (const idRaw of idsParaReproducir) {
            const id = String(idRaw).split(',')[0].trim();
            let folder = this.allFolders.find(f => f.id == id);
            
            if (!folder || !folder.files || folder.files.length === 0) {
                const videos = await this.fetchVideosFromFolder(id);
                if (folder) folder.files = videos;
                else folder = { id: id, name: "Carpeta " + id, priority: 'M', files: videos };
            }

            if (folder.files && folder.files.length > 0) {
                let multiplicador = folder.priority === 'A' ? 3 : (folder.priority === 'M' ? 2 : 1);
                for (let i = 0; i < multiplicador; i++) {
                    const batch = folder.files.map(file => ({
                        ...file, originFolder: folder.name || "Desconocida", priorityRef: folder.priority || 'M'
                    }));
                    finalQueue.push(...batch);
                }
            }
        }
        document.body.style.cursor = 'default';
        if (finalQueue.length === 0) return alert("❌ No se encontraron videos.");

        finalQueue.sort(() => Math.random() - 0.5);
        this.menuOverlay.classList.add('slide-up');
        if (this.player && this.player.startQueue) this.player.startQueue(finalQueue);
    }

    async fetchVideosFromFolder(folderId) {
        const cleanId = String(folderId).split(',')[0].trim();
        try {
            const q = `'${cleanId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)`; 
            const response = await this.safeDriveFetch(url); 
            if (!response.ok) return [];
            const data = await response.json();
            return data.files || [];
        } catch (error) { return []; }
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
        if (container) {
            container.style.maxWidth = stepId === 'step-playlist' ? '1300px' : '600px';
            if (stepId === 'step-playlist') container.classList.add('container-wide');
            else container.classList.remove('container-wide');
        }
        ['step-select', 'step-decision', 'step-dashboard', 'step-playlist'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('d-none');
        });
        const target = document.getElementById(stepId);
        if(target) target.classList.remove('d-none');

        if (stepId === 'step-dashboard') {
            this.renderFolderList();
            setTimeout(() => this.updateFloatingBar(), 150); 
        } else if (stepId === 'step-playlist') {
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
            listContainer.innerHTML = '<div class="text-white-50 text-center small mt-3">No hay carpetas.</div>';
            return;
        }

        foldersToShow.forEach(folder => {
            const lastChar = folder.name.slice(-1).toUpperCase();
            let borderClass = lastChar === 'A' ? 'border-intensity-A' : (lastChar === 'M' ? 'border-intensity-M' : 'border-intensity-B');
            const isChecked = this.playlistSelection.has(folder.id) ? 'checked' : '';

            const div = document.createElement('div');
            div.className = `folder-item ${borderClass} d-flex align-items-center mb-2`;
            
            div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
            div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
            div.addEventListener('drop', (e) => {
                e.preventDefault(); div.classList.remove('drag-over');
                this.currentFolderId = folder.id; // Importante para saber dónde subir
                this.handleFileUpload(e.dataTransfer.files);
            });

            div.innerHTML = `
                <div class="me-3">
                    <input class="form-check-input folder-checkbox" type="checkbox" value="${folder.id}" data-name="${folder.name}" ${isChecked} style="transform: scale(1.3); cursor:pointer;">
                </div>
                <div class="flex-grow-1 clickable-folder px-2 py-1" onclick="clinicManager.viewFolderContent('${folder.id}', '${folder.name}')">
                    <div class="fw-bold text-white small text-truncate pointer-events-none">${folder.name}</div>
                    <div class="text-white-50" style="font-size:0.7rem" id="count-${folder.id}">...</div>
                </div>
                <div class="btn-group ms-2">
                    <button class="btn btn-outline-warning btn-sm px-2" onclick="clinicManager.editIntensity('${folder.id}', '${folder.name}')">✏️</button>
                    <button class="btn btn-outline-danger btn-sm px-2" onclick="clinicManager.deleteFolderById('${folder.id}', '${folder.name}', event)">🗑️</button>
                </div>
            `;
            listContainer.appendChild(div);
            this.countVideos(folder.id);
        });
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
        if (this.playlistSelection.size === 0) return container.innerHTML = `<div class="text-center py-4 text-white-50 small">Vacío</div>`;
        
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

    async countVideos(folderId) {
        const cleanId = String(folderId).split(',')[0].trim();
        try {
            const q = `'${cleanId}' in parents and mimeType contains 'video/' and trashed = false`;
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`;
            const res = await this.safeDriveFetch(url); 
            const data = await res.json();
            const countEl = document.getElementById(`count-${folderId}`);
            if(countEl) countEl.innerText = `${data.files ? data.files.length : 0} videos`;
        } catch (e) { }
    }

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

    updatePreview() {
        const topic = document.getElementById('new-topic').value;
        const idRaw = document.getElementById('new-id').value;
        const intensity = document.querySelector('input[name="intensity-btn"]:checked')?.value || 'M';
        let prefix = this.selectedClinicName ? this.selectedClinicName.replace(/\s+/g, '').substring(0, 3).toUpperCase() : "GEN";
        const code = `${prefix}${topic}${idRaw.padStart(2, '0')}${intensity}`;
        const previewEl = document.getElementById('code-preview');
        if(previewEl) previewEl.innerText = code;
        return code;
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
}


class VideoPlayer {
    constructor() {
        // Buscamos el video por ID (asegúrate que en tu HTML sea 'main-video' o 'main-player')
        this.videoElement = document.getElementById('main-video') || document.getElementById('main-player');
        
        // Referencias a la UI (NUEVO: Necesario para quitar la pantalla negra)
        this.container = document.getElementById('video-container');
        this.menu = document.getElementById('clinic-menu');
        this.weatherWidget = document.getElementById('weather-widget');

        // Variables de Estado (TU CÓDIGO)
        this.queue = [];          
        this.currentIndex = 0;    
        
        this.fadeStarted = false;
        this.audioFadeStarted = false;
        this.audioFadeInterval = null;
        this.isLoading = false; 
        this.currentObjectUrl = null; 

        // Eventos del Video
        if (this.videoElement) {
            // Usamos 'addEventListener' para ser más seguros
            this.videoElement.addEventListener('ended', () => this.onVideoEnded());
            
            this.videoElement.addEventListener('error', (e) => {
                console.error("❌ Error playback, recuperando...", e);
                this.resetFlags();
                // Intentar el siguiente rápidamente
                setTimeout(() => this.playNextCycle(), 1000);
            });
        }
    }

    // --- 1. FUNCIÓN DE ENTRADA (MODIFICADA PARA UI) ---
    startQueue(generatedList) {
        // 1. Validaciones
        if (!generatedList || generatedList.length === 0) return alert("Lista vacía");

        // 2. Detener reproducción anterior
        if (this.videoElement) {
            this.videoElement.pause();
            this.resetFlags();
        }

        // 3. Cargar nueva lista
        this.queue = generatedList;
        this.currentIndex = 0;
        console.log(`📺 Player recibió ${this.queue.length} videos.`);

        // 4. MANEJO DE INTERFAZ (¡ESTO SOLUCIONA LA PANTALLA NEGRA!)
        // A. Subimos el menú
        if (this.menu) this.menu.classList.add('slide-up');
        
        // B. Mostramos el contenedor de video (quitamos d-none)
        if (this.container) {
            this.container.classList.remove('d-none');
            this.container.classList.add('d-block');
        }

        // C. Aseguramos que el clima se vea
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
        this.fadeStarted = true;
        
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
        setTimeout(() => this.playNextCycle(), 1000); 
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

    // --- 2. CICLO Y LOGICA ---
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
    async playVideoFile(video) {
    if (!this.videoElement) return;

    console.log(`🎬 Intentando cargar: ${video.name}`);
    this.isLoading = true;

    try {
        // 1. Obtener Token
        const token = localStorage.getItem('google_access_token');
        if (!token) throw new Error("No hay token");

        // 2. Descarga del Blob
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${video.id}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // Si da 403 o 404, saltamos este video
            console.error(`❌ Error en Drive: ${response.status}`);
            this.isLoading = false;
            this.playNextCycle();
            return;
        }

        const blob = await response.blob();
        
        // Limpiar URL anterior para no saturar la memoria RAM
        if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
        
        this.currentObjectUrl = URL.createObjectURL(blob);

        // 3. Preparar el elemento de video antes de asignar la fuente
        this.videoElement.style.opacity = "0"; // Lo ocultamos un milisegundo
        this.videoElement.src = this.currentObjectUrl;

        // 4. Evento: Cuando el primer fotograma esté listo
        this.videoElement.onloadeddata = () => {
            this.videoElement.play().then(() => {
                this.videoElement.style.opacity = "1"; // ¡Aparece!
                this.isLoading = false;
                console.log("✅ Reproduciendo ahora.");
            }).catch(err => {
                console.warn("Autoplay bloqueado, intentando sin audio...");
                this.videoElement.muted = true;
                this.videoElement.play();
                this.videoElement.style.opacity = "1";
                this.isLoading = false;
            });
        };

    } catch (error) {
        console.error("❌ Error fatal cargando archivo:", error);
        this.isLoading = false;
        setTimeout(() => this.playNextCycle(), 2000);
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

let currentPlaylistSelection = []; 

function openScheduleManager() {
    // 1. Capturar todos los checkboxes marcados
    // Usamos la clase .folder-checkbox para ser más específicos
    const checkboxes = document.querySelectorAll('.folder-checkbox:checked');
    
    // 2. Validación: Si no hay nada marcado, avisar y salir
    if (checkboxes.length === 0) {
        alert("⚠️ Por favor, marca al menos una carpeta antes de configurar la playlist.");
        return;
    }

    // 3. Preparar las variables y la interfaz
    currentPlaylistSelection = []; // Limpiamos selección anterior
    const previewList = document.getElementById('playlist-preview-list');
    previewList.innerHTML = ''; // Limpiamos la lista visual anterior

    // 4. Recorrer los checkboxes para guardar datos y pintar la lista
    checkboxes.forEach(cb => {
        const folderId = cb.value;
        let folderName = "Carpeta sin nombre";

        // Intentamos obtener el nombre del atributo data-name (más limpio)
        if (cb.getAttribute('data-name')) {
            folderName = cb.getAttribute('data-name');
        } 
        // Fallback: Si no hay atributo, intentamos sacarlo del texto del padre (tu lógica original)
        else if (cb.parentElement) {
            let clone = cb.parentElement.cloneNode(true);
            let input = clone.querySelector('input');
            if(input) input.remove(); // Quitamos el checkbox del clon para tener solo texto
            folderName = clone.innerText.trim() || `ID: ${folderId}`;
        }

        // GUARDAMOS EL ID EN LA VARIABLE GLOBAL (Importante para el paso de guardar)
        currentPlaylistSelection.push(folderId);

        // GENERAMOS EL HTML VISUAL
        const itemHTML = `
            <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 py-2">
                <div class="text-truncate">
                    <i class="bi bi-folder2-open text-warning me-2"></i>
                    <span class="text-white-50 small">${folderName}</span>
                </div>
                <span class="badge bg-success rounded-pill" style="font-size: 0.7em;">Incluida</span>
            </div>
        `;
        previewList.insertAdjacentHTML('beforeend', itemHTML);
    });

    // 5. Actualizar el contador (Badge)
    const badge = document.getElementById('selected-count-badge');
    if(badge) {
        badge.innerText = `${currentPlaylistSelection.length} carpetas`;
        badge.classList.remove('d-none', 'bg-danger');
        badge.classList.add('bg-info');
    }

    // 6. Resetear los inputs del formulario (Fecha y Nombre) para que estén limpios
    const nameInput = document.getElementById('playlist-name'); // Asegúrate que tu input tenga este ID
    const startInput = document.getElementById('playlist-start'); // Asegúrate que tu input tenga este ID
    const endInput = document.getElementById('playlist-end');     // Asegúrate que tu input tenga este ID

    if (nameInput) nameInput.value = '';
    // Poner fecha de hoy por defecto en el inicio
    if (startInput) startInput.value = new Date().toISOString().split('T')[0];
    if (endInput) endInput.value = '';

    // 7. Cambio de Pantalla: Ocultar Dashboard, Mostrar Creador de Playlist
    document.getElementById('step-dashboard').classList.add('d-none');
    document.getElementById('step-dashboard').classList.remove('d-block');

    document.getElementById('step-playlist').classList.remove('d-none');
    document.getElementById('step-playlist').classList.add('d-block');
    
    // Ocultar la barra flotante inferior (ya no es necesaria en esta pantalla)
    const bottomBar = document.getElementById('bottom-action-bar');
    if (bottomBar) {
        bottomBar.classList.remove('d-block');
        bottomBar.classList.add('d-none');
    }
}

const scheduleManager = new ScheduleManager();


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
    
    // Recuperar carpetas seleccionadas (variable global del paso anterior)
    // Usamos 'currentPlaylistSelection' o 'tempSelectedIds' (asegúrate que openScheduleManager llene una de estas)
    let seleccion = window.currentPlaylistSelection || [];

    // 4. VALIDACIONES LÓGICAS
    if (!name) {
        alert("⚠️ Por favor, escribe un nombre para la playlist.");
        return;
    }
    if (seleccion.length === 0) {
        alert("⚠️ No has seleccionado ninguna carpeta (0 carpetas).");
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
            endInput.value = ''
          
            
            // Actualizar el menú desplegable de "Cargar Playlist"
            renderSavedPlaylists(); 
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

// Función placeholder para cuando hagamos la interfaz de detalles (siguiente paso)
function verDetallesPlaylist(id) {
    console.log("Pronto abriremos los detalles de:", id);
    alert("🚧 Aquí se abrirá la vista de detalles (Siguiente paso)");
}

function prepararYMostrarPlaylist() {
    console.log("🔄 Preparando datos para la playlist...");

    // 1. Buscamos todos los checkboxes que estén marcados (checked)
    // Asumo que tus checkboxes tienen la clase 'folder-checkbox'. Si tienen otra, cámbialo aquí.
    const checkboxes = document.querySelectorAll('.folder-checkbox:checked');
    
    // 2. Extraemos los IDs (value) de esos checkboxes
    const seleccionados = Array.from(checkboxes).map(cb => cb.value);

    // 3. Guardamos esto en la variable GLOBAL que usa el botón de guardar
    window.currentPlaylistSelection = seleccionados;

    console.log("✅ IDs capturados:", window.currentPlaylistSelection);

    if (seleccionados.length === 0) {
        alert("⚠️ No hay carpetas seleccionadas. Marca algunas casillas primero.");
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

    window.currentPlaylistSelection = Array.from(window.clinicManager.playlistSelection);

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

setTimeout(() => {
    renderSavedPlaylists();
}, 500);

let playlistSeleccionadaParaReproducir = null; // Variable global temporal

function verDetallesPlaylist(id) {
    const playlist = window.scheduleManager.playlists.find(p => p.id === id);
    if (!playlist) return;

    playlistSeleccionadaParaReproducir = playlist; 

    // 1. Rellenar datos básicos
    document.getElementById('modalPlaylistName').innerText = playlist.name;
    document.getElementById('modalPlaylistDates').innerText = `${playlist.start} al ${playlist.end}`;
    document.getElementById('modalPlaylistCount').innerText = `${playlist.folders.length} Carpeta(s)`;

    const contentDiv = document.getElementById('modalPlaylistContent');
    contentDiv.innerHTML = ''; 

    // 2. Listar solo NOMBRES de carpetas
    playlist.folders.forEach(folderId => {
        // Buscamos el nombre real en la memoria del gestor
        const folderData = window.clinicManager.allFolders ? window.clinicManager.allFolders.find(f => f.id === folderId) : null;
        
        // Si por alguna razón no tenemos el nombre, usamos "Carpeta de Playlist" en lugar del ID feo
        const folderName = folderData ? folderData.name : "Carpeta de Playlist";

        const folderEl = document.createElement('div');
        folderEl.className = 'bg-secondary bg-opacity-10 p-2 rounded mb-2 border-start border-info border-3';
        folderEl.innerHTML = `
            <div class="fw-bold text-info small">📁 ${folderName}</div>
            <div class="ps-3 small text-white-50 mt-1" id="videos-of-${folderId}" style="font-size: 0.8rem;">
                <span class="spinner-border spinner-border-sm" style="width: 10px; height: 10px;"></span> Listando videos...
            </div>
        `;
        contentDiv.appendChild(folderEl);

        // Llamamos a Drive para traer los videos
        obtenerVideosDeCarpeta(folderId, `videos-of-${folderId}`);
    });

    // 3. Lanzar el modal
    const modalElement = document.getElementById('playlistDetailsModal');
    const myModal = new bootstrap.Modal(modalElement);
    myModal.show();
}

// Función auxiliar para listar los videos dentro del modal
async function obtenerVideosDeCarpeta(folderId, elementId) {
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`,
            fields: 'files(name)',
        });
        const videos = response.result.files;
        const target = document.getElementById(elementId);
        
        if (videos && videos.length > 0) {
            target.innerHTML = videos.map(v => `• ${v.name}`).join('<br>');
        } else {
            target.innerHTML = '<span class="fst-italic">No se encontraron videos.</span>';
        }
    } catch (e) {
        document.getElementById(elementId).innerText = "Error cargando videos.";
    }
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
    // 1. Configurar variable global para el reproductor
    window.currentPlaylistSelection = playlist.folders;

    // 2. Rellenar fechas en el calendario
    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');
    if(startInput) startInput.value = playlist.start;
    if(endInput) endInput.value = playlist.end;

    // 3. Dibujar la TARJETA LIMPIA (Sin códigos raros)
    const activeContainer = document.getElementById('schedule-list');
    
    if (activeContainer) {
        activeContainer.innerHTML = ''; 

        // Calculamos la cantidad de items para mostrar un resumen
        const count = playlist.folders.length;
        
        // Creamos una tarjeta minimalista
        const card = document.createElement('div');
        // Usamos un degradado suave verde para que se vea moderno
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
                    <h5 class="m-0 fw-bold text-white">${playlist.name}</h5>
                    <div class="text-white-50 small mt-1">
                        <span class="badge bg-success bg-opacity-75 me-1">${count} Carpetas</span>
                        <span>Listo para transmitir</span>
                    </div>
                </div>
            </div>

            <div class="progress mt-3" style="height: 4px; background-color: rgba(255,255,255,0.1);">
                <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" role="progressbar" style="width: 100%"></div>
            </div>
        `;
        
        activeContainer.appendChild(card);
    }
}

function activarPlaylist(id, event) {
    if (event) event.stopPropagation();

    const playlist = window.scheduleManager.playlists.find(p => p.id === id);
    if (!playlist) return alert("❌ Error: Playlist no encontrada.");

    // 1. GUARDAR EN MEMORIA PERMANENTE (localStorage)
    localStorage.setItem('activeScheduleData', JSON.stringify(playlist));

    // 2. Ejecutar la función que "pinta" la pantalla y configura el TV
    cargarProgramacionVisual(playlist);
}

document.addEventListener('DOMContentLoaded', () => {
    const savedData = localStorage.getItem('activeScheduleData');
    if (savedData) {
        try {
            const playlist = JSON.parse(savedData);
            console.log("🔄 Restaurando programación activa:", playlist.name);
            
            // Damos un pequeño retraso para asegurar que clinicManager haya cargado las carpetas
            setTimeout(() => {
                cargarProgramacionVisual(playlist);
            }, 1000); 
        } catch (e) {
            console.error("Error recuperando programación", e);
        }
    }
});