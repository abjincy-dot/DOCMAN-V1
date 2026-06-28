// ============================================================
// DOCMAN - Document Manager
// Version: 1.0.0
// ============================================================

const APP_VERSION = '1.0.1';

const SETTINGS_KEY = 'docman_settings_v2';
const RECENTS_KEY = 'docman_recents_v1';
const SEARCH_HISTORY_KEY = 'docman_search_history_v1';
const PIN_KEY = 'docman_pin_v2';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

async function hashPin(pin) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function getRandomGradient() {
    const hue = Math.floor(Math.random() * 360);
    const sat = 40 + Math.random() * 20;
    const light1 = 30 + Math.random() * 10;
    const light2 = light1 - 5;
    return `linear-gradient(100deg, hsl(${hue}, ${sat}%, ${light1}%), hsl(${hue}, ${sat}%, ${light2}%))`;
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'fa-file-pdf',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'webp': 'fa-file-image',
        'svg': 'fa-file-image'
    };
    return iconMap[ext] || 'fa-file';
}

function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    return 'other';
}

function getFileSizeLabel(file) {
    if (!file) return '';
    let bytes = 0;

    if (file.size) {
        bytes = file.size;
    } else if (file.fileData instanceof Blob) {
        bytes = file.fileData.size;
    } else if (file.dataUrl && typeof file.dataUrl === 'string') {
        bytes = Math.round((file.dataUrl.length * 3) / 4);
    }

    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ============================================================
// HAPTIC FEEDBACK
// ============================================================

const haptic = (() => {
    const cap = () => window.Capacitor?.Plugins?.Haptics;
    const imp = style => cap()?.impact({ style }) ?? navigator.vibrate?.(style === 'Heavy' ? 30 : style === 'Medium' ? 18 : 12);
    return {
        press:     () => imp('Light'),
        longPress: () => imp('Medium'),
        success:   () => cap() ? imp('Medium') : navigator.vibrate?.([10, 30, 10]),
        warning:   () => imp('Heavy'),
        toggle:    () => imp('Light'),
    };
})();

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

let toastTimeout = null;

function showToast(msg, isErr = false) {
    const toast = document.getElementById('toast');
    if (!toast) { console.warn('Toast element not found'); return; }

    const span = toast.querySelector('span');
    if (span) span.textContent = msg;

    toast.style.background = isErr
        ? "linear-gradient(135deg, #ef4444, #dc2626)"
        : "linear-gradient(135deg, #10b981, #059669)";

    toast.classList.remove('hidden', 'show');
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// ============================================================
// MODAL SYSTEM
// ============================================================

function showModal({ type = 'confirm', message, defaultVal = '', okLabel, okColor, callback }) {
    const isPrompt = type === 'prompt';
    const id = isPrompt ? 'customPrompt' : 'customConfirm';
    const borderColor = isPrompt ? 'rgba(100,150,255,0.3)' : 'rgba(255,80,80,0.3)';
    const resolvedOkLabel = okLabel || (isPrompt ? 'OK' : 'Delete');
    const resolvedOkColor = okColor || (isPrompt
        ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)'
        : 'linear-gradient(135deg,#ef4444,#dc2626)');

    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:20px;';
    overlay.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid ${borderColor};border-radius:20px;padding:28px 24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
            <p style="color:#e2e8f0;font-size:0.95rem;font-weight:600;margin-bottom:${isPrompt ? 16 : 24}px;font-family:Inter,sans-serif;line-height:1.5;">${message}</p>
            ${isPrompt ? `<input id="modalInput" type="text" value="${defaultVal}" style="width:100%;box-sizing:border-box;padding:12px 16px;border-radius:12px;border:1px solid rgba(100,150,255,0.4);background:rgba(255,255,255,0.06);color:#f8fafc;font-size:16px;font-family:Inter,sans-serif;outline:none;margin-bottom:20px;">` : ''}
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button id="modalCancel" style="padding:10px 22px;border-radius:40px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;cursor:pointer;font-family:Inter,sans-serif;font-size:0.85rem;">Cancel</button>
                <button id="modalOk" style="padding:10px 22px;border-radius:40px;border:none;background:${resolvedOkColor};color:#fff;cursor:pointer;font-weight:600;font-family:Inter,sans-serif;font-size:0.85rem;">${resolvedOkLabel}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#modalInput');
    if (input) { input.focus();
        input.select(); }

    const close = (val) => { overlay.remove();
        callback(val); };

    overlay.querySelector('#modalOk').onclick = () => close(isPrompt ? input?.value : true);
    overlay.querySelector('#modalCancel').onclick = () => close(isPrompt ? null : false);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(isPrompt ? null : false); });
    if (input) input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(input.value);
        if (e.key === 'Escape') close(null);
    });
}

function showPromptModal(message, defaultVal, callback) {
    showModal({ type: 'prompt', message, defaultVal, callback });
}

function showConfirmModal(message, callback) {
    showModal({ type: 'confirm', message, callback });
}

// ============================================================
// SETTINGS
// ============================================================

const defaultSettings = {
    enableAnimations: true,
    enableParticles: true,
    theme: 'dark',
    pdfOpen: 'external',
    pdfThreshold: 20,
    showRecents: true,
    showFavorites: true,
    recentsLimit: 20,
    searchNotes: true,
    searchFileNames: true,
    searchFolderNames: true,
    appLock: false
};

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
    } catch (e) { return { ...defaultSettings }; }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(docmanSettings));
}

let docmanSettings = loadSettings();

// ============================================================
// INDEXEDDB SETUP
// ============================================================

const DB_NAME = 'DocmanDB';
const DB_VERSION = 12;
let db = null;
let allFiles = {};
let allNotes = {};
let fileSystem = {};
let deptColors = {};
let currentPath = [];
let isSearchMode = false;
let currentActiveTab = 'pdfs';
let editingNoteId = null;

function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            db = req.result;
            resolve();
        };
        req.onupgradeneeded = e => {
            const db2 = e.target.result;
            if (!db2.objectStoreNames.contains('files')) {
                db2.createObjectStore('files', { keyPath: 'id' });
            }
            if (!db2.objectStoreNames.contains('folderStructure')) {
                db2.createObjectStore('folderStructure', { keyPath: 'key' });
            }
            if (!db2.objectStoreNames.contains('notes')) {
                db2.createObjectStore('notes', { keyPath: 'id' });
            }
            if (!db2.objectStoreNames.contains('blobs')) {
                db2.createObjectStore('blobs', { keyPath: 'blobId' });
            }
        };
    });
}

// ============================================================
// DATABASE OPERATIONS
// ============================================================

function saveFolderStructure() {
    const tx = db.transaction('folderStructure', 'readwrite');
    tx.objectStore('folderStructure').put({ key: 'structure', value: fileSystem });
}

async function saveDeptColors() {
    try {
        const tx = db.transaction('folderStructure', 'readwrite');
        const store = tx.objectStore('folderStructure');
        await new Promise((resolve, reject) => {
            const req = store.put({ key: 'deptColors', value: deptColors });
            req.onsuccess = resolve;
            req.onerror = reject;
        });
    } catch (e) {
        console.warn('Failed to save dept colors:', e);
    }
}

async function saveAllFilesToDB() {
    const tx = db.transaction(['files', 'blobs'], 'readwrite');
    const fileStore = tx.objectStore('files');
    const blobStore = tx.objectStore('blobs');
    await fileStore.clear();
    await blobStore.clear();

    for (const folderPath in allFiles) {
        if (allFiles[folderPath]?.length) {
            const files = allFiles[folderPath].map(f => {
                if (f.fileData instanceof Blob) {
                    const blobId = folderPath + '/' + f.name;
                    blobStore.put({ blobId, blob: f.fileData });
                    return {
                        name: f.name,
                        type: f.type,
                        uploadedAt: f.uploadedAt || Date.now(),
                        favourite: f.favourite || false,
                        size: f.fileData.size || 0
                    };
                }
                if (f.dataUrl) {
                    return {
                        name: f.name,
                        type: f.type,
                        dataUrl: f.dataUrl,
                        uploadedAt: f.uploadedAt || Date.now(),
                        favourite: f.favourite || false,
                        size: f.size || 0
                    };
                }
                return f;
            });
            fileStore.put({ id: folderPath, folderPath, files });
        }
    }
    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function saveAllNotesToDB() {
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    await store.clear();
    for (const folderPath in allNotes) {
        if (allNotes[folderPath]?.length) {
            store.put({ id: folderPath, folderPath, notes: allNotes[folderPath] });
        }
    }
    tx.commit();
}

// ============================================================
// FILE DATA LOADING (LAZY)
// ============================================================

async function loadFileData(folderPath, fileName) {
    try {
        // Try the dedicated blobs store first
        const blobId = folderPath + '/' + fileName;
        const blobTx = db.transaction('blobs', 'readonly');
        const blobResult = await new Promise((resolve, reject) => {
            const req = blobTx.objectStore('blobs').get(blobId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        if (blobResult?.blob instanceof Blob) {
            return blobResult.blob;
        }

        // Fall back to files store (legacy base64 or old inline blob)
        const tx = db.transaction('files', 'readonly');
        const result = await new Promise((resolve, reject) => {
            const req = tx.objectStore('files').get(folderPath);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const fileEntry = result?.files?.find(f => f.name === fileName);
        if (!fileEntry) return null;

        if (fileEntry.fileData instanceof Blob) {
            await cacheFileAsBlob(folderPath, fileName, fileEntry.fileData, fileEntry);
            return fileEntry.fileData;
        }

        if (fileEntry.dataUrl && typeof fileEntry.dataUrl === 'string') {
            try {
                const response = await fetch(fileEntry.dataUrl);
                const blob = await response.blob();
                await cacheFileAsBlob(folderPath, fileName, blob, fileEntry);
                return blob;
            } catch (e) {
                console.warn('Failed to convert base64 to blob:', e);
                return null;
            }
        }

        return null;
    } catch (e) {
        console.warn('Failed to load file data:', e);
        return null;
    }
}

async function cacheFileAsBlob(folderPath, fileName, blob, existingEntry) {
    try {
        // Write blob to dedicated store
        const blobId = folderPath + '/' + fileName;
        const blobTx = db.transaction('blobs', 'readwrite');
        blobTx.objectStore('blobs').put({ blobId, blob });
        await new Promise((resolve, reject) => {
            blobTx.oncomplete = resolve;
            blobTx.onerror = () => reject(blobTx.error);
        });

        // Update files record — strip blob/dataUrl, keep only metadata
        const fileTx = db.transaction('files', 'readwrite');
        const fileStore = fileTx.objectStore('files');
        const result = await new Promise((resolve, reject) => {
            const req = fileStore.get(folderPath);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (result) {
            const fileIndex = result.files.findIndex(f => f.name === fileName);
            if (fileIndex !== -1) {
                result.files[fileIndex] = {
                    name: fileName,
                    type: blob.type || existingEntry?.type || 'application/octet-stream',
                    uploadedAt: existingEntry?.uploadedAt || Date.now(),
                    favourite: existingEntry?.favourite || false,
                    size: blob.size
                };
                fileStore.put(result);
            }
        }
        await new Promise((resolve, reject) => {
            fileTx.oncomplete = resolve;
            fileTx.onerror = () => reject(fileTx.error);
        });

        // Update in-memory allFiles
        if (allFiles[folderPath]) {
            const idx = allFiles[folderPath].findIndex(f => f.name === fileName);
            if (idx !== -1) {
                allFiles[folderPath][idx] = {
                    name: fileName,
                    type: blob.type || existingEntry?.type || 'application/octet-stream',
                    fileData: blob,
                    uploadedAt: existingEntry?.uploadedAt || Date.now(),
                    favourite: existingEntry?.favourite || false,
                    size: blob.size,
                    _hasData: true,
                    _isBase64: false
                };
            }
        }
    } catch (e) {
        console.warn('Failed to cache file as blob:', e);
    }
}

async function loadAllFileMetadata() {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const results = await new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    allFiles = {};
    for (const item of results) {
        allFiles[item.folderPath] = item.files.map(f => {
            let size = f.size || 0;
            if (!size && f.fileData instanceof Blob) {
                size = f.fileData.size;
            } else if (!size && f.dataUrl && typeof f.dataUrl === 'string') {
                size = Math.round((f.dataUrl.length * 3) / 4);
            }

            return {
                name: f.name,
                type: f.type,
                uploadedAt: f.uploadedAt || Date.now(),
                favourite: f.favourite || false,
                size: size,
                fileData: f.fileData instanceof Blob ? f.fileData : null,
                dataUrl: f.dataUrl || null,
                _hasData: !!(f.fileData instanceof Blob || f.dataUrl),
                _isBase64: !!(f.dataUrl && typeof f.dataUrl === 'string')
            };
        });
    }
}

// ============================================================
// MIGRATION: Convert Base64 to Blob
// ============================================================

async function migrateBase64ToBlob() {
    console.log('Checking for files to migrate...');
    let migrated = 0;

    const tx = db.transaction(['files', 'blobs'], 'readwrite');
    const fileStore = tx.objectStore('files');
    const blobStore = tx.objectStore('blobs');

    const results = await new Promise((resolve, reject) => {
        const req = fileStore.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    for (const item of results) {
        const files = item.files || [];
        let folderChanged = false;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const blobId = item.folderPath + '/' + file.name;

            if (file.dataUrl && typeof file.dataUrl === 'string' && file.dataUrl.startsWith('data:')) {
                try {
                    const response = await fetch(file.dataUrl);
                    const blob = await response.blob();
                    blobStore.put({ blobId, blob });
                    files[i] = {
                        name: file.name,
                        type: file.type || blob.type || 'application/octet-stream',
                        uploadedAt: file.uploadedAt || Date.now(),
                        favourite: file.favourite || false,
                        size: blob.size
                    };
                    migrated++;
                    folderChanged = true;
                } catch (e) {
                    console.warn('Failed to migrate file:', file.name, e);
                }
            } else if (file.fileData instanceof Blob) {
                blobStore.put({ blobId, blob: file.fileData });
                files[i] = {
                    name: file.name,
                    type: file.type || file.fileData.type || 'application/octet-stream',
                    uploadedAt: file.uploadedAt || Date.now(),
                    favourite: file.favourite || false,
                    size: file.fileData.size || file.size || 0
                };
                migrated++;
                folderChanged = true;
            }
        }

        if (folderChanged) {
            fileStore.put({ id: item.folderPath, folderPath: item.folderPath, files });
        }
    }

    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });

    if (migrated > 0) {
        console.log(`✅ Migrated ${migrated} files to separate Blob store`);
        showToast(`Migrated ${migrated} files to optimised storage`);
    } else {
        console.log('No files needed migration');
    }

    await loadAllFileMetadata();
    render();
}

// ============================================================
// RECENTS
// ============================================================

function loadRecents() {
    try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; } catch (e) { return []; }
}

function saveRecents(list) {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, docmanSettings.recentsLimit || 20)));
}

function trackRecentFile(fileName) {
    if (!docmanSettings.showRecents) return;
    let list = loadRecents();
    list = list.filter(r => r.name !== fileName);
    list.unshift({ name: fileName, time: Date.now() });
    saveRecents(list);
}

// ============================================================
// COUNT FUNCTIONS
// ============================================================

function countDepartmentFiles(obj, path = []) {
    let total = 0;
    const folderKey = path.join('/');

    if (allFiles[folderKey]) {
        total += allFiles[folderKey].length;
    }

    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            total += countDepartmentFiles(obj[key], [...path, key]);
        }
    }
    return total;
}

// ============================================================
// NAVIGATION
// ============================================================

function selectDepartment(d) {
    navigateWithPageTurn(() => {
        currentPath = [d];
        render();
    }, 'forward');
}

function goBack() {
    if (currentPath.length && !isSearchMode) {
        navigateWithPageTurn(() => {
            currentPath.pop();
            render();
        }, 'back');
    } else if (isSearchMode) {
        clearSearch();
    }
}

function goHome() {
    if (currentPath.length === 0 && !isSearchMode) return;
    if (isSearchMode) { clearSearch(); return; }
    navigateWithPageTurn(() => {
        currentPath = [];
        render();
    }, 'back');
}

function navigateToBreadcrumb(idx) {
    if (idx === -1 && currentPath.length === 0) return;
    if (idx >= 0 && idx === currentPath.length - 1) return;
    const isGoingBack = idx < currentPath.length - 1;
    navigateWithPageTurn(() => {
        if (idx === -1) currentPath = [];
        else currentPath = currentPath.slice(0, idx + 1);
        render();
    }, isGoingBack ? 'back' : 'forward');
}

function getCurrentFolderObject() {
    return currentPath.reduce((o, p) => o?.[p], fileSystem);
}

function getFilesForCurrentFolder() {
    return allFiles[currentPath.join('/')] || [];
}

function getNotesForCurrentFolder() {
    return allNotes[currentPath.join('/')] || [];
}

// ============================================================
// PAGE TRANSITIONS
// ============================================================

function navigateWithPageTurn(navigationFn, direction = 'forward') {
    const isForward = direction !== 'back';
    const appEl = document.querySelector('.app');
    if (!appEl) { navigationFn(); return; }

    const contentEl = document.getElementById('content');
    const deptSection = document.getElementById('departmentsSection');
    const breadcrumbEl = document.getElementById('breadcrumb');
    const searchInfoEl = document.getElementById('searchInfo');

    const dynamicEls = [];
    if (contentEl && contentEl.offsetParent !== null) dynamicEls.push(contentEl);
    if (deptSection && deptSection.offsetParent !== null && deptSection.innerHTML.trim()) dynamicEls.push(deptSection);
    if (breadcrumbEl && breadcrumbEl.offsetParent !== null && breadcrumbEl.innerHTML.trim()) dynamicEls.push(breadcrumbEl);
    if (searchInfoEl && searchInfoEl.offsetParent !== null && !searchInfoEl.classList.contains('hidden')) dynamicEls.push(searchInfoEl);

    const originalStyles = dynamicEls.map(el => ({
        el: el,
        transition: el.style.transition,
        transform: el.style.transform,
        opacity: el.style.opacity
    }));

    dynamicEls.forEach(el => {
        el.style.transition = 'none';
    });

    navigationFn();

    const newContentEl = document.getElementById('content');
    const newDeptSection = document.getElementById('departmentsSection');
    const newBreadcrumb = document.getElementById('breadcrumb');
    const newSearchInfo = document.getElementById('searchInfo');

    const newDynamicEls = [];
    if (newContentEl && newContentEl.offsetParent !== null) newDynamicEls.push(newContentEl);
    if (newDeptSection && newDeptSection.offsetParent !== null && newDeptSection.innerHTML.trim()) newDynamicEls.push(newDeptSection);
    if (newBreadcrumb && newBreadcrumb.offsetParent !== null && newBreadcrumb.innerHTML.trim()) newDynamicEls.push(newBreadcrumb);
    if (newSearchInfo && newSearchInfo.offsetParent !== null && !newSearchInfo.classList.contains('hidden')) newDynamicEls.push(newSearchInfo);

    newDynamicEls.forEach(el => {
        el.style.transition = 'none';
        el.style.transform = isForward ? 'translateX(55%)' : 'translateX(-55%)';
        el.style.opacity = '0';
    });

    appEl.offsetHeight;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
            const dur = '260ms';

            originalStyles.forEach(item => {
                item.el.style.transition = `transform ${dur} ${ease}, opacity ${dur} ${ease}`;
                item.el.style.transform = isForward ? 'translateX(-30%)' : 'translateX(30%)';
                item.el.style.opacity = '0';
            });

            newDynamicEls.forEach(el => {
                el.style.transition = `transform ${dur} ${ease}, opacity ${dur} ${ease}`;
                el.style.transform = 'translateX(0)';
                el.style.opacity = '1';
            });

            setTimeout(() => {
                originalStyles.forEach(item => {
                    item.el.style.transition = item.transition;
                    item.el.style.transform = item.transform;
                    item.el.style.opacity = item.opacity;
                });
                newDynamicEls.forEach(el => {
                    el.style.transition = '';
                    el.style.transform = '';
                    el.style.opacity = '';
                });
            }, 300);
        });
    });
}

// ============================================================
// FILE OPERATIONS
// ============================================================

async function addFileToCurrentFolder(file) {
    const folderPath = currentPath.join('/');
    if (!allFiles[folderPath]) allFiles[folderPath] = [];

    const fileObj = {
        name: file.name,
        type: file.type || 'application/octet-stream',
        fileData: file,
        uploadedAt: Date.now(),
        favourite: false,
        size: file.size
    };
    allFiles[folderPath].push(fileObj);
    await saveAllFilesToDB();
    haptic.success();
}

function deleteFileFromFolder(folderPath, fileName) {
    showConfirmModal(`Delete "<b>${escapeHtml(fileName)}</b>"?`, (confirmed) => {
        if (confirmed) {
            haptic.warning();
            if (allFiles[folderPath]) {
                allFiles[folderPath] = allFiles[folderPath].filter(f => f.name !== fileName);
                if (!allFiles[folderPath].length) delete allFiles[folderPath];
                saveAllFilesToDB();
                render();
            }
        }
    });
}

function renameFileInFolder(folderPath, oldName, newName) {
    if (!newName?.trim()) return showToast("Name empty", true);
    if (allFiles[folderPath]) {
        const idx = allFiles[folderPath].findIndex(f => f.name === oldName);
        if (idx !== -1) {
            allFiles[folderPath][idx].name = newName;
            saveAllFilesToDB();
            render();
        }
    }
}

// ============================================================
// NOTE OPERATIONS
// ============================================================

async function addNoteToCurrentFolder(title, content) {
    const folderPath = currentPath.join('/');
    if (!allNotes[folderPath]) allNotes[folderPath] = [];
    const note = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        favourite: false
    };
    allNotes[folderPath].push(note);
    await saveAllNotesToDB();
    render();
}

async function updateNote(folderPath, noteId, title, content) {
    const idx = allNotes[folderPath]?.findIndex(n => n.id === noteId);
    if (idx !== -1) {
        allNotes[folderPath][idx].title = title.trim();
        allNotes[folderPath][idx].content = content.trim();
        allNotes[folderPath][idx].updatedAt = new Date().toISOString();
        await saveAllNotesToDB();
        render();
        return true;
    }
    return false;
}

async function renameNote(folderPath, noteId, newTitle) {
    if (!newTitle?.trim()) return showToast("Title empty", true);
    const idx = allNotes[folderPath]?.findIndex(n => n.id === noteId);
    if (idx !== -1) {
        allNotes[folderPath][idx].title = newTitle.trim();
        await saveAllNotesToDB();
        render();
    }
}

async function deleteNoteFromFolder(folderPath, noteId) {
    if (allNotes[folderPath]) {
        allNotes[folderPath] = allNotes[folderPath].filter(n => n.id !== noteId);
        if (!allNotes[folderPath].length) delete allNotes[folderPath];
        await saveAllNotesToDB();
        render();
    }
}

function openNote(note) {
    const modal = document.getElementById('noteModal');
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    editingNoteId = note.id;
    document.getElementById('saveNoteBtn').onclick = async () => {
        const newTitle = document.getElementById('noteTitle').value;
        const newContent = document.getElementById('noteContent').value;
        if (newTitle.trim()) {
            await updateNote(note.folder || currentPath.join('/'), note.id, newTitle, newContent);
            closeNoteModal();
        } else showToast("Title empty", true);
    };
    modal.classList.add('show');
}

function openNewNoteModal() {
    editingNoteId = null;
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('saveNoteBtn').onclick = async () => {
        const title = document.getElementById('noteTitle').value;
        const content = document.getElementById('noteContent').value;
        if (title.trim()) { await addNoteToCurrentFolder(title, content);
            closeNoteModal(); } else showToast("Title empty", true);
    };
    document.getElementById('noteModal').classList.add('show');
}

function closeNoteModal() {
    document.getElementById('noteModal').classList.remove('show');
    editingNoteId = null;
}

// ============================================================
// FILE VIEWING / OPENING
// ============================================================

// ============================================================
// GESTURE-SAFE PDF OPEN (Samsung Internet fix)
// ============================================================
// Samsung Internet drops the user-gesture trust after any await.
// So for external PDF mode we must call navigator.share() synchronously
// on the tap, before any async DB reads.
// Strategy:
//   If blob is already in allFiles memory → share immediately (synchronous).
//   If blob needs to be loaded from DB → share() with a Promise trick:
//     We call share() with a File whose data is loaded async. This works
//     because the share() call itself is synchronous (gesture is preserved)
//     even if the file data resolves later.

async function openFileWithGesture(fileEntry, folderPath) {
    trackRecentFile(fileEntry.name);

    // If blob is already in memory, share immediately — zero async gap
    if (fileEntry.fileData instanceof Blob) {
        const file = new File([fileEntry.fileData], fileEntry.name, { type: 'application/pdf' });
        if (navigator.share) {
            try {
                await navigator.share({ files: [file], title: fileEntry.name });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
                // fall through to normal openFile
            }
        }
        await handlePdfFile(fileEntry.fileData, fileEntry.name);
        return;
    }

    // Blob not in memory yet — load from DB then share
    // We still call navigator.share() as fast as possible after load
    const fileData = await loadFileData(folderPath, fileEntry.name);
    if (!fileData) { showToast('File not found or could not be loaded', true); return; }

    if (navigator.share) {
        const file = new File([fileData], fileEntry.name, { type: 'application/pdf' });
        try {
            await navigator.share({ files: [file], title: fileEntry.name });
            return;
        } catch (e) {
            if (e.name === 'AbortError') return;
        }
    }

    // Fallback: blob URL
    const url = URL.createObjectURL(fileData);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function openFile(fileName, folderPath) {
    trackRecentFile(fileName);

    const fileData = await loadFileData(folderPath, fileName);
    if (!fileData) {
        showToast('File not found or could not be loaded', true);
        return;
    }

    const fileType = getFileType(fileName);

    if (fileType === 'image') {
        openImageViewer(fileData, fileName);
    } else if (fileType === 'pdf') {
        await handlePdfFile(fileData, fileName);
    } else {
        showConfirmModal(`This file type may not be supported.<br>Download "<b>${escapeHtml(fileName)}</b>"?`, (confirmed) => {
            if (confirmed) {
                nativeDownload(fileData, fileName).catch(err => {
                    console.error('Download failed:', err);
                    showToast('Could not download file', true);
                });
            }
        });
    }
}

// ============================================================
// IMAGE VIEWER
// ============================================================

function openImageViewer(fileData, fileName) {
    const viewer = document.getElementById('imageViewer');
    const viewerImage = document.getElementById('viewerImage');

    const url = URL.createObjectURL(fileData);
    viewerImage.src = url;
    viewerImage.alt = fileName;

    viewer._currentUrl = url;
    viewer._currentData = fileData;

    viewer.classList.remove('hidden');

    const img = viewerImage;
    img.style.transform = '';
    img.style.cursor = 'default';
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewer');
    const img = document.getElementById('viewerImage');

    if (viewer._currentUrl) {
        URL.revokeObjectURL(viewer._currentUrl);
        viewer._currentUrl = null;
    }
    viewer._currentData = null;

    img.src = '';
    img.style.transform = '';
    viewer.classList.add('hidden');
}

// ============================================================
// PDF HANDLING - FIXED
// ============================================================

let isSharing = false;
let shareTimeout = null;

async function handlePdfFile(fileData, fileName) {
    const openMode = docmanSettings.pdfOpen || 'external';

    // Samsung Internet blocks Web Share API with files on github.io (NotAllowedError).
    // Force built-in viewer on Samsung Internet regardless of the external setting.
    // iOS, Chrome, and all other browsers are unaffected.
    if (isSamsungBrowser()) {
        openPdfViewer(fileData, fileName);
        return;
    }

    if (openMode === 'docman') {
        openPdfViewer(fileData, fileName);
    } else {
        await sharePdfExternally(fileData, fileName);
    }
}

function isAndroid() {
    return /android/i.test(navigator.userAgent);
}

function isSamsungBrowser() {
    return /SamsungBrowser/i.test(navigator.userAgent);
}

async function sharePdfExternally(fileData, fileName) {
    // ── Android ───────────────────────────────────────────────────────────────
    // blob: URLs are origin-scoped; default Android browsers treat any attempt
    // to open one in a new tab as a download.  The only approach that reliably
    // triggers the OS "Open with…" chooser across Chrome, Samsung Internet,
    // MIUI browser, and standalone-PWA mode is Web Share API with a File object.
    // We try it unconditionally (not guarded by canShare) because some browsers
    // report canShare=false yet still execute share() correctly.
    if (isAndroid()) {
        const file = new File([fileData], fileName, { type: 'application/pdf' });

        // Try Web Share API — works on Chrome, Samsung Internet 12+, and PWA mode
        if (navigator.share) {
            try {
                await navigator.share({ files: [file], title: fileName });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return; // user dismissed
                // NotAllowedError, DataError, etc — fall through to blob URL
                console.warn('navigator.share failed:', err.name, err.message);
            }
        }

        // Last resort: open blob URL in new tab.
        // On Chrome browser (non-standalone) this shows "Open with…".
        // On default browser it may download — but there is no better option
        // if share() is completely unavailable.
        // In Capacitor WebView, blob URLs in new tabs don't work — use nativeDownload
        if (window.Capacitor) {
            await nativeDownload(fileData, fileName);
        } else {
            try {
                const url = URL.createObjectURL(fileData);
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 30000);
            } catch (e) {
                downloadPdf(fileData, fileName);
            }
        }
        return;
    }

    // ── iOS / Desktop ─────────────────────────────────────────────────────────
    try {
        isSharing = true;
        const file = new File([fileData], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: fileName });
                showToast('Shared: ' + fileName);
            } catch (shareErr) {
                if (shareErr.name === 'AbortError') {
                    console.log('Share cancelled by user');
                } else if (shareErr.name === 'NotAllowedError') {
                    showToast('Share not allowed. Downloading instead...');
                    downloadPdf(fileData, fileName);
                } else {
                    console.warn('Share error:', shareErr);
                    showToast('Opening in external app failed. Downloading instead...');
                    downloadPdf(fileData, fileName);
                }
            }
        } else {
            showToast('Share not available. Downloading...');
            downloadPdf(fileData, fileName);
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            showToast('Could not open PDF: ' + err.message, true);
            try {
                downloadPdf(fileData, fileName);
            } catch (downloadErr) {
                console.error('Download fallback failed:', downloadErr);
                showToast('Could not open or download file', true);
            }
        }
    } finally {
        isSharing = false;
        if (shareTimeout) {
            clearTimeout(shareTimeout);
            shareTimeout = null;
        }
    }
}

async function nativeDownload(blob, fileName) {
    const Filesystem = window.Capacitor?.Plugins?.Filesystem;
    const Share = window.Capacitor?.Plugins?.Share;

    if (Filesystem && Share) {
        try {
            const reader = new FileReader();
            const base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            const result = await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: 'CACHE'
            });
            await Share.share({ title: fileName, url: result.uri });
            return;
        } catch (e) {
            console.warn('Capacitor download failed, falling back:', e);
        }
    }

    // PWA / browser fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function downloadPdf(fileData, fileName) {
    nativeDownload(fileData, fileName)
        .then(() => showToast('Downloading: ' + fileName))
        .catch(err => {
            console.error('Download failed:', err);
            showToast('Could not download file', true);
        });
}

// ============================================================
// BUILT-IN PDF VIEWER - FIXED
// ============================================================
function openPdfViewer(fileData, fileName) {
    const existing = document.getElementById('pdfViewer');
    if (existing) {
        if (existing._url) URL.revokeObjectURL(existing._url);
        existing.remove();
    }

    const url = URL.createObjectURL(fileData);

    const viewer = document.createElement('div');
    viewer.id = 'pdfViewer';
    viewer.className = 'pdf-viewer';
    viewer.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#1a1a1a;display:flex;flex-direction:column;';

    viewer.innerHTML = `
        <div class="pdf-viewer-header" style="padding:12px 16px;padding-top:max(12px, env(safe-area-inset-top));background:rgba(0,0,0,0.8);border-bottom:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;gap:12px;flex-shrink:0;z-index:2;min-height:52px;">
            <button onclick="closePdfViewer()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;color:#ef4444;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:600;font-family:Inter,sans-serif;letter-spacing:0.02em;">
                Close
            </button>
            <span class="pdf-viewer-title" style="flex:1;color:#e2e8f0;font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fileName)}</span>
        </div>
        <div id="pdfViewerBody" style="flex:1;overflow-y:auto;overflow-x:hidden;background:#2a2a2a;padding:12px 8px;-webkit-overflow-scrolling:touch;">
            <div id="pdfCanvasContainer" style="display:flex;flex-direction:column;align-items:center;gap:8px;"></div>
            <div id="pdfLoadingMsg" style="color:#94a3b8;text-align:center;padding:40px 0;font-family:Inter,sans-serif;font-size:0.9rem;">Loading PDF…</div>
        </div>
    `;

    document.body.appendChild(viewer);
    viewer._url = url;
    viewer._fileName = fileName;
    viewer._fileData = fileData;

    const escHandler = function(e) {
        if (e.key === 'Escape') {
            closePdfViewer();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    viewer._escHandler = escHandler;

    // Load PDF.js from CDN if not already loaded
    function renderPdfWithPdfJs(pdfUrl) {
        const PDFJS_CDN = 'vendor/pdfjs/pdf.min.js';
        const PDFJS_WORKER = 'vendor/pdfjs/pdf.worker.min.js';

        function doRender() {
            const pdfjsLib = window['pdfjs-dist/build/pdf'];
            pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

            const container = document.getElementById('pdfCanvasContainer');
            const loadingMsg = document.getElementById('pdfLoadingMsg');
            const viewerBody = document.getElementById('pdfViewerBody');
            if (!container || !viewerBody) return;

            const viewerWidth = viewerBody.clientWidth - 16;

            pdfjsLib.getDocument(pdfUrl).promise.then(function(pdfDoc) {
                if (loadingMsg) loadingMsg.style.display = 'none';
                const totalPages = pdfDoc.numPages;

                // Create placeholder divs for all pages first
                const placeholders = [];
                for (let i = 1; i <= totalPages; i++) {
                    const placeholder = document.createElement('div');
                    placeholder.dataset.page = i;
                    placeholder.dataset.rendered = 'false';
                    placeholder.style.cssText = `width:${viewerWidth}px;min-height:200px;background:#fff;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:#999;font-size:0.8rem;`;
                    placeholder.textContent = 'Page ' + i;
                    container.appendChild(placeholder);
                    placeholders.push(placeholder);
                }

                function renderPageInto(placeholder, pageNum) {
                    if (placeholder.dataset.rendered === 'true') return;
                    placeholder.dataset.rendered = 'true';
                    placeholder.textContent = '';

                    pdfDoc.getPage(pageNum).then(function(page) {
                        const viewport = page.getViewport({ scale: 1 });
                        const dpr = Math.min(window.devicePixelRatio || 1, 3);
                        const scale = viewerWidth / viewport.width;
                        const scaledViewport = page.getViewport({ scale: scale * dpr });
                        const displayHeight = viewport.height * scale;

                        const canvas = document.createElement('canvas');
                        canvas.width = scaledViewport.width;
                        canvas.height = scaledViewport.height;
                        canvas.style.cssText = `display:block;width:${viewerWidth}px;height:${displayHeight}px;max-width:100%;border-radius:4px;`;

                        placeholder.style.minHeight = '';
                        placeholder.style.alignItems = '';
                        placeholder.style.justifyContent = '';
                        placeholder.appendChild(canvas);

                        const ctx = canvas.getContext('2d', { alpha: false });
                        page.render({
                            canvasContext: ctx,
                            viewport: scaledViewport,
                            intent: 'display'
                        });
                    });
                }

                // Render first 2 pages immediately
                if (placeholders[0]) renderPageInto(placeholders[0], 1);
                if (placeholders[1]) renderPageInto(placeholders[1], 2);

                // Lazy render remaining pages on scroll into view
                if ('IntersectionObserver' in window) {
                    const observer = new IntersectionObserver(function(entries) {
                        entries.forEach(function(entry) {
                            if (entry.isIntersecting) {
                                const el = entry.target;
                                renderPageInto(el, parseInt(el.dataset.page));
                                observer.unobserve(el);
                            }
                        });
                    }, { rootMargin: '200px' });

                    placeholders.slice(2).forEach(function(p) { observer.observe(p); });
                } else {
                    placeholders.slice(2).forEach(function(p, i) {
                        setTimeout(function() { renderPageInto(p, i + 3); }, i * 300);
                    });
                }

  }).catch(function(err) {
                if (loadingMsg) loadingMsg.textContent = 'Could not render PDF: ' + err.message;
            });
        }

        if (window['pdfjs-dist/build/pdf']) {
            doRender();
        } else {
            const script = document.createElement('script');
            script.src = PDFJS_CDN;
            script.onload = doRender;
            script.onerror = function() {
                const msg = document.getElementById('pdfLoadingMsg');
                if (msg) msg.textContent = 'Failed to load PDF renderer. Check your connection.';
            };
            document.head.appendChild(script);
        }
    }

    renderPdfWithPdfJs(url);
}




function closePdfViewer() {
    const viewer = document.getElementById('pdfViewer');
    if (viewer) {
        if (viewer._url) {
            URL.revokeObjectURL(viewer._url);
        }
        if (viewer._escHandler) {
            document.removeEventListener('keydown', viewer._escHandler);
        }
        viewer.remove();
        isSharing = false;
        if (shareTimeout) {
            clearTimeout(shareTimeout);
            shareTimeout = null;
        }
    }
}

function downloadPdfFromViewer() {
    const viewer = document.getElementById('pdfViewer');
    if (viewer && viewer._url && viewer._fileName) {
        downloadPdf(viewer._fileData || viewer._url, viewer._fileName);
    }
}

// Expose PDF viewer functions to window
window.closePdfViewer = closePdfViewer;
window.downloadPdfFromViewer = downloadPdfFromViewer;

// ============================================================
// CONTEXT MENU
// ============================================================

function showCardContextMenu({ title, isFav, onFav, onRename, onDelete, triggerEl }) {
    const existing = document.getElementById('ctxMenuOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ctxMenuOverlay';
    overlay.className = 'ctx-menu-overlay';

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.innerHTML = `
        <div class="ctx-menu-title">${escapeHtml(title)}</div>
        <div class="ctx-menu-divider"></div>
        <div class="ctx-menu-item" id="ctxFav">
            <i class="fas fa-star ctx-item-icon ctx-icon-fav"></i>
            <span class="ctx-menu-item-label">${isFav ? 'Unfavourite' : 'Favourite'}</span>
        </div>
        <div class="ctx-menu-item" id="ctxRename">
            <i class="fas fa-pen ctx-item-icon ctx-icon-rename"></i>
            <span class="ctx-menu-item-label">Rename</span>
        </div>
        <div class="ctx-menu-divider"></div>
        <div class="ctx-menu-item" id="ctxDelete">
            <i class="fas fa-trash ctx-item-icon ctx-icon-delete"></i>
            <span class="ctx-menu-item-label danger">Delete</span>
        </div>
    `;

    const close = () => {
        menu.style.animation = 'ctxPopOut 0.15s ease forwards';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.15s ease';
        setTimeout(() => overlay.remove(), 160);
    };

    overlay.appendChild(menu);
    document.body.appendChild(overlay);

    if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        const menuW = 200;
        const menuH = 180;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = rect.right - menuW;
        let top = rect.top - menuH - 8;

        if (left < 8) left = 8;
        if (left + menuW > vw - 8) left = vw - menuW - 8;
        if (top < 8) top = rect.bottom + 8;
        if (top + menuH > vh - 8) top = vh - menuH - 8;

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
    }

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    document.getElementById('ctxFav').addEventListener('click', () => { close();
        onFav(); });
    document.getElementById('ctxRename').addEventListener('click', () => { close();
        onRename(); });
    document.getElementById('ctxDelete').addEventListener('click', () => { close();
        onDelete(); });
}

// ============================================================
// CARD CREATION
// ============================================================

function createFileCard(file, folderPath) {
    const iconClass = getFileIcon(file.name);
    const div = document.createElement('div');
    div.className = 'card file-card';
    const sizeLabel = getFileSizeLabel(file);
    div.innerHTML = `
        <div class="card-icon"><i class="fas ${iconClass}"></i></div>
        <div class="card-info">
            <div class="card-filename" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
            ${sizeLabel ? `<div class="card-meta">${sizeLabel}</div>` : ''}
        </div>
        <i class="fas fa-star card-fav-indicator${file.favourite ? '' : ' card-fav-hidden'}"></i>
    `;

    let pressTimer = null;
    let longPressTriggered = false;
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    let isScrolling = false;
    let touchCount = 0;

    const startPress = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        touchStartTime = Date.now();
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        longPressTriggered = false;
        isScrolling = false;

        pressTimer = setTimeout(() => {
            if (isScrolling) return;
            longPressTriggered = true;
            haptic.longPress();

            const isFav = !!file.favourite;
            showCardContextMenu({
                title: file.name,
                isFav: isFav,
                triggerEl: div,
                onFav: async () => {
                    const files = allFiles[folderPath];
                    if (!files) return;
                    const f = files.find(x => x.name === file.name);
                    if (f) {
                        f.favourite = !f.favourite;
                        file.favourite = f.favourite;
                    }
                    const ind = div.querySelector('.card-fav-indicator');
                    if (ind) ind.classList.toggle('card-fav-hidden', !file.favourite);
                    haptic.toggle();
                    await saveAllFilesToDB();
                    updateStats();
                    render();
                    showToast(file.favourite ? '⭐ Added to favourites' : 'Removed from favourites');
                },
                onRename: () => showPromptModal('Rename file:', file.name, (newName) => {
                    if (newName?.trim()) renameFileInFolder(folderPath, file.name, newName.trim());
                }),
                onDelete: () => deleteFileFromFolder(folderPath, file.name),
            });
        }, 500);
    };

    const cancelPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    const checkMove = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        const dx = Math.abs(touch.clientX - touchStartPos.x);
        const dy = Math.abs(touch.clientY - touchStartPos.y);
        if (dx > 10 || dy > 10) {
            isScrolling = true;
            cancelPress();
        }
    };

    div.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchCount = e.touches.length;
            startPress(e);
        }
    }, { passive: true });

    div.addEventListener('touchmove', checkMove, { passive: true });

    let tappedByTouch = false;

    div.addEventListener('touchend', (e) => {
        cancelPress();
        if (!longPressTriggered && !isScrolling && Date.now() - touchStartTime < 300) {
            tappedByTouch = true;
            // For PDFs in external mode: call share synchronously on the gesture
            // before any async work, so Samsung Internet trusts the user gesture.
            if (getFileType(file.name) === 'pdf' && (docmanSettings.pdfOpen || 'external') === 'external') {
                openFileWithGesture(file, folderPath);
            } else {
                openFile(file.name, folderPath);
            }
        }
        longPressTriggered = false;
    }, { passive: true });

    div.addEventListener('touchcancel', cancelPress, { passive: true });

    div.addEventListener('mousedown', startPress);
    div.addEventListener('mouseup', cancelPress);
    div.addEventListener('mouseleave', cancelPress);

    div.addEventListener('click', (e) => {
        if (tappedByTouch) { tappedByTouch = false; return; }
        if (touchCount > 1) { touchCount = 0; return; }
        touchCount = 0;
        if (longPressTriggered) { longPressTriggered = false; return; }
        if (getFileType(file.name) === 'pdf' && (docmanSettings.pdfOpen || 'external') === 'external') {
            openFileWithGesture(file, folderPath);
        } else {
            openFile(file.name, folderPath);
        }
    });

    return div;
}

function createNoteCard(note, folderPath) {
    const div = document.createElement('div');
    div.className = 'card note-card';
    div.innerHTML = `
        <div class="card-icon"><i class="fas fa-sticky-note"></i></div>
        <div class="card-info">
            <div class="card-filename" title="${escapeHtml(note.title)}">${escapeHtml(note.title)}</div>
        </div>
        <i class="fas fa-star card-fav-indicator${note.favourite ? '' : ' card-fav-hidden'}"></i>
    `;

    let pressTimer = null;
    let longPressTriggered = false;
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    let isScrolling = false;
    let touchCount = 0;

    const startPress = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        touchStartTime = Date.now();
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        longPressTriggered = false;
        isScrolling = false;

        pressTimer = setTimeout(() => {
            if (isScrolling) return;
            longPressTriggered = true;
            div.classList.add('card-long-press');
            setTimeout(() => div.classList.remove('card-long-press'), 300);
            haptic.longPress();

            const isFav = !!note.favourite;
            showCardContextMenu({
                title: note.title,
                isFav: isFav,
                triggerEl: div,
                onFav: async () => {
                    const notes = allNotes[folderPath];
                    if (!notes) return;
                    const n = notes.find(x => x.id === note.id);
                    if (n) {
                        n.favourite = !n.favourite;
                        note.favourite = n.favourite;
                    }
                    const ind = div.querySelector('.card-fav-indicator');
                    if (ind) ind.classList.toggle('card-fav-hidden', !note.favourite);
                    haptic.toggle();
                    await saveAllNotesToDB();
                    updateStats();
                    render();
                    showToast(note.favourite ? '⭐ Added to favourites' : 'Removed from favourites');
                },
                onRename: () => showPromptModal('Rename note:', note.title, (newTitle) => {
                    if (newTitle?.trim()) renameNote(folderPath, note.id, newTitle.trim());
                }),
                onDelete: () => showConfirmModal(`Delete note "<b>${escapeHtml(note.title)}</b>"?`, (confirmed) => {
                    if (confirmed) deleteNoteFromFolder(folderPath, note.id);
                }),
            });
        }, 500);
    };

    const cancelPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    const checkMove = (e) => {
        const touch = e.touches ? e.touches[0] : e;
        const dx = Math.abs(touch.clientX - touchStartPos.x);
        const dy = Math.abs(touch.clientY - touchStartPos.y);
        if (dx > 10 || dy > 10) {
            isScrolling = true;
            cancelPress();
        }
    };

    div.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchCount = e.touches.length;
            startPress(e);
        }
    }, { passive: true });

    div.addEventListener('touchmove', checkMove, { passive: true });

    let tappedByTouch = false;

    div.addEventListener('touchend', (e) => {
        cancelPress();
        if (!longPressTriggered && !isScrolling && Date.now() - touchStartTime < 300) {
            tappedByTouch = true;
            openNote({ ...note, folder: folderPath });
        }
        longPressTriggered = false;
    }, { passive: true });

    div.addEventListener('touchcancel', cancelPress, { passive: true });

    div.addEventListener('mousedown', startPress);
    div.addEventListener('mouseup', cancelPress);
    div.addEventListener('mouseleave', cancelPress);

    div.addEventListener('click', () => {
        if (tappedByTouch) { tappedByTouch = false; return; }
        if (touchCount > 1) { touchCount = 0; return; }
        touchCount = 0;
        if (longPressTriggered) { longPressTriggered = false; return; }
        openNote({ ...note, folder: folderPath });
    });

    return div;
}

function createCard(title, onClick, isFolder = false) {
    const div = document.createElement('div');
    div.className = isFolder ? 'card glow-folder' : 'card';
    div.innerHTML = `<div class="card-icon"><i class="fas ${isFolder ? 'fa-folder' : 'fa-folder-open'}"></i></div><div class="card-filename">${escapeHtml(title)}</div><div class="card-buttons"></div>`;
    div.onclick = onClick;
    return div;
}

// ============================================================
// FOLDER OPERATIONS
// ============================================================

function renameCurrentFolder() {
    if (!currentPath.length) return;
    const old = currentPath[currentPath.length - 1];
    showPromptModal('Rename folder:', old, (newName) => {
        if (newName && newName !== old && newName.trim()) {
            const parent = currentPath.slice(0, -1).reduce((o, p) => o[p], fileSystem);

            const rebuilt = {};
            for (const key of Object.keys(parent)) {
                if (key === old) rebuilt[newName] = parent[old];
                else rebuilt[key] = parent[key];
            }

            for (const key of Object.keys(parent)) delete parent[key];
            for (const key of Object.keys(rebuilt)) parent[key] = rebuilt[key];

            const oldPath = currentPath.join('/');
            const newPath = [...currentPath.slice(0, -1), newName].join('/');
            if (allFiles[oldPath]) { allFiles[newPath] = allFiles[oldPath];
                delete allFiles[oldPath]; }
            if (allNotes[oldPath]) { allNotes[newPath] = allNotes[oldPath];
                delete allNotes[oldPath]; }

            currentPath[currentPath.length - 1] = newName;
            saveFolderStructure();
            saveAllFilesToDB();
            saveAllNotesToDB();
            render();
        }
    });
}

function deleteCurrentFolder() {
    if (!currentPath.length) return;
    const name = currentPath[currentPath.length - 1];
    showConfirmModal(`Delete "<b>${escapeHtml(name)}</b>" and all its contents? This cannot be undone.`, (confirmed) => {
        if (confirmed) {
            const path = currentPath.join('/');
            const prefix = path + '/';
            for (const k of Object.keys(allFiles)) {
                if (k === path || k.startsWith(prefix)) delete allFiles[k];
            }
            for (const k of Object.keys(allNotes)) {
                if (k === path || k.startsWith(prefix)) delete allNotes[k];
            }
            const parent = currentPath.slice(0, -1).reduce((o, p) => o[p], fileSystem);
            delete parent[name];
            currentPath.pop();
            saveFolderStructure();
            saveAllFilesToDB();
            saveAllNotesToDB();
            render();
        }
    });
}

function addNewFolder() {
    showPromptModal('New folder name:', '', (name) => {
        if (name && name.trim()) {
            const cur = getCurrentFolderObject();
            if (cur && !cur[name]) { cur[name] = {};
                saveFolderStructure();
                render(); } else showToast('Already exists', true);
        }
    });
}

function addNewDepartment() {
    showPromptModal('New department name:', '', (name) => {
        if (name && name.trim()) {
            const trimmed = name.trim();
            if (!fileSystem[trimmed]) {
                fileSystem[trimmed] = {};
                if (!deptColors[trimmed]) {
                    deptColors[trimmed] = getRandomGradient();
                    saveDeptColors();
                }
                saveFolderStructure();
                render();
            } else {
                showToast('Department already exists', true);
            }
        } else if (name !== null && name.trim() === '') {
            showToast('Department name cannot be empty', true);
        }
    });
}

// ============================================================
// LOADING SKELETON
// ============================================================

function showLoadingSkeleton() {
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;
    let html = '<div class="skeleton-grid">';
    for (let i = 0; i < 6; i++) {
        html += `<div class="skeleton-card">
            <div class="skeleton-icon shimmer"></div>
            <div class="skeleton-lines">
                <div class="skeleton-line skeleton-line-long shimmer"></div>
                <div class="skeleton-line skeleton-line-short shimmer"></div>
            </div>
        </div>`;
    }
    html += '</div>';
    contentDiv.innerHTML = html;
}

// ============================================================
// SEARCH
// ============================================================

let searchTimeout = null;

function clearSearch() {
    document.getElementById('searchInput').value = '';
    isSearchMode = false;
    document.getElementById('searchInfo').classList.add('hidden');
    document.getElementById('clearSearchBtn').classList.add('hidden');
    render();
}

// ============================================================
// RENDER
// ============================================================

function render() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();

    if (query) {
        isSearchMode = true;
        document.getElementById('clearSearchBtn').classList.remove('hidden');
        const results = [];

        for (const path in allFiles) {
            if (allFiles[path]) {
                allFiles[path].forEach(f => {
                    if (f.name.toLowerCase().includes(query)) {
                        results.push({ ...f, folder: path, type: 'file' });
                    }
                });
            }
        }

        for (const path in allNotes) {
            if (allNotes[path]) {
                allNotes[path].forEach(n => {
                    if (n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)) {
                        results.push({ ...n, folder: path, type: 'note' });
                    }
                });
            }
        }

        document.getElementById('searchInfo').classList.remove('hidden');
        document.getElementById('searchInfo').innerHTML = `<i class="fas fa-search"></i> Found ${results.length} result(s) for "${escapeHtml(query)}" <button onclick="clearSearch()">Clear</button>`;

        const contentDiv = document.getElementById('content');
        contentDiv.innerHTML = '';
        document.getElementById('homeBtn').classList.remove('hidden');
        document.getElementById('uploadBtn').classList.add('hidden');
        document.getElementById('newNoteBtn').classList.add('hidden');
        document.getElementById('departmentsSection').innerHTML = '';
        document.getElementById('breadcrumb').innerHTML = '';
        document.querySelector('.type-selector').style.display = 'none';

        if (!results.length) {
            contentDiv.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results found.</p></div>';
        } else {
            results.forEach(item => {
                if (item.type === 'file') {
                    contentDiv.appendChild(createFileCard(item, item.folder));
                } else {
                    contentDiv.appendChild(createNoteCard(item, item.folder));
                }
            });
        }
        updateStats();
        attachPressEffects();
        return;
    }

    isSearchMode = false;
    document.getElementById('clearSearchBtn').classList.add('hidden');
    document.getElementById('searchInfo').classList.add('hidden');

    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '';

    const folder = getCurrentFolderObject();
    if (!folder) { currentPath = [];
        render(); return; }

    document.getElementById('homeBtn').classList.toggle('hidden', currentPath.length === 0);
    const isRoot = currentPath.length === 0;

    if (isRoot) {
        const deptIcons = {
            'REMELT': 'fa-fire-flame-curved',
            'CASTER': 'fa-industry',
            'HRM': 'fa-users',
            'CRM': 'fa-microchip',
            'ANNEALING': 'fa-temperature-high',
            'TLL': 'fa-gears',
            'SLITTER': 'fa-scissors',
            'UTILITY': 'fa-bolt',
        };
        const deptKeys = Object.keys(fileSystem);
        const hasDepts = deptKeys.length > 0;
        let html = '';

        if (hasDepts) {
            html = '<div class="departments-wrapper"><div class="departments-grid">';
            for (let dept in fileSystem) {
                const total = countDepartmentFiles(fileSystem[dept], [dept]);
                const icon = deptIcons[dept] || 'fa-folder';
                const knownDepts = ['REMELT', 'CASTER', 'HRM', 'CRM', 'ANNEALING', 'TLL', 'SLITTER', 'UTILITY'];
                const pillBgStyle = (!knownDepts.includes(dept) && deptColors[dept]) ? ` style="background:${deptColors[dept]}"` : '';

                html += `<div class="dept-card" data-dept="${escapeHtml(dept)}">
                    <div class="dept-oval">
                        <div class="dept-pill-bg"${pillBgStyle}></div>
                        <div class="dept-pill-center-icon"><i class="fas ${icon}"></i></div>
                        <div class="dept-pill-body">
                            <div class="dept-pill-name">${escapeHtml(dept)}</div>
                        </div>
                    </div>
                    <div class="dept-pill-icon">
                        <span class="dept-count">${total}</span>
                        <span class="dept-count-label">Items</span>
                    </div>
                </div>`;
            }
            html += `
                </div>
                <div class="dept-hub">
                    <div class="dept-hub-circle">
                        <span class="dept-hub-text">DEPARTMENT</span>
                        <div class="dept-hub-knob" onclick="showInfo()" ontouchstart="">
                            <i class="fas fa-info dept-hub-icon"></i>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        html += `<div class="dept-add-footer">
            <button class="dept-add-btn" onclick="addNewDepartment()">
                <span class="dept-add-btn-icon"><i class="fas fa-plus"></i></span>
                <span class="dept-add-btn-label">Add Department</span>
            </button>
        </div>`;

        document.getElementById('departmentsSection').innerHTML = html;
        document.getElementById('homeBtn').classList.add('hidden');
        document.getElementById('uploadBtn').classList.add('hidden');
        document.getElementById('newNoteBtn').classList.add('hidden');

        if (hasDepts) {
            attachDepartmentPressEffects();
            drawDeptConnectorsWhenStable();
        }
    } else {
        document.getElementById('departmentsSection').innerHTML = '';
    }

    const hasSubfolders = Object.keys(folder).length > 0;
    const isLeafFolder = !isRoot && !hasSubfolders;

    const typeSelector = document.querySelector('.type-selector');
    if (typeSelector) typeSelector.style.display = isLeafFolder ? 'flex' : 'none';

    if (isLeafFolder) {
        if (currentActiveTab === 'pdfs') {
            document.getElementById('uploadBtn').classList.remove('hidden');
            document.getElementById('newNoteBtn').classList.add('hidden');
        } else {
            document.getElementById('uploadBtn').classList.add('hidden');
            document.getElementById('newNoteBtn').classList.remove('hidden');
        }
    } else {
        document.getElementById('uploadBtn').classList.add('hidden');
        document.getElementById('newNoteBtn').classList.add('hidden');
    }

    if (!isRoot) {
        const folderCardEl = document.createElement('div');
        folderCardEl.className = 'current-folder-card';

        const parentPath = currentPath.slice(0, -1);
        const pathHtml = `<span class="cf-home" onclick="navigateToBreadcrumb(-1)"><i class="fas fa-home"></i> <span style="color:#3b82f6">Home</span></span>` +
            parentPath.map((p, i) => `<span class="cf-sep"> / </span><span class="cf-part cf-part-nav" onclick="navigateToBreadcrumb(${i})">${escapeHtml(p)}</span>`).join('') +
            `<span class="cf-sep"> / </span><span class="cf-part cf-part-current">${escapeHtml(currentPath[currentPath.length - 1])}</span>`;

        folderCardEl.innerHTML = `
            <div class="cf-path-row">${pathHtml}</div>
            <div class="cf-bottom-row">
                <div class="cf-folder-name">${escapeHtml(currentPath[currentPath.length - 1])}</div>
                <div class="cf-folder-icon"><i class="fas fa-folder"></i><i class="fas fa-star cf-star"></i></div>
            </div>`;
        contentDiv.appendChild(folderCardEl);
    }

    if (!isRoot) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'action-bar';
        actionDiv.innerHTML = `
            <div class="action-dots action-dots-left"><span></span><span></span><span></span><span></span><span></span><span></span></div>
            <div class="action-btns-wrap">
                <div class="action-btns-row">
                    <button class="action-btn action-btn-rename" onclick="renameCurrentFolder()"><i class="fas fa-edit"></i> Rename Folder</button>
                    <button class="action-btn action-btn-delete" onclick="deleteCurrentFolder()"><i class="fas fa-trash-alt"></i> Delete Folder</button>
                </div>
                <div class="action-btns-row">
                    <button class="action-btn action-btn-back" onclick="goBack()"><i class="fas fa-arrow-left"></i> Back</button>
                    <button class="action-btn action-btn-add" onclick="addNewFolder()"><i class="fas fa-plus"></i> Add Subfolder</button>
                </div>
            </div>
            <div class="action-dots action-dots-right"><span></span><span></span><span></span><span></span><span></span><span></span></div>`;

        const folderCardInDom = contentDiv.querySelector('.current-folder-card');
        if (folderCardInDom) {
            contentDiv.insertBefore(actionDiv, folderCardInDom);
        } else {
            contentDiv.appendChild(actionDiv);
        }
    }

    if (!isRoot && hasSubfolders) {
        for (let key in folder) {
            const folderCard = createCard(key, () => {
                navigateWithPageTurn(() => {
                    currentPath.push(key);
                    render();
                }, 'forward');
            }, true);
            contentDiv.appendChild(folderCard);
        }
    }

    if (isLeafFolder) {
        if (currentActiveTab === 'pdfs') {
            const files = getFilesForCurrentFolder();
            const path = currentPath.join('/');
            if (files.length) {
                files.forEach(f => contentDiv.appendChild(createFileCard(f, path)));
            } else {
                const dz = document.createElement('div');
                dz.className = 'empty-state';
                dz.innerHTML = `<i class="fas fa-cloud-upload-alt"></i><p>No files here yet</p>`;
                contentDiv.appendChild(dz);
            }
        } else {
            const notes = getNotesForCurrentFolder();
            const path = currentPath.join('/');
            if (notes.length) {
                notes.forEach(n => contentDiv.appendChild(createNoteCard(n, path)));
            } else {
                contentDiv.innerHTML += '<div class="empty-state empty-state-note"><i class="fas fa-sticky-note"></i><p>No notes yet. Click + New Note to add.</p></div>';
            }
        }
    }

    updateStats();
    attachPressEffects();
}

// ============================================================
// DEPARTMENT CONNECTORS
// ============================================================

function drawDeptConnectorsWhenStable(attempt) {
    attempt = attempt || 0;
    const wrapper = document.querySelector('.departments-wrapper');
    if (!wrapper) return;
    const badges = wrapper.querySelectorAll('.dept-pill-icon');
    if (!badges.length) return;

    const sample = () => Array.from(badges).map(b => {
        const r = b.getBoundingClientRect();
        return r.top + ',' + r.left + ',' + r.width;
    }).join('|');

    const pos1 = sample();

    requestAnimationFrame(() => {
        const pos2 = sample();
        if (pos1 === pos2 && pos2.indexOf('0,0,0') === -1) {
            drawDeptConnectors();
        } else if (attempt < 20) {
            setTimeout(() => drawDeptConnectorsWhenStable(attempt + 1), 50);
        } else {
            drawDeptConnectors();
        }
    });
}

function drawDeptConnectors() {
    const wrapper = document.querySelector('.departments-wrapper');
    if (!wrapper) return;

    const old = wrapper.querySelector('.dept-connector-svg');
    if (old) old.remove();

    const hubCircle = wrapper.querySelector('.dept-hub-circle');
    const badges = wrapper.querySelectorAll('.dept-pill-icon');
    if (!hubCircle || !badges.length) return;

    const wW = wrapper.offsetWidth;
    const wH = wrapper.offsetHeight;
    if (!wW) { setTimeout(drawDeptConnectors, 100); return; }

    function offsetRelTo(el, ancestor) {
        let top = 0,
            left = 0;
        while (el && el !== ancestor) {
            top += el.offsetTop;
            left += el.offsetLeft;
            el = el.offsetParent;
        }
        return { top, left };
    }

    const badgeData = Array.from(badges).map(b => {
        const off = offsetRelTo(b, wrapper);
        return {
            top: off.top,
            left: off.left,
            width: b.offsetWidth,
            height: b.offsetHeight
        };
    });
    if (!badgeData.every(r => r.width > 0)) { setTimeout(drawDeptConnectors, 100); return; }

    const centerYwrapper = (
        Math.min(...badgeData.map(r => r.top + r.height / 2)) +
        Math.max(...badgeData.map(r => r.top + r.height / 2))
    ) / 2;
    const hubTopLocal = centerYwrapper - hubCircle.offsetHeight / 2;

    hubCircle.style.position = 'absolute';
    hubCircle.style.top = hubTopLocal + 'px';
    hubCircle.style.right = '8px';
    hubCircle.style.left = 'auto';
    hubCircle.style.transform = 'none';

    void hubCircle.offsetHeight;

    if (!hubCircle.offsetWidth) { setTimeout(drawDeptConnectors, 100); return; }

    const hubOffNow = offsetRelTo(hubCircle, wrapper);
    const hubLeftX = hubOffNow.left;
    const hubTopY = hubOffNow.top;
    const hubCenterY = hubTopY + hubCircle.offsetHeight / 2;
    const svgTotalW2 = Math.max(wW, hubOffNow.left + hubCircle.offsetWidth + 10);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('dept-connector-svg');
    svg.setAttribute('width', svgTotalW2);
    svg.setAttribute('height', wH);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    const n = badgeData.length;
    const cr = 25;

    const sorted = badgeData.map((r, idx) => ({
        x1: r.left + r.width,
        y1: r.top + r.height / 2,
        origIdx: idx
    })).sort((a, b) => a.y1 - b.y1);

    const hubUseRatio = 0.88;
    const hubUseH = hubCircle.offsetHeight * hubUseRatio;
    const hubStartY = hubCenterY - hubUseH / 2;
    const hubStep = n > 1 ? hubUseH / (n - 1) : 0;

    sorted.forEach((d, si) => {
        const y2 = n === 1 ? hubCenterY : hubStartY + hubStep * si;
        const dy = y2 - d.y1;
        const safeCr = Math.min(cr, Math.abs(dy) / 2);
        let pathD;
        const segments = [];

        const hubRadius = hubCircle.offsetWidth / 2 + 8;
        const hubCenterX = hubLeftX + hubCircle.offsetWidth / 2;
        const dyFromCenter = y2 - hubCenterY;
        const safeDy = Math.max(-hubRadius + 2, Math.min(hubRadius - 2, dyFromCenter));
        const dotX = hubCenterX - Math.sqrt(hubRadius * hubRadius - safeDy * safeDy);
        const lineEndX = dotX;

        segments.push(`M ${d.x1} ${d.y1}`);
        const exitX = d.x1 + 6;
        segments.push(`L ${exitX} ${d.y1}`);
        const channelX = lineEndX - 35;

        if (dy > 8) {
            segments.push(`L ${channelX - safeCr} ${d.y1}`);
            segments.push(`A ${safeCr} ${safeCr} 0 0 1 ${channelX} ${d.y1 + safeCr}`);
            segments.push(`L ${channelX} ${y2 - safeCr}`);
            segments.push(`A ${safeCr} ${safeCr} 0 0 0 ${channelX + safeCr} ${y2}`);
        } else if (dy < -8) {
            segments.push(`L ${channelX - safeCr} ${d.y1}`);
            segments.push(`A ${safeCr} ${safeCr} 0 0 0 ${channelX} ${d.y1 - safeCr}`);
            segments.push(`L ${channelX} ${y2 + safeCr}`);
            segments.push(`A ${safeCr} ${safeCr} 0 0 1 ${channelX + safeCr} ${y2}`);
        } else {
            segments.push(`L ${channelX} ${d.y1}`);
            segments.push(`L ${channelX} ${y2}`);
        }
        segments.push(`L ${lineEndX} ${y2}`);

        pathD = segments.join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathD);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(255,255,255,0.85)');
        path.setAttribute('stroke-width', '1.8');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);

        const hDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hDot.setAttribute('cx', dotX);
        hDot.setAttribute('cy', y2);
        hDot.setAttribute('r', '4');
        hDot.setAttribute('fill', 'rgba(255,255,255,0.95)');
        hDot.setAttribute('stroke', 'rgba(245,168,0,0.55)');
        hDot.setAttribute('stroke-width', '1.5');
        svg.appendChild(hDot);

        const bDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bDot.setAttribute('cx', d.x1);
        bDot.setAttribute('cy', d.y1);
        bDot.setAttribute('r', '3');
        bDot.setAttribute('fill', 'rgba(255,255,255,0.75)');
        svg.appendChild(bDot);
    });

    wrapper.appendChild(svg);
}

function attachDepartmentPressEffects() {
    document.querySelectorAll('.dept-oval').forEach(oval => {
        oval.addEventListener('touchstart', () => {}, { passive: false });
        const card = oval.closest('.dept-card');
        if (card) oval.onclick = () => selectDepartment(card.dataset.dept);
    });
}

// ============================================================
// STATS
// ============================================================

function updateStats() {
    let folderCount = 0,
        fileCount = 0,
        notesCount = 0,
        favCount = 0;

    function countFolders(obj) {
        for (let k in obj) if (typeof obj[k] === 'object') { folderCount++;
            countFolders(obj[k]); }
    }
    countFolders(fileSystem);

    for (let k in allFiles) {
        if (allFiles[k]) {
            fileCount += allFiles[k].length;
            favCount += allFiles[k].filter(f => f.favourite).length;
        }
    }
    for (let k in allNotes) {
        if (allNotes[k]) {
            notesCount += allNotes[k].length;
            favCount += allNotes[k].filter(n => n.favourite).length;
        }
    }

    document.getElementById('folderCount').textContent = folderCount;
    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('notesCount').textContent = notesCount;
    document.getElementById('favCount').textContent = favCount;

    const favItem = document.getElementById('favStatItem');
    if (favItem && !favItem._wired) {
        favItem._wired = true;
        favItem.addEventListener('click', openFavouritesView);
    }
}

// ============================================================
// FAVOURITES VIEW
// ============================================================

function openFavouritesView() {
    const favFiles = [],
        favNotes = [];

    for (const folderPath in allFiles) {
        if (!allFiles[folderPath]) continue;
        for (const f of allFiles[folderPath]) {
            if (f.favourite) favFiles.push({ file: f, folderPath });
        }
    }
    for (const folderPath in allNotes) {
        if (!allNotes[folderPath]) continue;
        for (const n of allNotes[folderPath]) {
            if (n.favourite) favNotes.push({ note: n, folderPath });
        }
    }

    const list = document.getElementById('favViewList');

    if (!favFiles.length && !favNotes.length) {
        list.innerHTML = '<div class="fav-empty"><i class="fas fa-heart-crack"></i><p>No favourites yet.<br>Tap ⭐ on any file or note to add it here.</p></div>';
    } else {
        list.innerHTML = '';

        if (favFiles.length) {
            const sec = document.createElement('div');
            sec.className = 'fav-section-title';
            sec.innerHTML = `<i class="fas fa-file"></i> Files <span>${favFiles.length}</span>`;
            list.appendChild(sec);

            favFiles.forEach(({ file, folderPath }) => {
                const iconClass = getFileIcon(file.name);
                const row = document.createElement('div');
                row.className = 'fav-row';
                row.innerHTML = `
                    <div class="fav-row-icon"><i class="fas ${iconClass}"></i></div>
                    <div class="fav-row-info">
                        <div class="fav-row-name">${escapeHtml(file.name)}</div>
                        <div class="fav-row-path">${escapeHtml(folderPath)}</div>
                    </div>
                    <button class="fav-row-unfav" title="Remove favourite"><i class="fas fa-heart"></i></button>
                `;
                row.querySelector('.fav-row-unfav').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const arr = allFiles[folderPath];
                    if (arr) { const f2 = arr.find(x => x.name === file.name); if (f2) f2.favourite = false; }
                    await saveAllFilesToDB();
                    updateStats();
                    render();
                    row.classList.add('fav-row-removing');
                    setTimeout(() => { row.remove();
                        checkFavEmpty(list); }, 280);
                });
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.fav-row-unfav')) return;
                    closeFavouritesView();
                    openFile(file.name, folderPath);
                });
                list.appendChild(row);
            });
        }

        if (favNotes.length) {
            const sec = document.createElement('div');
            sec.className = 'fav-section-title';
            sec.innerHTML = `<i class="fas fa-sticky-note"></i> Notes <span>${favNotes.length}</span>`;
            list.appendChild(sec);

            favNotes.forEach(({ note, folderPath }) => {
                const row = document.createElement('div');
                row.className = 'fav-row';
                row.innerHTML = `
                    <div class="fav-row-icon fav-row-icon-note"><i class="fas fa-sticky-note"></i></div>
                    <div class="fav-row-info">
                        <div class="fav-row-name">${escapeHtml(note.title)}</div>
                        <div class="fav-row-path">${escapeHtml(folderPath)}</div>
                    </div>
                    <button class="fav-row-unfav" title="Remove favourite"><i class="fas fa-heart"></i></button>
                `;
                row.querySelector('.fav-row-unfav').addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const arr = allNotes[folderPath];
                    if (arr) { const n2 = arr.find(x => x.id === note.id); if (n2) n2.favourite = false; }
                    await saveAllNotesToDB();
                    updateStats();
                    render();
                    row.classList.add('fav-row-removing');
                    setTimeout(() => { row.remove();
                        checkFavEmpty(list); }, 280);
                });
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.fav-row-unfav')) return;
                    closeFavouritesView();
                    openNote({ ...note, folder: folderPath });
                });
                list.appendChild(row);
            });
        }
    }

    document.getElementById('departmentsSection').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    document.getElementById('breadcrumb').style.display = 'none';
    document.getElementById('searchInfo').classList.add('hidden');

    const favView = document.getElementById('favouritesView');
    favView.classList.remove('hidden');
    requestAnimationFrame(() => favView.classList.add('fav-view-visible'));

    document.getElementById('favViewBackBtn').onclick = closeFavouritesView;
}

function checkFavEmpty(list) {
    const rows = list.querySelectorAll('.fav-row');
    if (!rows.length) {
        list.innerHTML = '<div class="fav-empty"><i class="fas fa-heart-crack"></i><p>No favourites yet.<br>Tap ⭐ on any file or note to add it here.</p></div>';
        document.getElementById('favCount').textContent = '0';
    }
}

function closeFavouritesView() {
    const favView = document.getElementById('favouritesView');
    favView.classList.remove('fav-view-visible');
    setTimeout(() => favView.classList.add('hidden'), 260);
    document.getElementById('departmentsSection').style.display = '';
    document.getElementById('content').style.display = '';
    document.getElementById('breadcrumb').style.display = '';
}

// ============================================================
// TAB SWITCHING
// ============================================================

function setActiveTab(tab) {
    currentActiveTab = tab;
    const pdfBtn = document.getElementById('pdfTabBtn');
    const notesBtn = document.getElementById('notesTabBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const newNoteBtn = document.getElementById('newNoteBtn');

    if (tab === 'pdfs') {
        pdfBtn.classList.add('active');
        notesBtn.classList.remove('active');
        uploadBtn.classList.remove('hidden');
        newNoteBtn.classList.add('hidden');
    } else {
        pdfBtn.classList.remove('active');
        notesBtn.classList.add('active');
        uploadBtn.classList.add('hidden');
        newNoteBtn.classList.remove('hidden');
    }
    render();
}

// ============================================================
// THEME
// ============================================================

function toggleTheme() {
    const isLight = document.body.classList.contains('light-mode');
    const newTheme = isLight ? 'dark' : 'light';
    docmanSettings.theme = newTheme;
    saveSettings();
    applyTheme(newTheme);
}

function updateThemeIcon() {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;

    const isDark = !document.body.classList.contains('light-mode');
    const iconWrapper = themeBtn.querySelector('.theme-icon-wrapper');
    if (iconWrapper) {
        iconWrapper.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i>`;
    }
    themeBtn.dataset.theme = isDark ? 'dark' : 'light';
}

function applyTheme(theme) {
    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.classList.toggle('light-mode', !prefersDark);
    } else {
        document.body.classList.toggle('light-mode', theme === 'light');
    }
    localStorage.setItem('docman_theme', theme);
    updateThemeIcon();
    applyThemePickUI();
}

function applyThemePickUI() {
    const theme = docmanSettings.theme || 'dark';
    document.getElementById('themePickDark')?.classList.toggle('active', theme === 'dark');
    document.getElementById('themePickLight')?.classList.toggle('active', theme === 'light');
    document.getElementById('themePickSystem')?.classList.toggle('active', theme === 'system');
}

function applyAnimations() {
    document.body.classList.toggle('reduce-motion', !docmanSettings.enableAnimations);
}

function applyParticles() {
    const pc = document.querySelector('.particles-container');
    const g1 = document.querySelector('.ambient-glow.glow-1');
    const g2 = document.querySelector('.ambient-glow.glow-2');
    const show = docmanSettings.enableParticles;
    if (pc) pc.style.display = show ? '' : 'none';
    if (g1) g1.style.display = show ? '' : 'none';
    if (g2) g2.style.display = show ? '' : 'none';
}

function applyRadioUI(radioName) {
    const val = docmanSettings[radioName] || 'external';
    document.querySelectorAll(`[data-radio="${radioName}"]`).forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-val') === val);
    });
}

// ============================================================
// PIN VERIFICATION
// ============================================================

function showPinVerifyModal(title, callback) {
    const existing = document.getElementById('pinVerifyModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pinVerifyModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);padding:20px;';
    overlay.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid rgba(239,68,68,0.4);border-radius:24px;padding:28px 24px;width:100%;max-width:320px;box-shadow:0 24px 60px rgba(0,0,0,0.7);text-align:center;">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#ef4444,#dc2626);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.4rem;">🔒</div>
            <p style="color:#e2e8f0;font-size:0.95rem;font-weight:700;margin:0 0 6px;font-family:Inter,sans-serif;">${title}</p>
            <p style="color:#94a3b8;font-size:0.78rem;margin:0 0 20px;font-family:Inter,sans-serif;">Enter your 4-digit PIN to confirm</p>
            <div id="pinVerifyDots" style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;">
                ${[0,1,2,3].map(i => `<div id="pvDot${i}" style="width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.15);border:2px solid rgba(255,255,255,0.25);transition:all 0.15s;"></div>`).join('')}
            </div>
            <div id="pinVerifyGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
                ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
                    <button class="pvKey" data-key="${k}" style="padding:16px 0;border-radius:14px;border:1px solid rgba(255,255,255,${k===''?'0':'0.1'});background:${k===''?'transparent':'rgba(255,255,255,0.06)'};color:#e2e8f0;font-size:1.15rem;font-weight:600;font-family:Inter,sans-serif;cursor:${k===''?'default':'pointer'};pointer-events:${k===''?'none':'auto'};transition:background 0.1s;">${k}</button>
                `).join('')}
            </div>
            <button id="pvCancel" style="width:100%;padding:12px;border-radius:40px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;cursor:pointer;font-family:Inter,sans-serif;font-size:0.85rem;">Cancel</button>
        </div>`;
    document.body.appendChild(overlay);

    let entered = '';
    const storedPin = localStorage.getItem(PIN_KEY) || '';

    function updateDots() {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`pvDot${i}`);
            dot.style.background = i < entered.length ? '#ef4444' : 'rgba(255,255,255,0.15)';
            dot.style.borderColor = i < entered.length ? '#ef4444' : 'rgba(255,255,255,0.25)';
        }
    }

    function shakeModal() {
        const box = overlay.querySelector('div');
        box.style.animation = 'none';
        box.style.transition = 'transform 0.05s';
        let count = 0;
        const interval = setInterval(() => {
            box.style.transform = count % 2 === 0 ? 'translateX(8px)' : 'translateX(-8px)';
            count++;
            if (count > 5) { clearInterval(interval);
                box.style.transform = ''; }
        }, 50);
    }

    overlay.querySelectorAll('.pvKey').forEach(btn => {
        btn.addEventListener('pointerdown', () => { btn.style.background = 'rgba(255,255,255,0.14)'; });
        btn.addEventListener('pointerup', () => { btn.style.background = 'rgba(255,255,255,0.06)'; });
        btn.addEventListener('click', async () => {
            const k = btn.dataset.key;
            if (k === '⌫') {
                entered = entered.slice(0, -1);
                updateDots();
            } else if (entered.length < 4 && k !== '') {
                entered += k;
                updateDots();
                if (entered.length === 4) {
                    const enteredHash = await hashPin(entered);
                    if (enteredHash === storedPin) {
                        overlay.remove();
                        callback(true);
                    } else {
                        showToast('Incorrect PIN', true);
                        entered = '';
                        updateDots();
                        shakeModal();
                    }
                }
            }
        });
    });

    document.getElementById('pvCancel').onclick = () => { overlay.remove();
        callback(false); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove();
            callback(false); } });
}

function promptSetPin(callback) {
    showPromptModal('Set a 4-digit PIN:', '', async (val) => {
        if (val === null) { callback(false); return; }
        const pin = val.trim();
        if (!/^\d{4}$/.test(pin)) { showToast('PIN must be exactly 4 digits', true);
            callback(false); return; }
        localStorage.setItem(PIN_KEY, await hashPin(pin));
        showToast('PIN saved');
        callback(true);
    });
}

function updatePinStatusUI() {
    const hasPin = !!localStorage.getItem(PIN_KEY);
    const sub = document.getElementById('pinStatusSub');
    const changeCard = document.getElementById('changePinCard');
    const lockToggle = document.getElementById('appLockToggle');
    if (sub) sub.textContent = hasPin ? 'PIN is set' : 'Not set';
    if (changeCard) changeCard.classList.toggle('hidden', !docmanSettings.appLock);
    if (lockToggle) lockToggle.checked = docmanSettings.appLock;
}

// ============================================================
// EXPORT / IMPORT
// ============================================================

async function exportBackupData() {
    showToast('Preparing backup…');
    try {
        const manifest = {
            fileSystem,
            allNotes,
            deptColors,
            exportedAt: new Date().toISOString(),
            version: APP_VERSION,
            format: 'docman-zip-v1'
        };

        manifest.fileMetadata = {};
        for (const path in allFiles) {
            if (allFiles[path]) {
                manifest.fileMetadata[path] = allFiles[path].map(f => ({
                    name: f.name,
                    type: f.type,
                    uploadedAt: f.uploadedAt,
                    favourite: f.favourite || false,
                    size: f.size || 0
                }));
            }
        }

        const zip = new JSZip();
        zip.file('manifest.json', JSON.stringify(manifest));
        const filesFolder = zip.folder('files');

        // Pull every file's actual content (lazy-loading blobs as needed) into the zip.
        // Zip entry path mirrors folderPath/fileName so import can match it back to its folder.
        for (const path in allFiles) {
            for (const f of (allFiles[path] || [])) {
                try {
                    const blob = await loadFileData(path, f.name);
                    if (blob) {
                        filesFolder.file(path + '/' + f.name, blob);
                    } else {
                        console.warn('No data found for', path, f.name, '— skipping content, metadata only');
                    }
                } catch (e) {
                    console.warn('Failed to read file for backup:', path, f.name, e);
                }
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const backupFileName = `docman-backup-${Date.now()}.zip`;
        await nativeDownload(zipBlob, backupFileName);
        showToast('Backup exported');
    } catch (err) {
        console.error('Backup export failed:', err);
        showToast('Could not export backup', true);
    }
}

function importBackupData(file) {
    (async () => {
        try {
            const zip = await JSZip.loadAsync(file);
            const manifestEntry = zip.file('manifest.json');
            if (!manifestEntry) { showToast('Invalid backup file', true); return; }

            const manifest = JSON.parse(await manifestEntry.async('string'));
            if (!manifest.fileSystem) { showToast('Invalid backup file', true); return; }

            showConfirmModal('This will <b>replace all current data</b> with the backup. Continue?', async (ok) => {
                if (!ok) return;

                showToast('Restoring backup…');

                fileSystem = manifest.fileSystem || {};
                allNotes = manifest.allNotes || {};
                deptColors = manifest.deptColors || {};
                allFiles = {};

                if (manifest.fileMetadata) {
                    for (const path in manifest.fileMetadata) {
                        if (!manifest.fileMetadata[path]) continue;
                        allFiles[path] = [];
                        for (const f of manifest.fileMetadata[path]) {
                            const zipEntry = zip.file('files/' + path + '/' + f.name);
                            let fileData = null;
                            if (zipEntry) {
                                try {
                                    fileData = await zipEntry.async('blob');
                                } catch (e) {
                                    console.warn('Failed to read file from backup:', path, f.name, e);
                                }
                            }
                            allFiles[path].push({
                                name: f.name,
                                type: f.type || 'application/octet-stream',
                                uploadedAt: f.uploadedAt || Date.now(),
                                favourite: f.favourite || false,
                                size: f.size || (fileData ? fileData.size : 0),
                                fileData: fileData,
                                _hasData: !!fileData,
                                _isBase64: false
                            });
                        }
                    }
                }

                await saveFolderStructure();
                await saveDeptColors();
                await saveAllNotesToDB();
                await saveAllFilesToDB();
                await loadAllFileMetadata();

                currentPath = [];
                closeSettingsPage();
                render();
                showToast('Data imported successfully');
            });
        } catch (err) {
            console.error('Backup import failed:', err);
            showToast('Failed to read backup: ' + err.message, true);
        }
    })();
}

// ============================================================
// CLEAR ALL DATA
// ============================================================

async function doEraseAllData() {
    fileSystem = {};
    allFiles = {};
    allNotes = {};
    deptColors = {};
    await saveFolderStructure();
    await saveDeptColors();
    const tx = db.transaction(['files', 'notes', 'blobs'], 'readwrite');
    tx.objectStore('files').clear();
    tx.objectStore('notes').clear();
    tx.objectStore('blobs').clear();
    tx.commit();
    currentPath = [];
    closeSettingsPage();
    render();
    showToast('All data erased');
}

function clearAllAppData() {
    const hasPin = !!localStorage.getItem(PIN_KEY);
    if (hasPin) {
        showPinVerifyModal('Erase All Data', (verified) => {
            if (!verified) return;
            showConfirmModal('This will permanently delete <b>all files, notes and departments</b>. This cannot be undone. Continue?', async (confirmed) => {
                if (!confirmed) return;
                await doEraseAllData();
            });
        });
    } else {
        showPromptModal('\u26a0\ufe0f No PIN set. Create a 4-digit PIN to authorize erase:', '', async (val) => {
            if (val === null) return;
            const pin = val.trim();
            if (!/^\d{4}$/.test(pin)) { showToast('PIN must be exactly 4 digits', true); return; }
            localStorage.setItem(PIN_KEY, await hashPin(pin));
            showToast('PIN saved. Enter it again to confirm erase.');
            showPinVerifyModal('Confirm Erase All Data', (verified) => {
                if (!verified) return;
                showConfirmModal('This will permanently delete <b>all files, notes and departments</b>. This cannot be undone. Continue?', async (confirmed) => {
                    if (!confirmed) return;
                    await doEraseAllData();
                });
            });
        });
    }
}

// ============================================================
// SETTINGS PANEL RENDERERS
// ============================================================

function renderStoragePanel() {
    let docCount = 0,
        noteCount = 0;
    for (const p in allFiles) if (allFiles[p]) docCount += allFiles[p].length;
    for (const p in allNotes) if (allNotes[p]) noteCount += allNotes[p].length;

    document.getElementById('storageDocCount').textContent = docCount;
    document.getElementById('storageNoteCount').textContent = noteCount;

    try {
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(est => {
                const usedMB = (est.usage / (1024 * 1024)).toFixed(2);
                document.getElementById('storageSummaryUsed').textContent = usedMB + ' MB';
            }).catch(() => {
                document.getElementById('storageSummaryUsed').textContent = 'Unknown';
            });
        } else {
            document.getElementById('storageSummaryUsed').textContent = 'Unknown';
        }
    } catch (e) {
        document.getElementById('storageSummaryUsed').textContent = 'Unknown';
    }
}

async function renderStorageDetailPanel() {
    const body = document.getElementById('storageDetailBody');
    body.innerHTML = '<div class="storage-detail-loading"><i class="fas fa-spinner fa-spin"></i> Calculating…</div>';

    let pdfBytes = 0,
        imgBytes = 0,
        pdfCount = 0,
        imgCount = 0;
    const deptMap = {};

    for (const dept of Object.keys(fileSystem)) {
        deptMap[dept] = { bytes: 0, docs: 0, notes: 0 };
    }

    for (const folderPath in allFiles) {
        if (!allFiles[folderPath]) continue;
        const topDept = folderPath.split('/')[0];
        for (const f of allFiles[folderPath]) {
            const bytes = f.size || 0;
            if (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf')) {
                pdfBytes += bytes;
                pdfCount++;
            } else {
                imgBytes += bytes;
                imgCount++;
            }
            if (deptMap[topDept]) {
                deptMap[topDept].bytes += bytes;
                deptMap[topDept].docs++;
            }
        }
    }

    let noteBytes = 0;
    for (const folderPath in allNotes) {
        if (!allNotes[folderPath]) continue;
        const topDept = folderPath.split('/')[0];
        for (const n of allNotes[folderPath]) {
            const nb = new Blob([JSON.stringify(n)]).size;
            noteBytes += nb;
            if (deptMap[topDept]) {
                deptMap[topDept].bytes += nb;
                deptMap[topDept].notes++;
            }
        }
    }

    const totalBytes = pdfBytes + imgBytes + noteBytes;
    const fmt = (b) => b < 1024 * 1024 ? (b / 1024).toFixed(1) + ' KB' : (b / (1024 * 1024)).toFixed(2) + ' MB';
    const pct = (b) => totalBytes > 0 ? Math.round((b / totalBytes) * 100) : 0;

    const deptEntries = Object.entries(deptMap).sort((a, b) => b[1].bytes - a[1].bytes);

    const deptRows = deptEntries.map(([dept, info]) => {
        const p = pct(info.bytes);
        return `
            <div class="sd-dept-row">
                <div class="sd-dept-name">${dept}</div>
                <div class="sd-dept-bar-wrap"><div class="sd-dept-bar" style="width:${p}%"></div></div>
                <div class="sd-dept-meta">${fmt(info.bytes)} · ${info.docs} doc${info.docs !== 1 ? 's' : ''}${info.notes ? ` · ${info.notes} note${info.notes !== 1 ? 's' : ''}` : ''}</div>
            </div>`;
    }).join('');

    body.innerHTML = `
        <div class="settings-group-title">By File Type</div>
        <div class="settings-card sd-type-card">
            <div class="sd-type-row">
                <div class="sd-type-icon sd-icon-pdf"><i class="fas fa-file-pdf"></i></div>
                <div class="sd-type-info"><span class="sd-type-label">PDFs</span><span class="sd-type-count">${pdfCount} file${pdfCount !== 1 ? 's' : ''}</span></div>
                <div class="sd-type-size">${fmt(pdfBytes)}</div>
            </div>
            <div class="sd-type-row">
                <div class="sd-type-icon sd-icon-img"><i class="fas fa-image"></i></div>
                <div class="sd-type-info"><span class="sd-type-label">Images</span><span class="sd-type-count">${imgCount} file${imgCount !== 1 ? 's' : ''}</span></div>
                <div class="sd-type-size">${fmt(imgBytes)}</div>
            </div>
            <div class="sd-type-row">
                <div class="sd-type-icon sd-icon-note"><i class="fas fa-sticky-note"></i></div>
                <div class="sd-type-info"><span class="sd-type-label">Notes</span><span class="sd-type-count">${Object.values(allNotes).reduce((a,b)=>a+(b?.length||0),0)} note${Object.values(allNotes).reduce((a,b)=>a+(b?.length||0),0) !== 1 ? 's' : ''}</span></div>
                <div class="sd-type-size">${fmt(noteBytes)}</div>
            </div>
        </div>
        <div class="settings-group-title">By Department</div>
        <div class="settings-card sd-dept-card">
            ${deptEntries.length ? deptRows : '<div class="sd-empty">No departments yet</div>'}
        </div>
        <div class="sd-total-note">Total estimated: <b>${fmt(totalBytes)}</b></div>
    `;
}

function renderFavoritesPanel() {
    const list = loadRecents();
    document.getElementById('recentsCount').textContent = list.length;
    const card = document.getElementById('recentsListCard');
    if (!list.length) { card.innerHTML = '<div class="settings-empty-row">No recent files yet</div>'; return; }
    card.innerHTML = list.slice(0, 10).map(r => `
        <div class="dept-manage-row">
            <div class="settings-item-icon settings-icon-favorites" style="width:32px;height:32px;font-size:0.8rem;flex-shrink:0"><i class="fas fa-file"></i></div>
            <div class="dept-manage-name" style="font-weight:600;font-size:0.82rem;">${escapeHtml(r.name)}</div>
            <span class="dept-manage-count">${new Date(r.time).toLocaleDateString()}</span>
        </div>
    `).join('');
}

function renderStatisticsPanel() {
    let fileCount = 0,
        noteCount = 0,
        folderCount = 0;
    let largestFile = { name: '—', size: 0 };
    let largestFolder = { name: '—', count: 0 };

    function countFolders(obj) {
        for (const k in obj) if (typeof obj[k] === 'object') { folderCount++;
            countFolders(obj[k]); }
    }
    countFolders(fileSystem);

    for (const path in allFiles) {
        if (!allFiles[path]) continue;
        fileCount += allFiles[path].length;
        const folderTotal = allFiles[path].length;
        if (folderTotal > largestFolder.count) {
            largestFolder = { name: path.split('/').pop() || path, count: folderTotal };
        }
        allFiles[path].forEach(f => {
            const size = f.size || 0;
            if (size > largestFile.size) largestFile = { name: f.name, size };
        });
    }
    for (const path in allNotes) if (allNotes[path]) noteCount += allNotes[path].length;

    document.getElementById('statTotalFiles').textContent = fileCount;
    document.getElementById('statTotalNotes').textContent = noteCount;
    document.getElementById('statTotalFolders').textContent = folderCount;
    document.getElementById('statTotalDepts').textContent = Object.keys(fileSystem).length;
    document.getElementById('statLargestFile').textContent = largestFile.size > 0 ?
        `${largestFile.name} (${(largestFile.size / (1024 * 1024)).toFixed(2)} MB)` :
        '—';
    document.getElementById('statLargestFolder').textContent = largestFolder.count > 0 ?
        `${largestFolder.name} (${largestFolder.count} files)` :
        '—';
}

function renderDepartmentsManagePanel() {
    const list = document.getElementById('deptManageList');
    const depts = Object.keys(fileSystem);
    document.getElementById('deptManageCount').textContent = depts.length;
    if (!depts.length) { list.innerHTML = '<div class="settings-empty-row">No departments yet</div>'; return; }
    list.innerHTML = depts.map(dept => {
        const total = countDepartmentFiles(fileSystem[dept], [dept]);
        return `
            <div class="dept-manage-row">
                <div class="dept-manage-dot"${deptColors[dept] ? ` style="background:${deptColors[dept]}"` : ''}></div>
                <div class="dept-manage-name">${escapeHtml(dept)}</div>
                <span class="dept-manage-count">${total} items</span>
                <button class="dept-manage-delete" data-dept-del="${escapeHtml(dept)}"><i class="fas fa-trash"></i></button>
            </div>`;
    }).join('');
    list.querySelectorAll('[data-dept-del]').forEach(btn => {
        btn.onclick = () => {
            const dept = btn.getAttribute('data-dept-del');
            showConfirmModal(`Delete department "<b>${escapeHtml(dept)}</b>" and everything inside it?`, async (confirmed) => {
                if (!confirmed) return;
                delete fileSystem[dept];
                delete deptColors[dept];
                await saveFolderStructure();
                await saveDeptColors();
                renderDepartmentsManagePanel();
                refreshSettingsListSubtitles();
                if (currentPath[0] === dept) currentPath = [];
                render();
                showToast(`Department "${dept}" deleted`);
            });
        };
    });
}

function refreshSettingsListSubtitles() {
    const deptCount = Object.keys(fileSystem).length;
    const deptSub = document.getElementById('settingsDeptSub');
    if (deptSub) deptSub.textContent = `${deptCount} department${deptCount === 1 ? '' : 's'}`;
    updateStorageSummarySubtitle();
}

async function updateStorageSummarySubtitle() {
    const sub = document.getElementById('settingsStorageSub');
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            const usedMB = (est.usage / (1024 * 1024)).toFixed(1);
            if (sub) sub.textContent = `${usedMB} MB used`;
        } else if (sub) sub.textContent = 'Tap to view';
    } catch (e) { if (sub) sub.textContent = 'Tap to view'; }
}

// ============================================================
// SETTINGS PAGE INIT
// ============================================================

const settingsPanelRenderers = {
    storage: renderStoragePanel,
    appearance: applyThemePickUI,
    favorites: renderFavoritesPanel,
    statistics: renderStatisticsPanel,
    departments: renderDepartmentsManagePanel,
    security: updatePinStatusUI
};

function showSettingsScreen(screenId) {
    document.querySelectorAll('.settings-screen').forEach(s => s.classList.remove('settings-screen-active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('settings-screen-active');
    document.querySelector('.settings-page-inner').scrollTop = 0;
}

function openSettingsPage() {
    const page = document.getElementById('settingsPage');
    page.classList.remove('hidden');
    requestAnimationFrame(() => page.classList.add('settings-page-visible'));
    showSettingsScreen('settingsListScreen');
    refreshSettingsListSubtitles();
}

function closeSettingsPage() {
    const page = document.getElementById('settingsPage');
    page.classList.remove('settings-page-visible');
    setTimeout(() => page.classList.add('hidden'), 280);
}

function initSettingsPage() {
    document.getElementById('settingsBtn').onclick = openSettingsPage;
    document.getElementById('settingsCloseBtn').onclick = closeSettingsPage;

    document.querySelectorAll('.settings-panel-back').forEach(btn => {
        btn.onclick = () => showSettingsScreen('settingsListScreen');
    });

    document.querySelectorAll('.settings-item[data-panel]').forEach(item => {
        item.onclick = () => {
            const panel = item.getAttribute('data-panel');
            showSettingsScreen('settingsPanel-' + panel);
            if (settingsPanelRenderers[panel]) settingsPanelRenderers[panel]();
        };
    });

    document.getElementById('settingsPage').addEventListener('click', (e) => {
        if (e.target.id === 'settingsPage') closeSettingsPage();
    });

    // Appearance
    document.getElementById('themePickDark').onclick = () => {
        docmanSettings.theme = 'dark';
        saveSettings();
        applyTheme('dark');
    };
    document.getElementById('themePickLight').onclick = () => {
        docmanSettings.theme = 'light';
        saveSettings();
        applyTheme('light');
    };
    document.getElementById('themePickSystem').onclick = () => {
        docmanSettings.theme = 'system';
        saveSettings();
        applyTheme('system');
    };

    const enableAnimToggle = document.getElementById('enableAnimationsToggle');
    enableAnimToggle.checked = docmanSettings.enableAnimations;
    enableAnimToggle.onchange = () => {
        docmanSettings.enableAnimations = enableAnimToggle.checked;
        saveSettings();
        applyAnimations();
    };

    const enableParticlesToggle = document.getElementById('enableParticlesToggle');
    enableParticlesToggle.checked = docmanSettings.enableParticles;
    enableParticlesToggle.onchange = () => {
        docmanSettings.enableParticles = enableParticlesToggle.checked;
        saveSettings();
        applyParticles();
    };

    // PDF Settings
    document.querySelectorAll('[data-radio="pdfOpen"]').forEach(dot => {
        dot.parentElement.onclick = () => {
            docmanSettings.pdfOpen = dot.getAttribute('data-val');
            saveSettings();
            applyRadioUI('pdfOpen');
        };
    });
    applyRadioUI('pdfOpen');

    const thresholdVal = document.getElementById('pdfThresholdVal');
    thresholdVal.textContent = docmanSettings.pdfThreshold;
    document.getElementById('pdfThresholdDown').onclick = () => {
        if (docmanSettings.pdfThreshold > 1) {
            docmanSettings.pdfThreshold--;
            thresholdVal.textContent = docmanSettings.pdfThreshold;
            saveSettings();
        }
    };
    document.getElementById('pdfThresholdUp').onclick = () => {
        if (docmanSettings.pdfThreshold < 500) {
            docmanSettings.pdfThreshold++;
            thresholdVal.textContent = docmanSettings.pdfThreshold;
            saveSettings();
        }
    };

    // Favorites & Recents
    const showRecentsToggle = document.getElementById('showRecentsToggle');
    showRecentsToggle.checked = docmanSettings.showRecents;
    showRecentsToggle.onchange = () => {
        docmanSettings.showRecents = showRecentsToggle.checked;
        saveSettings();
    };

    const showFavoritesToggle = document.getElementById('showFavoritesToggle');
    showFavoritesToggle.checked = docmanSettings.showFavorites;
    showFavoritesToggle.onchange = () => {
        docmanSettings.showFavorites = showFavoritesToggle.checked;
        saveSettings();
    };

    const recentsLimitVal = document.getElementById('recentsLimitVal');
    recentsLimitVal.textContent = docmanSettings.recentsLimit;
    document.getElementById('recentsLimitDown').onclick = () => {
        if (docmanSettings.recentsLimit > 5) {
            docmanSettings.recentsLimit -= 5;
            recentsLimitVal.textContent = docmanSettings.recentsLimit;
            saveSettings();
        }
    };
    document.getElementById('recentsLimitUp').onclick = () => {
        if (docmanSettings.recentsLimit < 100) {
            docmanSettings.recentsLimit += 5;
            recentsLimitVal.textContent = docmanSettings.recentsLimit;
            saveSettings();
        }
    };

    document.getElementById('clearRecentsBtn').onclick = () => {
        showConfirmModal('Clear your recently opened files history?', (ok) => {
            if (!ok) return;
            saveRecents([]);
            renderFavoritesPanel();
            showToast('Recents cleared');
        });
    };

    // Search Settings
    const searchNotesToggle = document.getElementById('searchNotesToggle');
    searchNotesToggle.checked = docmanSettings.searchNotes;
    searchNotesToggle.onchange = () => {
        docmanSettings.searchNotes = searchNotesToggle.checked;
        saveSettings();
    };

    const searchFileNamesToggle = document.getElementById('searchFileNamesToggle');
    searchFileNamesToggle.checked = docmanSettings.searchFileNames;
    searchFileNamesToggle.onchange = () => {
        docmanSettings.searchFileNames = searchFileNamesToggle.checked;
        saveSettings();
    };

    const searchFolderNamesToggle = document.getElementById('searchFolderNamesToggle');
    searchFolderNamesToggle.checked = docmanSettings.searchFolderNames;
    searchFolderNamesToggle.onchange = () => {
        docmanSettings.searchFolderNames = searchFolderNamesToggle.checked;
        saveSettings();
    };

    document.getElementById('clearSearchHistoryBtn').onclick = () => {
        showConfirmModal('Clear your saved search history?', (ok) => {
            if (!ok) return;
            localStorage.removeItem(SEARCH_HISTORY_KEY);
            showToast('Search history cleared');
        });
    };

    // Departments
    document.getElementById('settingsAddDeptBtn').onclick = () => {
        addNewDepartment();
        setTimeout(renderDepartmentsManagePanel, 50);
        setTimeout(refreshSettingsListSubtitles, 50);
    };

    // Security
    const appLockToggle = document.getElementById('appLockToggle');
    appLockToggle.onchange = () => {
        if (appLockToggle.checked && !localStorage.getItem(PIN_KEY)) {
            promptSetPin((success) => {
                if (success) {
                    docmanSettings.appLock = true;
                    saveSettings();
                } else {
                    appLockToggle.checked = false;
                }
                updatePinStatusUI();
            });
        } else {
            docmanSettings.appLock = appLockToggle.checked;
            saveSettings();
            updatePinStatusUI();
        }
    };
    document.getElementById('changePinBtn').onclick = () => promptSetPin(() => {});

    // Storage
    document.getElementById('exportDataBtn').onclick = exportBackupData;
    document.getElementById('clearAllDataBtn').onclick = clearAllAppData;
    document.getElementById('viewStorageDetailsBtn').onclick = () => {
        showSettingsScreen('settingsPanel-storageDetail');
        renderStorageDetailPanel();
    };

    const importFileInput = document.getElementById('importFileInput');
    document.getElementById('importDataBtn').onclick = () => importFileInput.click();
    importFileInput.onchange = (e) => {
        if (e.target.files[0]) {
            importBackupData(e.target.files[0]);
            e.target.value = '';
        }
    };

    // About
    document.getElementById('checkUpdatesBtn').onclick = () => showToast("You're on the latest version ✓");

    applyTheme(docmanSettings.theme || 'dark');
    applyAnimations();
    applyParticles();
}

// ============================================================
// SHOW INFO
// ============================================================

function showInfo() {
    const deptCount = Object.keys(fileSystem).length;
    let folderCount = 0,
        fileCount = 0,
        noteCount = 0;

    function countRecursive(obj, path) {
        for (const key of Object.keys(obj)) {
            const p = path ? path + '/' + key : key;
            folderCount++;
            if (allFiles[p]) fileCount += allFiles[p].length;
            if (allNotes[p]) noteCount += allNotes[p].length;
            if (obj[key] && typeof obj[key] === 'object') countRecursive(obj[key], p);
        }
    }
    countRecursive(fileSystem, '');

    document.getElementById('infoStatDepts').textContent = deptCount;
    document.getElementById('infoStatFolders').textContent = folderCount;
    document.getElementById('infoStatFiles').textContent = fileCount;
    document.getElementById('infoStatNotes').textContent = noteCount;
    document.getElementById('deptInfoVersion').textContent = APP_VERSION;

    const modal = document.getElementById('deptInfoModal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });
}

function closeDeptInfo() {
    const modal = document.getElementById('deptInfoModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 80);
}

// ============================================================
// ATTACH PRESS EFFECTS
// ============================================================

function attachPressEffects() {
    const selectors = [
        '#homeBtn', '.type-btn', '#uploadBtn', '#newNoteBtn',
        '.action-btn', '.fav-file-btn', '.fav-note-btn',
        '.rename-file-btn', '.delete-file-btn', '.rename-note-btn',
        '.delete-note-btn', '.clear-search', '.modal-close',
        '.modal-footer button', '.breadcrumb-item', '.card', '.dept-oval',
        '#closeImageViewer'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(el => {
        el.removeEventListener('click', pressHandler);
        el.removeEventListener('touchstart', pressHandler, { passive: false });
        el.removeEventListener('mousedown', pressHandler);
        el.addEventListener('mousedown', pressHandler);
        el.addEventListener('touchstart', pressHandler, { passive: false });
        if (window.getComputedStyle(el).cursor === 'auto') el.style.cursor = 'pointer';
    });
}

function pressHandler(e) {
    if (this.hasAttribute('data-press-animating') || (e.button === 2)) return;
    if (e.type === 'touchstart' && this.hasAttribute('data-touch-processing')) return;
    if (e.type === 'touchstart') {
        this.setAttribute('data-touch-processing', 'true');
        setTimeout(() => this.removeAttribute('data-touch-processing'), 200);
    }
    addDepthEffect(this, e);
}

function addDepthEffect(element, event) {
    if (!element || element.hasAttribute('data-press-animating')) return;
    element.setAttribute('data-press-animating', 'true');
    haptic.press();
    setTimeout(() => {
        element.classList.remove('press-depth-3d');
        element.removeAttribute('data-press-animating');
    }, 150);
}

// ============================================================
// HANDLE FILES UPLOAD
// ============================================================

async function handleFiles(files) {
    for (let f of files) {
        const fileType = getFileType(f.name);
        if (fileType === 'image' || fileType === 'pdf') {
            await addFileToCurrentFolder(f);
        } else {
            showToast('Skipped: ' + f.name + ' (not supported)', true);
        }
    }
    render();
}

function triggerUpload() {
    document.getElementById('fileInput').click();
}

function triggerNewNote() {
    openNewNoteModal();
}

// ============================================================
// IMAGE VIEWER GESTURES
// ============================================================

function initImageViewerGestures() {
    const body = document.querySelector('.image-viewer-body');
    const img = document.getElementById('viewerImage');
    if (!body || !img) return;

    let scale = 1,
        minScale = 1,
        maxScale = 5;
    let originX = 0,
        originY = 0;
    let lastDist = 0;
    let isDragging = false,
        dragStartX = 0,
        dragStartY = 0;
    let lastOriginX = 0,
        lastOriginY = 0;

    function applyTransform() {
        img.style.transform = `scale(${scale}) translate(${originX}px, ${originY}px)`;
        img.style.cursor = scale > 1 ? 'grab' : 'default';
    }

    function resetTransform() {
        scale = 1;
        originX = 0;
        originY = 0;
        img.style.transition = 'transform 0.2s ease';
        applyTransform();
        setTimeout(() => { img.style.transition = ''; }, 220);
    }

    document.getElementById('closeImageViewer').addEventListener('click', resetTransform);
    body.addEventListener('dblclick', () => {
        scale === 1 ? (scale = 2.5, applyTransform()) : resetTransform();
    });

    body.addEventListener('touchstart', (e) => {
        img.style.transition = '';
        if (e.touches.length === 2) {
            lastDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        } else if (e.touches.length === 1 && scale > 1) {
            isDragging = true;
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
            lastOriginX = originX;
            lastOriginY = originY;
        }
    }, { passive: true });

    body.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = dist / lastDist;
            scale = Math.min(maxScale, Math.max(minScale, scale * delta));
            lastDist = dist;
            applyTransform();
        } else if (isDragging && e.touches.length === 1) {
            e.preventDefault();
            originX = lastOriginX + (e.touches[0].clientX - dragStartX) / scale;
            originY = lastOriginY + (e.touches[0].clientY - dragStartY) / scale;
            applyTransform();
        }
    }, { passive: false });

    body.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) isDragging = false;
        if (scale < 1.05) resetTransform();
    });

    body.addEventListener('mousedown', (e) => {
        if (scale > 1) {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            lastOriginX = originX;
            lastOriginY = originY;
            img.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        originX = lastOriginX + (e.clientX - dragStartX) / scale;
        originY = lastOriginY + (e.clientY - dragStartY) / scale;
        applyTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        if (scale > 1) img.style.cursor = 'grab';
    });

    const origClose = window.closeImageViewer;
    window.closeImageViewer = function() {
        origClose();
        resetTransform();
    };
}

// ============================================================
// DOM CONTENT LOADED
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Inject version
    const vEls = ['aboutVersionBadge', 'aboutVersionRow', 'deptInfoVersion'];
    vEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = APP_VERSION;
    });

    // Theme
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.onclick = toggleTheme;

    const savedTheme = docmanSettings.theme || localStorage.getItem('docman_theme') || 'dark';
    if (savedTheme === 'light-mode' || savedTheme === 'light') {
        document.body.classList.add('light-mode');
    } else if (savedTheme === 'system') {
        if (!window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('light-mode');
        }
    }
    updateThemeIcon();

    // Tabs
    document.getElementById('pdfTabBtn').onclick = () => setActiveTab('pdfs');
    document.getElementById('notesTabBtn').onclick = () => setActiveTab('notes');

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageViewer();
            closePdfViewer();
        }
    });

    // Image viewer close
    const closeBtn = document.getElementById('closeImageViewer');
    if (closeBtn) closeBtn.onclick = closeImageViewer;

    const viewer = document.getElementById('imageViewer');
    if (viewer) {
        viewer.addEventListener('click', (e) => {
            if (e.target === viewer) closeImageViewer();
        });
    }

    // File input
    document.getElementById('fileInput').addEventListener('change', async (e) => {
        await handleFiles(Array.from(e.target.files));
        e.target.value = '';
    });

    document.getElementById('newNoteBtn').onclick = triggerNewNote;
    document.getElementById('searchInput').addEventListener('input', () => render());
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('homeBtn').addEventListener('click', goHome);
    document.getElementById('uploadBtn').addEventListener('click', triggerUpload);

    // Settings
    initSettingsPage();

    // Load data
    showLoadingSkeleton();
    await initDB();

    const folderReq = db.transaction('folderStructure', 'readonly').objectStore('folderStructure').get('structure');
    folderReq.onsuccess = () => {
        if (folderReq.result) {
            fileSystem = folderReq.result.value;
        } else {
            fileSystem = {
                "REMELT": {
                    "FURNACE 1": {},
                    "FURNACE 2": {},
                    "FURNACE 3": {},
                    "FURNACE 4": {},
                    "FURNACE 5": {},
                    "ACD": {},
                    "DBF": {},
                    "ROD FEEDER": {},
                    "LAUNDER HEATERS": {},
                    "LAUNDER PANEL": {},
                    "HPU 1": {},
                    "HPU 2": {},
                    "A": {},
                    "B": {},
                    "C": {},
                    "D": {},
                    "E": {},
                },
                "CASTER": {},
                "HRM": {},
                "CRM": {},
                "ANNEALING": {},
                "TLL": {},
                "SLITTER": {},
                "UTILITY": {}
            };
            saveFolderStructure();
        }

        const deptColorsReq = db.transaction('folderStructure', 'readonly').objectStore('folderStructure').get('deptColors');
        deptColorsReq.onsuccess = () => {
            if (deptColorsReq.result) {
                deptColors = deptColorsReq.result.value;
            }
        };

        loadAllFileMetadata().then(() => {
            const notesReq = db.transaction('notes', 'readonly').objectStore('notes').getAll();
            notesReq.onsuccess = () => {
                allNotes = {};
                for (let item of notesReq.result) {
                    allNotes[item.folderPath] = item.notes;
                }
                render();

                const migrationRun = localStorage.getItem('docman_migration_done');
                if (!migrationRun) {
                    setTimeout(async () => {
                        await migrateBase64ToBlob();
                        localStorage.setItem('docman_migration_done', 'true');
                    }, 1500);
                }

                if (typeof window !== "undefined") {
                    window.docmanReady = true;
                }
            };
        });
    };

    attachPressEffects();
    initImageViewerGestures();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(drawDeptConnectors, 100);
    });

    if (typeof ResizeObserver !== 'undefined') {
        let roTimeout;
        const roObs = new ResizeObserver(() => {
            clearTimeout(roTimeout);
            roTimeout = setTimeout(drawDeptConnectors, 80);
        });
        const roWatch = document.querySelector('.departments-wrapper') || document.body;
        roObs.observe(roWatch);
    }

    window.addEventListener('load', () => {
        setTimeout(drawDeptConnectors, 300);
        setTimeout(drawDeptConnectors, 800);
        setTimeout(drawDeptConnectors, 1500);
    });

    const redrawOnFirstInteraction = () => {
        drawDeptConnectors();
        window.removeEventListener('scroll', redrawOnFirstInteraction, true);
        window.removeEventListener('touchstart', redrawOnFirstInteraction, true);
    };
    window.addEventListener('scroll', redrawOnFirstInteraction, { capture: true, passive: true, once: true });
    window.addEventListener('touchstart', redrawOnFirstInteraction, { capture: true, passive: true, once: true });

    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'IMG' || e.target.classList.contains('logo-tray-icon') ||
            e.target.classList.contains('header-gear-icon') || e.target.classList.contains('home-icon-img')) {
            e.preventDefault();
        }
    }, { passive: false });

    window.selectDepartment = selectDepartment;
    window.goBack = goBack;
    window.goHome = goHome;
    window.triggerUpload = triggerUpload;
    window.triggerNewNote = triggerNewNote;
    window.clearSearch = clearSearch;
    window.navigateToBreadcrumb = navigateToBreadcrumb;
    window.renameCurrentFolder = renameCurrentFolder;
    window.deleteCurrentFolder = deleteCurrentFolder;
    window.addNewFolder = addNewFolder;
    window.addNewDepartment = addNewDepartment;
    window.openFile = openFile;
    window.openNote = openNote;
    window.closeNoteModal = closeNoteModal;
    window.renameNote = renameNote;
    window.deleteNoteFromFolder = deleteNoteFromFolder;
    window.closeImageViewer = closeImageViewer;
    window.showInfo = showInfo;
    window.closeDeptInfo = closeDeptInfo;
});

// ============================================================
// END OF FILE
// ============================================================
