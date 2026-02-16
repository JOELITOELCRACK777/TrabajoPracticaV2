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

        this.selectedClinicName = localStorage.getItem('savedClinicName') || null;
        this.selectedFolderId = localStorage.getItem('savedClinicId') || null;
        
        this.selectedClinicName = null;
        this.selectedFolderId = null;
        this.accessToken = null;
        this.tokenClient = null;
        this.currentFolderId = null;

        this.allFolders = [];
        
        // Estado de la Playlist (Mapa: ID -> Objeto Carpeta)
        this.playlistSelection = new Map();

        this.containerClinics = document.getElementById('clinics-container');
        this.menuOverlay = document.getElementById('clinic-menu');
        this.clinicTitle = document.getElementById('clinic-title-display');
        this.selectionBar = document.getElementById('selection-bar');

        this.initGoogleAuth();  
        this.initSearch();
    }

    forceLogin() {
        console.warn("🔄 Token expirado. Solicitando nuevo inicio de sesión...");
        localStorage.removeItem('google_access_token');
        this.accessToken = null;
        // En lugar de abrir el popup a la fuerza, mostramos la pantalla de login
        this.renderLoginScreen(); 
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
            setTimeout(() => this.initGoogleAuth(), 250);
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
                this.forceLogin();
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
            }
        } catch (error) { 
            console.error("Error cargando clínicas", error);
            if(this.containerClinics) this.containerClinics.innerHTML = '<div class="text-danger">Error de conexión</div>';
        }
    }

    selectClinic(name, id) {
    this.selectedClinicName = name;
    this.selectedFolderId = id;
    
    // CAMBIO 2: ¡Guardamos la elección para que no se olvide!
    localStorage.setItem('savedClinicName', name);
    localStorage.setItem('savedClinicId', id);

    this.playlistSelection.clear();
    this.updateFloatingBar();
    if (this.clinicTitle) this.clinicTitle.innerText = name;
    this.showStep('step-decision');
}

    async showStep(stepId) {
    console.log("🚀 Cambiando a paso:", stepId);
    
    const container = document.querySelector('.menu-container');
    
    // 1. Gestionar el ancho
    if (container) {
        if (stepId === 'step-playlist') {
            container.classList.add('container-wide');
            container.style.maxWidth = '1300px';
        } else {
            container.classList.remove('container-wide');
            container.style.maxWidth = '600px';
        }
    }

    // 2. Mostrar/Ocultar pasos
    ['step-select', 'step-decision', 'step-dashboard', 'step-playlist'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('d-none');
    });
    
    const target = document.getElementById(stepId);
    if(target) target.classList.remove('d-none');

    // 3. Lógica específica según el paso
    const bar = document.getElementById('selection-bar');

    if (stepId === 'step-dashboard') {
        this.renderFolderList();
        
        setTimeout(() => {
            console.log("🔄 Actualizando barra desde Dashboard...");
            this.updateFloatingBar();
        }, 150); 
    } 
    else if (stepId === 'step-playlist') {
        // 1. Sincronizar recuadro de carpetas (Usando .size)
        const count = this.playlistSelection ? this.playlistSelection.size : 0;
        const badge = document.getElementById('selected-count-badge');
        if (badge) badge.innerText = `${count} carpetas`;

        // 2. Renderizar la lista de nombres (Corregido el nombre de la función)
        // Usamos 'showPlaylistReview' que es la que existe en tu ClinicManager
        if (typeof this.showPlaylistReview === 'function') {
            this.showPlaylistReview();
        }

        // 3. Ocultar barra al entrar a programación (Con animación de salida)
        if (bar) {
            bar.classList.remove('active');
            bar.style.bottom = "-150px";
            // Opcional: ocultarla del todo tras la animación
            setTimeout(() => { 
                if(!bar.classList.contains('active')) bar.style.display = 'none'; 
            }, 500);
        }
    }
    else {
        // Para cualquier otro paso (select, decision), ocultamos la barra
        if (bar) {
            bar.classList.remove('active');
            bar.style.bottom = "-150px";
        }
    }
}

    backToDecision() { this.showStep('step-decision'); }

    reset() {
    this.selectedClinicName = null;
    this.selectedFolderId = null;
    
    // CAMBIO 3: Borramos la memoria
    localStorage.removeItem('savedClinicName');
    localStorage.removeItem('savedClinicId');

    this.playlistSelection.clear();
    this.showStep('step-select');
}

    // --- NUEVA LÓGICA DE PLAYLIST ---

    toggleFolderSelection(folder, isChecked) {
        if (isChecked) {
            this.playlistSelection.set(folder.id, folder);
        } else {
            this.playlistSelection.delete(folder.id);
        }
        this.updateFloatingBar();
    }

    updateFloatingBar() {
    const bar = document.getElementById('selection-bar');
    const countElement = document.getElementById('selection-count');
    const playlistStep = document.getElementById('step-playlist');

    if (!bar || !countElement) return;

    const count = this.playlistSelection ? this.playlistSelection.size : 0;
    countElement.innerText = count;

    const isPlaylistActive = playlistStep && !playlistStep.classList.contains('d-none');

    if (count > 0 && !isPlaylistActive) {
        // 1. Si estaba oculta con display, la activamos
        if (bar.style.display === "none" || !bar.classList.contains('active')) {
            bar.style.display = "flex"; // O "block"
            
            // 2. EL TRUCO: Un pequeñísimo delay (reflow) para que el navegador 
            // note el cambio y ejecute la animación de CSS
            setTimeout(() => {
                bar.classList.add('active');
            }, 10); 
        }
    } else {
        bar.classList.remove('active');
        // 3. Esperamos a que termine la animación de salida antes de poner display: none
        setTimeout(() => {
            if (!bar.classList.contains('active')) {
                bar.style.display = "none";
            }
        }, 500); // 500ms es lo que dura tu transición en CSS
    }
}

    showPlaylistReview() {
    // 1. Buscamos el contenedor donde se listarán las carpetas
    const container = document.getElementById('playlist-preview-list');
    if (!container) {
        console.warn("⚠️ No se encontró el contenedor 'playlist-preview-list'");
        return;
    }

    // 2. Limpiamos el contenido previo para no duplicar
    container.innerHTML = '';

    // 3. Si no hay nada seleccionado, mostramos un mensaje amigable
    if (this.playlistSelection.size === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <p class="text-white-50 small">No hay carpetas seleccionadas en la playlist.</p>
                <button class="btn btn-sm btn-outline-info" onclick="clinicManager.showStep('step-dashboard')">
                    Ir a seleccionar
                </button>
            </div>`;
        return;
    }

    // 4. Recorremos el Map y creamos los elementos visuales
    this.playlistSelection.forEach((folder) => {
        const item = document.createElement('div');
        
        // Estilo: fondo oscuro semi-transparente con borde celeste a la izquierda
        item.className = 'playlist-item d-flex justify-content-between align-items-center p-2 mb-2 bg-white bg-opacity-10 border-start border-info border-3 rounded animate-fade-in';
        
        item.innerHTML = `
            <div class="ps-2">
                <div class="text-white fw-bold small">📂 ${folder.name}</div>
                <div class="text-white-50" style="font-size: 0.7rem;">ID: ${folder.id.substring(0, 8)}...</div>
            </div>
            <button class="btn btn-link text-danger p-0 me-2" 
                    onclick="clinicManager.removeFromPlaylist('${folder.id}')" 
                    title="Quitar de la lista">
                <span style="font-size: 1.2rem;">&times;</span>
            </button>
        `;
        container.appendChild(item);
    });
}

    removeFromPlaylist(id) {
        this.playlistSelection.delete(id);
        window.currentPlaylistSelection = Array.from(this.playlistSelection);
        this.updateFloatingBar();
        this.showPlaylistReview(); 
    }

    launchPlaylist() {
        if (this.playlistSelection.size === 0) return alert("Selecciona al menos una carpeta.");
        
        const selectedIds = Array.from(this.playlistSelection.keys());
        console.log("🚀 Lanzando playlist maestra:", selectedIds);
        
        this.menuOverlay.classList.add('slide-up');
        this.player.init(this.selectedFolderId, selectedIds);
    }

    // --- FIN NUEVA LÓGICA ---

    initSearch() {
        const searchInput = document.getElementById('folder-search-input');
        if(!searchInput) return;

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

    renderFolderList(filesToRender) {
    const listContainer = document.getElementById('folders-list');
    if (!listContainer) return;
    
    // 1. LIMPIEZA Y DELEGACIÓN: Solo asignamos el evento una vez
    listContainer.innerHTML = '';
    
    // Usamos onclick en el contenedor para atrapar cualquier clic en los hijos
    listContainer.onclick = (e) => {
        // Si lo que clickeamos es un checkbox de carpeta
        if (e.target.classList.contains('folder-checkbox')) {
            const folderId = e.target.value;
            const folderName = e.target.dataset.name;
            const isChecked = e.target.checked;

            // Ejecutamos la lógica de selección (dentro de tu clase)
            this.toggleFolderSelection({id: folderId, name: folderName}, isChecked);
            
            // DISPARAMOS LA BARRA: Forzamos la actualización visual
            this.updateFloatingBar();
        }
    };

    // MANTENER DATOS
    const foldersToShow = filesToRender || this.allFolders || [];

    if (foldersToShow.length === 0) {
        listContainer.innerHTML = '<div class="text-white-50 text-center small mt-3">No se encontraron carpetas.</div>';
        return;
    }

    foldersToShow.forEach(folder => {
        const lastChar = folder.name.slice(-1).toUpperCase();
        let borderClass = 'border-intensity-B';
        if(lastChar === 'A') borderClass = 'border-intensity-A';
        if(lastChar === 'M') borderClass = 'border-intensity-M';

        const isChecked = this.playlistSelection.has(folder.id) ? 'checked' : '';

        const div = document.createElement('div');
        div.id = `folder-card-${folder.id}`; 
        div.className = `folder-item ${borderClass} d-flex align-items-center mb-2`;
        
        // Eventos Drag and Drop (se mantienen)
        div.addEventListener('dragenter', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
        div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
        div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
        div.addEventListener('drop', (e) => {
            e.preventDefault();
            div.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) this.handleFileUpload(files[0], folder.id, folder.name);
        });

        // NOTA: El input ya no necesita 'onchange', lo maneja el 'onclick' del padre arriba
        div.innerHTML = `
            <div class="me-3">
                <input class="form-check-input folder-checkbox" type="checkbox" 
                value="${folder.id}" 
                data-name="${folder.name}"   
                ${isChecked}
                style="transform: scale(1.3); cursor:pointer;">
            </div>

            <div class="flex-grow-1 clickable-folder px-2 py-1" style="min-width: 0;" 
                 onclick="clinicManager.viewFolderContent('${folder.id}', '${folder.name}')"
                 title="Click para ver contenido">
                 
                <div class="fw-bold text-white small text-truncate pointer-events-none">${folder.name}</div>
                <span class="text-white-50 fst-italic" style="font-size: 0.65rem; opacity: 0.6;">
                     Click para ver / Arrastra videos aquí
                </span>
                <div class="text-white-50" style="font-size:0.7rem" id="count-${folder.id}">Calculando...</div>
            </div>
            
            <div class="btn-group ms-2" role="group">
                <button class="btn btn-outline-warning btn-sm px-2" onclick="clinicManager.editIntensity('${folder.id}', '${folder.name}')" title="Editar Prioridad">✏️</button>
                <button class="btn btn-outline-danger btn-sm px-2" onclick="clinicManager.deleteFolderById('${folder.id}', '${folder.name}')" title="Eliminar">🗑️</button>
            </div>
        `;
        listContainer.appendChild(div);
        this.countVideos(folder.id);
    });
}

    // Reemplaza tu función handleFileUpload por esta:
    async handleFileUpload(data) {
    console.log("🚀 INICIANDO SUBIDA - Versión Optimizada para Video");

    // 1. Detección de archivos (Compatible con Input y Drag & Drop)
    let files = (data.target && data.target.files) ? data.target.files : data;
    
    if (!files || files.length === 0) {
        console.warn("⚠️ No se seleccionaron archivos.");
        return;
    }
    const file = files[0];

    // 2. Validaciones de Seguridad
    if (!this.currentFolderId) {
        alert("⚠️ Error: No hay carpeta seleccionada. Por favor, vuelve a entrar a la carpeta.");
        return;
    }

    if (typeof gapi === 'undefined' || !gapi.client) {
        alert("⚠️ Error: La API de Google no está lista. Recarga la página (F5).");
        return;
    }

    try {
        // Feedback visual en el botón
        const btn = document.getElementById('file-upload-input')?.nextElementSibling;
        const originalText = btn ? btn.innerText : "✚ AÑADIR CONTENIDO";
        if(btn) {
            btn.innerText = "⏳ SUBIENDO...";
            btn.disabled = true;
        }

        const accessToken = gapi.client.getToken().access_token;

        // 3. METADATOS CLAVE: Aquí es donde le decimos a Drive que es un VIDEO
        const metadata = {
            'name': file.name,
            'parents': [this.currentFolderId],
            'mimeType': file.type || 'video/mp4' // Forzamos el tipo de archivo para que genere miniatura
        };

        const form = new FormData();
        // Importante: El Blob de metadatos debe ser tipo application/json
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        // 4. Petición a Google con campos de retorno específicos
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,thumbnailLink', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
            body: form
        });

        const responseData = await response.json();
        
        if (responseData.error) throw responseData.error;

        console.log("✅ Archivo subido:", responseData);
        alert(`✅ "${file.name}" subido con éxito. Google Drive está procesando la miniatura.`);
        
        // 5. Limpieza y Recarga
        if(btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }

        // Recargamos el modal y el contador de la lista principal
        this.viewFolderContent(this.currentFolderId);
        this.countVideos(this.currentFolderId);

    } catch (error) {
        console.error('Error detallado en la subida:', error);
        alert("❌ Error al subir: " + (error.message || "Problema de conexión"));
        
        const btn = document.getElementById('file-upload-input')?.nextElementSibling;
        if(btn) {
            btn.innerText = "✚ AÑADIR CONTENIDO";
            btn.disabled = false;
        }
    }
}

    async loadDashboard() {
        if (!this.accessToken) { this.tokenClient.requestAccessToken(); return; }

        // 1. BÚSQUEDA INTENSIVA DEL ID (RAM o Disco Duro)
        // Buscamos en la variable local O en la memoria del navegador directamente
        let targetId = this.selectedFolderId || localStorage.getItem('savedClinicId');

        // 2. VALIDACIÓN ESTRICTA (El cambio clave)
        // Si después de buscar no tenemos ID, NO cargamos el MasterFolder.
        // Significa que perdimos la ruta, así que volvemos al menú principal.
        if (!targetId) {
            console.warn("⚠️ Carpeta no identificada. Redirigiendo al inicio...");
            this.reset(); // Limpia todo
            this.loadClinicsFromDrive(); // Carga el menú de clínicas
            return; // DETIENE la ejecución aquí.
        }

        // Si pasamos la validación, sincronizamos todo
        this.selectedFolderId = targetId; 
        this.currentFolderId = targetId;

        // Ahora sí mostramos el dashboard
        this.showStep('step-dashboard');
        this.updatePreview(); 
        
        const listContainer = document.getElementById('folders-list');
        listContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-info small"></div></div>';

        try {
            // Usamos el ID validado (targetId)
            const q = `'${targetId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            
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

    openFolder(link) { if(link) window.open(link, '_blank'); }

    async editIntensity(id, oldName) {
        const baseName = oldName.slice(0, -1); 
        const currentInt = oldName.slice(-1);
        const newInt = prompt(`Cambiar prioridad de "${oldName}" (A, M, B):`, currentInt);
        
        if (!newInt) return; 
        const letter = newInt.toUpperCase().trim();
        if (!['A', 'M', 'B'].includes(letter)) return alert("⚠️ Letra inválida.");
        if (letter === currentInt) return; 

        const newName = baseName + letter;

        try {
            document.body.style.cursor = 'wait';
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            if (res.ok) {
                const folder = this.allFolders.find(f => f.id === id);
                if(folder) folder.name = newName;
                this.renderFolderList(this.allFolders);
            }
        } catch (e) { alert("Error de conexión."); } 
        finally { document.body.style.cursor = 'default'; }
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
        const originalText = btn.innerText;
        
        btn.innerText = "⏳";
        btn.disabled = true;

        try {
            const res = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
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
            } else {
                alert("Error al crear carpeta.");
            }
        } catch (e) { alert("Error de red."); } 
        finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }

    async deleteFolderById(folderId, name) {
        if(!confirm(`¿Eliminar carpeta "${name}"?`)) return;
        try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
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

    async viewFolderContent(folderId, folderName) {
        // 1. Preparamos el Modal

        if (folderName) {
        this.currentFolderName = folderName; // Si recibimos nombre, lo guardamos
    } else {
        folderName = this.currentFolderName; // Si no (ej: al recargar), usamos el guardado
    }

        this.currentFolderId = folderId;
        document.getElementById('modal-folder-name').innerText = folderName;
        const grid = document.getElementById('modal-files-grid');
        grid.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-info"></div><p class="mt-2 text-white-50">Cargando archivos...</p></div>';
        
        // 2. Abrimos el Modal usando Bootstrap
        // Asegúrate de que el ID coincida con el que pusiste en el HTML
        const modalEl = document.getElementById('folderContentModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        try {
            // 3. Consultamos a Google Drive
            // Buscamos: archivos dentro de la carpeta, que sean video o imagen, y no estén en la papelera
            const q = `'${folderId}' in parents and (mimeType contains 'video/' or mimeType contains 'image/') and trashed = false`;
            const fields = 'files(id, name, mimeType, thumbnailLink, webViewLink)';
            const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&key=${CONFIG.apiKey}`;
            
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.accessToken}` } });
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
                const badgeClass = isVideo ? 'badge-video' : 'badge-image';
                const badgeText = isVideo ? 'VIDEO' : 'FOTO';
                // Si Drive no da thumbnail (a veces pasa con videos nuevos), usamos el logo
                const thumbUrl = file.thumbnailLink || 'img/logoclinica.png'; 

                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3';
                col.innerHTML = `
                    <div class="file-thumbnail-card h-100">
                        <span class="file-type-badge ${badgeClass}">${badgeText}</span>
                        
                        <button class="delete-file-btn" onclick="clinicManager.deleteFile('${file.id}', '${folderId}', '${folderName}')" title="Eliminar archivo">✕</button>
                        
                        <a href="${file.webViewLink}" target="_blank">
                            <img src="${thumbUrl}" class="thumb-img" alt="${file.name}" referrerpolicy="no-referrer">
                        </a>
                        
                        <div class="p-2">
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

    // Función para borrar archivos desde el modal
    async deleteFile(fileId, folderId, folderName) {
        if(!confirm('¿Estás seguro de eliminar este archivo permanentemente?')) return;
        
        try {
            // Enviamos la orden de "trashed = true"
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${this.accessToken}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ trashed: true })
            });

            if (res.ok) {
                // Recargamos el modal para ver que desapareció
                this.viewFolderContent(folderId, folderName);
                // Actualizamos el contador de la carpeta principal
                this.countVideos(folderId);
            } else {
                alert("No se pudo eliminar. Revisa los permisos.");
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión.");
        }
    } 

    // Dentro de clinicManager:
    async subirArchivoNuevo(listaDeArchivos) {
        if (!listaDeArchivos || listaDeArchivos.length === 0) return;
        const file = listaDeArchivos[0];

        // 1. Obtener Token y Referencias de tu HTML
        const accessToken = gapi.client.getToken()?.access_token || localStorage.getItem('google_access_token');
        const container = document.getElementById('upload-progress-container');
        const statusText = document.getElementById('upload-status');
        const percentageText = document.getElementById('upload-percentage');
        const progressBar = document.getElementById('upload-progress-bar');

        if (!accessToken) {
            alert("🔒 Sesión expirada. Inicia sesión de nuevo.");
            return;
        }

        // 2. Mostrar la barra (quitando d-none) y resetear valores
        if (container) {
            container.classList.remove('d-none');
            container.classList.add('d-block');
        }
        if (progressBar) progressBar.style.width = '0%';
        if (percentageText) percentageText.innerText = '0%';
        if (statusText) statusText.innerText = `Subiendo: ${file.name}`;

        // 3. Preparar datos para Google Drive
        const metadata = { 'name': file.name, 'parents': [this.currentFolderId] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                if (progressBar) progressBar.style.width = percent + '%';
                if (percentageText) percentageText.innerText = percent + '%';
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (statusText) statusText.innerText = "✅ ¡Completado!";
                setTimeout(() => {
                    this.viewFolderContent(this.currentFolderId);
                    alert("Archivo subido con éxito.");
                }, 500);
            } else {
                alert("❌ Error en la subida: " + xhr.statusText);
            }
            
            setTimeout(() => {
                if (container) {
                    container.classList.add('d-none');
                    container.classList.remove('d-block');
                }
            }, 1500);
        };

        xhr.onerror = () => {
            alert("❌ Error de red.");
            if (container) container.classList.add('d-none');
        };

        xhr.send(form);
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
        this.playedHistory = new Set();
        this.videoCache = {}; 
        
        this.folders = { alta: [], media: [], baja: [] };
        this.allowedFolderIds = null;
        this.currentObjectUrl = null;

        if (this.videoElement) {
            this.videoElement.onended = () => this.onVideoEnded();
            this.videoElement.onerror = () => {
                console.error("❌ Error playback, recuperando...");
                this.resetFlags();
                setTimeout(() => this.playNextCycle(), 2000);
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
        if (this.videoElement) this.videoElement.volume = 1;
    }

    onVideoEnded() {
        if (this.fadeStarted) return;
        this.fadeStarted = true;
        
        if (!this.audioFadeStarted) {
            this.audioFadeStarted = true;
            this.fadeOutAudio(4); 
        }
        
        this.videoElement.classList.add('video-fade-out');
        setTimeout(() => this.playNextCycle(), 4000);
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
            this.videoElement.volume = Math.max(0, startVolume * (1 - easeOut));
            
            if (progress >= 1) {
                clearInterval(this.audioFadeInterval);
                this.videoElement.volume = 0;
            }
        }, 30);
    }

    init(folderId, allowedIds = null) {
        this.rootFolderId = folderId;
        this.allowedFolderIds = allowedIds; 
        this.videoCache = {}; 
        this.playedHistory.clear(); 
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
            }

            foldersToProcess.forEach(f => {
                const name = f.name.toUpperCase();
                if (name.endsWith('A')) this.folders.alta.push(f.id);
                else if (name.endsWith('M')) this.folders.media.push(f.id);
                else this.folders.baja.push(f.id);
            });

            console.log("📂 Playlist armada con estructura:", this.folders);
            this.playNextCycle(); 
        } catch (e) {
            console.error("Error scan:", e);
            setTimeout(() => this.playNextCycle(), 5000);
        }
    }

    async playNextCycle() {
        if (this.isLoading) return;
        this.isLoading = true;

        const now = Date.now();
        let targetFolderId = null;

        if (this.folders.alta.length > 0 && (now - this.lastPriorityUpdate.alta >= 300000)) { 
            targetFolderId = this.getRandomFolder(this.folders.alta);
            if (targetFolderId) this.lastPriorityUpdate.alta = now;
        } 
        else if (this.folders.media.length > 0 && (now - this.lastPriorityUpdate.media >= 480000)) { 
            targetFolderId = this.getRandomFolder(this.folders.media);
            if (targetFolderId) this.lastPriorityUpdate.media = now;
        } 
        else {
            let pool = [...this.folders.baja];
            if (pool.length === 0) pool = [...this.folders.media, ...this.folders.alta];
            
            if (pool.length > 1 && this.lastFolderId) {
                pool = pool.filter(id => id !== this.lastFolderId);
            }
            targetFolderId = this.getRandomFolder(pool);
        }

        this.lastFolderId = targetFolderId;

        if (targetFolderId) {
            await this.loadVideoFromFolder(targetFolderId);
        } else {
            console.log("⚠️ No hay carpetas disponibles en la playlist.");
            this.isLoading = false;
            setTimeout(() => this.playNextCycle(), 5000);
        }
    }

    getRandomFolder(list) {
        if (!list || list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    async loadVideoFromFolder(folderId) {
        try {
            if (!this.videoCache[folderId]) {
                const q = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
                const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&key=${CONFIG.apiKey}&fields=files(id,name)`;
                const headers = (window.clinicManager && window.clinicManager.accessToken) ? { 'Authorization': `Bearer ${window.clinicManager.accessToken}` } : {};
                
                const res = await fetch(url, { headers });
                const data = await res.json();
                
                if (!data.files || data.files.length === 0) {
                    this.videoCache[folderId] = []; 
                    this.isLoading = false;
                    return this.playNextCycle(); 
                }
                
                this.videoCache[folderId] = data.files;
            }

            const allVideos = this.videoCache[folderId];
            if (allVideos.length === 0) {
                this.isLoading = false;
                return this.playNextCycle();
            }

            // Lógica No-Repeat Video
            let candidates = allVideos.filter(v => !this.playedHistory.has(v.id));

            if (candidates.length === 0) {
                console.log("♻️ Reiniciando historial de carpeta.");
                allVideos.forEach(v => this.playedHistory.delete(v.id));
                candidates = [...allVideos];
            }

            const selectedVideo = candidates[Math.floor(Math.random() * candidates.length)];
            this.playedHistory.add(selectedVideo.id);

            await this.playVideoFile(selectedVideo);

        } catch (error) {
            console.error("Error cargando video:", error);
            this.resetFlags();
            setTimeout(() => this.playNextCycle(), 2000);
        }
    }

    async playVideoFile(video) {
        if (!this.videoElement) return;

        this.videoElement.classList.add('video-fade-out');
        await new Promise(r => setTimeout(r, 500));

        try {
            this.videoElement.pause();
            this.videoElement.volume = 1;
            
            if (this.currentObjectUrl) {
                URL.revokeObjectURL(this.currentObjectUrl);
                this.currentObjectUrl = null;
            }

            this.videoElement.removeAttribute('src');
            this.videoElement.load();

            const videoUrl = `https://www.googleapis.com/drive/v3/files/${video.id}?key=${CONFIG.apiKey}&alt=media`;

            if (window.clinicManager && window.clinicManager.accessToken) {
                const res = await fetch(videoUrl, { headers: { 'Authorization': `Bearer ${window.clinicManager.accessToken}` } });
                if (res.ok) {
                    const blob = await res.blob();
                    this.currentObjectUrl = URL.createObjectURL(blob);
                    this.videoElement.src = this.currentObjectUrl;
                } else {
                    this.videoElement.src = videoUrl; 
                }
            } else {
                this.videoElement.src = videoUrl;
            }

            await this.videoElement.play();
            this.videoElement.classList.remove('video-fade-out');
            console.log(`🎬 PLAY: ${video.name}`);
            
            this.resetFlags();

        } catch (e) {
            console.warn("Autoplay error:", e);
            this.videoElement.classList.remove('video-fade-out');
            this.resetFlags();
            this.playNextCycle();
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
    
    if (!container || !window.scheduleManager) return;

    const playlists = window.scheduleManager.playlists || [];
    container.innerHTML = '';

    if (playlists.length === 0) {
        container.innerHTML = '<p class="text-muted small text-center my-3">No hay playlists guardadas.</p>';
        return;
    }

    playlists.forEach(p => {
        const item = document.createElement('div');
        // Usamos flex para separar info del botón borrar
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

        <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="borrarPlaylist('${p.id}', event)" title="Eliminar">
            ×
        </button>
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
