// ============================================================
// DOCMAN - Document Manager
// Version: 1.0.4 - FIXED PDF OPENING
// ============================================================

const APP_VERSION = '1.0.4';

const SETTINGS_KEY = 'docman_settings_v2';
const RECENTS_KEY = 'docman_recents_v1';
const SEARCH_HISTORY_KEY = 'docman_search_history_v1';
const PIN_KEY = 'docman_pin_v2';
const PDF_CRASH_FLAG_KEY = 'docman_pdf_open_pending_v1';

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
    pdfOpen: 'docman',
    pdfThreshold: 25,
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
        const blobId = folderPath + '/' + fileName;
        const blobTx = db.transaction('blobs', 'readwrite');
        blobTx.objectStore('blobs').put({ blobId, blob });
        await new Promise((resolve, reject) => {
            blobTx.oncomplete = resolve;
            blobTx.onerror = () => reject(blobTx.error);
        });

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
// FILE VIEWING / OPENING - FIXED
// ============================================================

async function openFileWithGesture(fileEntry, folderPath) {
    trackRecentFile(fileEntry.name);

    if (fileEntry.fileData instanceof Blob) {
        const file = new File([fileEntry.fileData], fileEntry.name, { type: 'application/pdf' });
        if (navigator.share) {
            try {
                await navigator.share({ files: [file], title: fileEntry.name });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }
        await handlePdfFile(fileEntry.fileData, fileEntry.name);
        return;
    }

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
// PDF HANDLING - COMPLETE FIX
// ============================================================

let isSharing = false;
let shareTimeout = null;
let pdfJsWorkerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdfJsLib = null;

// Load PDF.js library
async function loadPdfJs() {
    if (pdfJsLib) return pdfJsLib;
    
    try {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfJsWorkerSrc;
        pdfJsLib = pdfjsLib;
        return pdfJsLib;
    } catch (e) {
        console.error('Failed to load PDF.js:', e);
        showToast('Failed to load PDF viewer. Opening externally...', true);
        return null;
    }
}

// Preload PDF.js in background
(function preloadPdfJs() {
    const warm = () => { loadPdfJs().catch(() => {}); };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(warm, { timeout: 5000 });
    } else {
        setTimeout(warm, 1500);
    }
})();

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid() {
    return /android/i.test(navigator.userAgent);
}

function isSamsungBrowser() {
    return /SamsungBrowser/i.test(navigator.userAgent);
}

// ============================================================
// EXTERNAL PDF OPENING - FIXED
// ============================================================

async function sharePdfExternally(fileData, fileName) {
    try {
        // Create a blob URL for the PDF
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Method 1: Try Web Share API (mobile)
        if (navigator.share) {
            try {
                const file = new File([fileData], fileName, { type: 'application/pdf' });
                await navigator.share({ 
                    files: [file], 
                    title: fileName 
                });
                URL.revokeObjectURL(url);
                return;
            } catch (shareErr) {
                if (shareErr.name === 'AbortError') {
                    URL.revokeObjectURL(url);
                    return;
                }
                console.warn('Share failed, trying alternative:', shareErr);
            }
        }
        
        // Method 2: Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Revoke URL after delay
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showToast('Opening: ' + fileName);
        
    } catch (err) {
        console.error('External open error:', err);
        showToast('Could not open PDF externally', true);
        
        // Last resort: try download
        try {
            const blob = new Blob([fileData], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            showToast('Downloading: ' + fileName);
        } catch (e) {
            showToast('Could not open or download file', true);
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
// MAIN PDF HANDLER - FIXED
// ============================================================

async function handlePdfFile(fileData, fileName) {
    let openMode = docmanSettings.pdfOpen || 'docman';

    // CRASH RECOVERY
    if (openMode === 'docman') {
        try {
            const pending = JSON.parse(localStorage.getItem(PDF_CRASH_FLAG_KEY) || 'null');
            if (pending) {
                docmanSettings.pdfOpen = 'external';
                openMode = 'external';
                saveSettings();
                localStorage.removeItem(PDF_CRASH_FLAG_KEY);
                showToast('PDF viewer crashed last time. Switched to External.', true);
                await sharePdfExternally(fileData, fileName);
                return;
            }
        } catch (e) { /* ignore */ }
    }

    const fileSizeMB = fileData.size / (1024 * 1024);
    const thresholdBytes = (docmanSettings.pdfThreshold || 25) * 1024 * 1024;
    
    // Size-based fallback
    if (fileData.size >= thresholdBytes) {
        showToast('PDF is ' + fileSizeMB.toFixed(1) + ' MB — opening externally.', false);
        await sharePdfExternally(fileData, fileName);
        return;
    }
    
    if (isIOS() && fileData.size > 10 * 1024 * 1024) {
        showToast('Large PDF (' + fileSizeMB.toFixed(1) + ' MB) — opening externally.', false);
        await sharePdfExternally(fileData, fileName);
        return;
    }
    
    if (isAndroid() && fileData.size > 15 * 1024 * 1024) {
        showToast('Large PDF (' + fileSizeMB.toFixed(1) + ' MB) — opening externally.', false);
        await sharePdfExternally(fileData, fileName);
        return;
    }

    // Try internal or external based on setting
    if (openMode === 'docman') {
        // Try internal viewer with PDF.js
        try {
            await openPdfViewerPdfJs(fileData, fileName);
        } catch (e) {
            console.error('Internal viewer failed:', e);
            showToast('Internal viewer failed. Opening externally...', true);
            await sharePdfExternally(fileData, fileName);
        }
    } else {
        await sharePdfExternally(fileData, fileName);
    }
}

// ============================================================
// PDF.JS VIEWER - FIXED
// ============================================================

function openPdfViewerPdfJs(fileData, fileName) {
    const existing = document.getElementById('pdfViewer');
    if (existing) {
        if (existing._url) URL.revokeObjectURL(existing._url);
        existing.remove();
    }

    const url = URL.createObjectURL(fileData);
    const fileSizeMB = fileData.size / (1024 * 1024);

    // Check if file is too large for internal viewer
    if (fileSizeMB > 20) {
        showToast('PDF is ' + fileSizeMB.toFixed(1) + ' MB — too large for internal viewer.', true);
        sharePdfExternally(fileData, fileName);
        return;
    }

    const viewer = document.createElement('div');
    viewer.id = 'pdfViewer';
    viewer.className = 'pdf-viewer';
    viewer.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#1a1a1a;display:flex;flex-direction:column;';

    viewer.innerHTML = `
        <div class="pdf-viewer-header" style="padding:12px 16px;padding-top:max(12px, env(safe-area-inset-top));background:#212937;border-bottom:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;gap:8px;flex-shrink:0;z-index:2;min-height:52px;touch-action:manipulation;">
            <button onclick="closePdfViewer()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;color:#ef4444;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:600;font-family:Inter,sans-serif;letter-spacing:0.02em;touch-action:manipulation;flex-shrink:0;">
                Close
            </button>
            <span class="pdf-viewer-title" style="flex:1;color:#e2e8f0;font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${escapeHtml(fileName)}</span>
            ${fileSizeMB > 5 ? `<span style="color:#f59e0b;font-size:0.7rem;margin-right:8px;">${fileSizeMB.toFixed(1)}MB</span>` : ''}
            <div style="width:1px;align-self:stretch;background:rgba(255,255,255,0.15);flex-shrink:0;margin:0 2px;"></div>
            <div id="pdfZoomControls" style="display:flex;align-items:center;gap:2px;flex-shrink:0;">
                <button id="pdfZoomOutBtn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e2e8f0;width:30px;height:30px;cursor:pointer;touch-action:manipulation;"><i class="fas fa-minus" style="font-size:0.7rem;"></i></button>
                <span id="pdfZoomLabel" style="color:#94a3b8;font-size:0.75rem;font-weight:600;width:44px;text-align:center;font-family:Inter,sans-serif;">100%</span>
                <button id="pdfZoomInBtn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e2e8f0;width:30px;height:30px;cursor:pointer;touch-action:manipulation;"><i class="fas fa-plus" style="font-size:0.7rem;"></i></button>
                <div style="width:1px;align-self:stretch;background:rgba(255,255,255,0.15);flex-shrink:0;margin:0 6px;"></div>
                <button id="pdfFitWidthBtn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e2e8f0;width:30px;height:30px;cursor:pointer;touch-action:manipulation;"><i class="fas fa-arrows-left-right" style="font-size:0.7rem;"></i></button>
                <button id="pdfFitPageBtn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e2e8f0;width:30px;height:30px;cursor:pointer;touch-action:manipulation;"><i class="fas fa-expand" style="font-size:0.7rem;"></i></button>
            </div>
        </div>
        <div id="pdfViewerBody" style="flex:1;position:relative;background:#2a2a2a;overflow:auto;">
            <div id="pdfContainer" style="width:100%;height:100%;padding:20px;display:flex;flex-direction:column;align-items:center;gap:10px;"></div>
            <div id="pdfLoadingMsg" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-family:Inter,sans-serif;font-size:0.9rem;pointer-events:none;z-index:10;">
                <div style="text-align:center;">
                    <div style="display:inline-block;width:30px;height:30px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>
                    <div>Loading PDF${fileSizeMB > 3 ? ' (' + fileSizeMB.toFixed(1) + ' MB)' : ''}…</div>
                    ${fileSizeMB > 5 ? '<div style="font-size:0.7rem;color:#6b7280;margin-top:6px;">Large file — please be patient</div>' : ''}
                </div>
            </div>
            <div id="pdfErrorMsg" style="position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#2a2a2a;z-index:10;flex-direction:column;gap:12px;padding:20px;">
                <div style="color:#ef4444;font-size:1.5rem;"><i class="fas fa-exclamation-triangle"></i></div>
                <div style="color:#e2e8f0;text-align:center;font-family:Inter,sans-serif;font-size:0.9rem;">Could not load PDF</div>
                <button onclick="sharePdfExternally(document.getElementById('pdfViewer')._fileData, document.getElementById('pdfViewer')._fileName)" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);border-radius:8px;color:#3b82f6;padding:8px 22px;font-size:0.85rem;font-weight:600;font-family:Inter,sans-serif;cursor:pointer;touch-action:manipulation;">Open Externally</button>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .pdf-page-container {
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
            margin: 0 auto;
            border-radius: 4px;
            overflow: hidden;
            max-width: 100%;
        }
        .pdf-page-container canvas {
            display: block;
            width: 100%;
            height: auto;
        }
        .pdf-page-number {
            color: #94a3b8;
            font-size: 0.75rem;
            font-family: Inter, sans-serif;
            text-align: center;
            padding: 4px 0;
        }
    `;
    viewer.appendChild(style);

    document.body.appendChild(viewer);
    viewer._url = url;
    viewer._fileName = fileName;
    viewer._fileData = fileData;

    try {
        localStorage.setItem(PDF_CRASH_FLAG_KEY, JSON.stringify({ fileName: fileName, time: Date.now(), size: fileData.size }));
    } catch (e) { /* ignore */ }

    const escHandler = function(e) {
        if (e.key === 'Escape') {
            closePdfViewer();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    viewer._escHandler = escHandler;

    renderPdfWithPdfJs(fileData, viewer);
}

function renderPdfWithPdfJs(fileData, viewerEl) {
    const container = document.getElementById('pdfContainer');
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    const errorMsg = document.getElementById('pdfErrorMsg');
    const viewerBody = document.getElementById('pdfViewerBody');
    const viewer = document.getElementById('pdfViewer');

    if (!container) return;

    let pdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;
    let zoomLevel = 1;

    const zoomLabel = document.getElementById('pdfZoomLabel');
    const zoomInBtn = document.getElementById('pdfZoomInBtn');
    const zoomOutBtn = document.getElementById('pdfZoomOutBtn');
    const fitWidthBtn = document.getElementById('pdfFitWidthBtn');
    const fitPageBtn = document.getElementById('pdfFitPageBtn');

    function updateZoomLabel() {
        if (zoomLabel) {
            zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
        }
    }

    function renderPage(pageNum) {
        if (!pdfDoc) return;
        
        const containerWidth = container.clientWidth - 40;
        const containerHeight = viewerBody ? viewerBody.clientHeight - 40 : window.innerHeight - 200;
        
        pdfDoc.getPage(pageNum).then(page => {
            const viewport = page.getViewport({ scale: 1 });
            const pageWidth = viewport.width;
            const pageHeight = viewport.height;
            
            let scaleToUse = zoomLevel;
            if (scaleToUse === 0) {
                scaleToUse = Math.min(containerWidth / pageWidth, 1.5);
            }
            
            const scaledViewport = page.getViewport({ scale: scaleToUse });
            
            const oldCanvas = container.querySelector('canvas');
            if (oldCanvas) oldCanvas.remove();
            
            const canvas = document.createElement('canvas');
            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;
            canvas.style.width = '100%';
            canvas.style.maxWidth = Math.min(scaledViewport.width, containerWidth) + 'px';
            canvas.style.height = 'auto';
            canvas.style.margin = '0 auto';
            
            const context = canvas.getContext('2d');
            
            const renderContext = {
                canvasContext: context,
                viewport: scaledViewport
            };
            
            page.render(renderContext).promise.then(() => {
                if (loadingMsg) loadingMsg.style.display = 'none';
            }).catch(err => {
                console.error('Page render error:', err);
                showPdfError();
            });
            
            container.innerHTML = '';
            container.appendChild(canvas);
            
            const pageNumDiv = document.createElement('div');
            pageNumDiv.className = 'pdf-page-number';
            pageNumDiv.textContent = `Page ${pageNum} of ${totalPages}`;
            container.appendChild(pageNumDiv);
            
            updateZoomLabel();
        }).catch(err => {
            console.error('Failed to get page:', err);
            showPdfError();
        });
    }

    function showPdfError() {
        if (loadingMsg) loadingMsg.style.display = 'none';
        if (errorMsg) errorMsg.style.display = 'flex';
    }

    loadPdfJs().then(lib => {
        if (!lib) {
            showPdfError();
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            
            lib.getDocument({ data: arrayBuffer }).promise.then(doc => {
                pdfDoc = doc;
                totalPages = doc.numPages;
                
                renderPage(1);
                clearPdfCrashFlag();
                
                if (zoomInBtn) {
                    zoomInBtn.onclick = function() {
                        zoomLevel = Math.min(zoomLevel + 0.1, 3);
                        renderPage(currentPage);
                    };
                }
                
                if (zoomOutBtn) {
                    zoomOutBtn.onclick = function() {
                        zoomLevel = Math.max(zoomLevel - 0.1, 0.3);
                        renderPage(currentPage);
                    };
                }
                
                if (fitWidthBtn) {
                    fitWidthBtn.onclick = function() {
                        zoomLevel = 0;
                        renderPage(currentPage);
                    };
                }
                
                if (fitPageBtn) {
                    fitPageBtn.onclick = function() {
                        const containerWidth = container.clientWidth - 40;
                        const containerHeight = viewerBody ? viewerBody.clientHeight - 40 : window.innerHeight - 200;
                        pdfDoc.getPage(currentPage).then(page => {
                            const viewport = page.getViewport({ scale: 1 });
                            const pageWidth = viewport.width;
                            const pageHeight = viewport.height;
                            const scaleX = containerWidth / pageWidth;
                            const scaleY = containerHeight / pageHeight;
                            zoomLevel = Math.min(scaleX, scaleY, 1.5);
                            renderPage(currentPage);
                        });
                    };
                }

                document.addEventListener('keydown', function onPdfKey(e) {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                        if (currentPage < totalPages) {
                            currentPage++;
                            renderPage(currentPage);
                        }
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                        if (currentPage > 1) {
                            currentPage--;
                            renderPage(currentPage);
                        }
                    }
                });
                
                let touchStartX = 0;
                let touchStartY = 0;
                
                viewerBody.addEventListener('touchstart', function(e) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }, { passive: true });
                
                viewerBody.addEventListener('touchend', function(e) {
                    const touchEndX = e.changedTouches[0].clientX;
                    const touchEndY = e.changedTouches[0].clientY;
                    const dx = touchStartX - touchEndX;
                    const dy = touchStartY - touchEndY;
                    
                    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
                        if (dx > 0 && currentPage < totalPages) {
                            currentPage++;
                            renderPage(currentPage);
                        } else if (dx < 0 && currentPage > 1) {
                            currentPage--;
                            renderPage(currentPage);
                        }
                    }
                }, { passive: true });
                
                viewerBody.addEventListener('wheel', function(e) {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        const delta = e.deltaY > 0 ? -0.1 : 0.1;
                        zoomLevel = Math.max(0.3, Math.min(3, zoomLevel + delta));
                        renderPage(currentPage);
                    }
                }, { passive: false });

                let resizeTimeout;
                window.addEventListener('resize', function() {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        renderPage(currentPage);
                    }, 300);
                });

            }).catch(err => {
                console.error('PDF load error:', err);
                showPdfError();
                showToast('Failed to load PDF. Opening externally...', true);
                sharePdfExternally(fileData, viewer?._fileName || 'document.pdf');
            });
        };
        
        reader.onerror = function() {
            console.error('FileReader error');
            showPdfError();
            showToast('Failed to read PDF. Opening externally...', true);
            sharePdfExternally(fileData, viewer?._fileName || 'document.pdf');
        };
        
        reader.readAsArrayBuffer(fileData);
    }).catch(err => {
        console.error('PDF.js load error:', err);
        showPdfError();
        showToast('PDF viewer failed to load. Opening externally...', true);
        sharePdfExternally(fileData, viewer?._fileName || 'document.pdf');
    });
}

function clearPdfCrashFlag() {
    try { localStorage.removeItem(PDF_CRASH_FLAG_KEY); } catch (e) {}
}

function closePdfViewer() {
    clearPdfCrashFlag();
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

window.closePdfViewer = closePdfViewer;
window.downloadPdfFromViewer = downloadPdfFromViewer;

// ============================================================
// The rest of the file continues with CONTEXT MENU, CARDS, etc.
// (Same as before - keeping this short for the fix)
// ============================================================

// ... [CONTEXT MENU, CARDS, FOLDER OPERATIONS, RENDER, etc. remain the same]

// ============================================================
// DOM CONTENT LOADED
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    // ... [All existing DOMContentLoaded code remains the same]
});

// ============================================================
// END OF FILE
// ============================================================