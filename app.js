// ============================================================
// DOCMAN - Document Manager
// Version: 2.0.0 - COMPLETE FIX
// ============================================================

const APP_VERSION = '2.0.0';

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
// FILE VIEWING / OPENING - SIMPLIFIED
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

    // Fallback: download
    const blob = new Blob([fileData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileEntry.name;
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
                const blob = new Blob([fileData], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 10000);
                showToast('Downloading: ' + fileName);
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
// PDF HANDLING - SIMPLIFIED WORKING VERSION
// ============================================================

let pdfJsLoaded = false;

// Load PDF.js
function loadPdfJsLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(pdfjsLib);
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(pdfjsLib);
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isAndroid() {
    return /android/i.test(navigator.userAgent);
}

async function handlePdfFile(fileData, fileName) {
    const fileSizeMB = fileData.size / (1024 * 1024);
    const thresholdBytes = (docmanSettings.pdfThreshold || 25) * 1024 * 1024;
    
    // If file is too large or user wants external, open externally
    if (fileData.size >= thresholdBytes || docmanSettings.pdfOpen === 'external') {
        showToast('Opening PDF externally...', false);
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        return;
    }

    // Try internal viewer
    try {
        await openPdfViewer(fileData, fileName);
    } catch (e) {
        console.error('Internal viewer failed:', e);
        showToast('Internal viewer failed. Downloading...', true);
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
}

// ============================================================
// PDF VIEWER - SIMPLE CANVAS RENDERER
// ============================================================

function openPdfViewer(fileData, fileName) {
    const existing = document.getElementById('pdfViewer');
    if (existing) existing.remove();

    const url = URL.createObjectURL(fileData);
    const fileSizeMB = fileData.size / (1024 * 1024);

    // If file is very large, don't try internal
    if (fileSizeMB > 20) {
        showToast('PDF is ' + fileSizeMB.toFixed(1) + ' MB — too large for internal viewer.', true);
        const blob = new Blob([fileData], { type: 'application/pdf' });
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url2), 30000);
        return;
    }

    const viewer = document.createElement('div');
    viewer.id = 'pdfViewer';
    viewer.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#1a1a1a;display:flex;flex-direction:column;';

    viewer.innerHTML = `
        <div style="padding:12px 16px;background:#212937;border-bottom:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:52px;">
            <button onclick="closePdfViewer()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;color:#ef4444;padding:6px 14px;cursor:pointer;font-size:0.82rem;font-weight:600;font-family:Inter,sans-serif;">
                Close
            </button>
            <span style="flex:1;color:#e2e8f0;font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(fileName)}</span>
            ${fileSizeMB > 5 ? `<span style="color:#f59e0b;font-size:0.7rem;">${fileSizeMB.toFixed(1)}MB</span>` : ''}
            <div style="display:flex;align-items:center;gap:4px;">
                <button id="pdfZoomOut" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e2e8f0;width:30px;height:30px;cursor:pointer;">−</button>
                <span id="pdfZoomLabel" style="color:#94a3b8;font-size:0.75rem;font-weight:600;width:44px;text-align:center;">100%</span>
                <button id="pdfZoomIn" style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#e2e8f0;width:30px;height:30px;cursor:pointer;">+</button>
            </div>
        </div>
        <div id="pdfContainer" style="flex:1;overflow:auto;background:#2a2a2a;padding:20px;display:flex;flex-direction:column;align-items:center;gap:10px;"></div>
        <div id="pdfLoading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-family:Inter,sans-serif;font-size:0.9rem;background:#2a2a2a;z-index:5;">
            <div style="text-align:center;">
                <div style="display:inline-block;width:30px;height:30px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:12px;"></div>
                <div>Loading PDF${fileSizeMB > 3 ? ' (' + fileSizeMB.toFixed(1) + ' MB)' : ''}…</div>
            </div>
        </div>
    `;

    document.body.appendChild(viewer);
    viewer._url = url;
    viewer._fileName = fileName;
    viewer._fileData = fileData;

    renderPdfPages(fileData, viewer);
}

function renderPdfPages(fileData, viewerEl) {
    const container = document.getElementById('pdfContainer');
    const loading = document.getElementById('pdfLoading');
    const zoomLabel = document.getElementById('pdfZoomLabel');
    const zoomIn = document.getElementById('pdfZoomIn');
    const zoomOut = document.getElementById('pdfZoomOut');

    let pdfDoc = null;
    let currentScale = 1;
    let totalPages = 0;

    function renderPage(pageNum) {
        pdfDoc.getPage(pageNum).then(page => {
            const viewport = page.getViewport({ scale: currentScale });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = Math.min(viewport.width, container.clientWidth - 40) + 'px';
            canvas.style.height = 'auto';
            canvas.style.margin = '0 auto';
            canvas.style.background = 'white';
            canvas.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
            canvas.style.borderRadius = '4px';
            
            const context = canvas.getContext('2d');
            page.render({ canvasContext: context, viewport: viewport });
            
            // Remove existing canvas for this page
            const existingCanvas = container.querySelector(`canvas[data-page="${pageNum}"]`);
            if (existingCanvas) existingCanvas.remove();
            
            canvas.dataset.page = pageNum;
            container.appendChild(canvas);
            
            // Update loading
            if (pageNum === 1) {
                loading.style.display = 'none';
            }
        }).catch(err => {
            console.error('Page render error:', err);
            loading.innerHTML = `<div style="text-align:center;color:#ef4444;">Failed to render page ${pageNum}</div>`;
        });
    }

    function renderAllPages() {
        if (!pdfDoc) return;
        container.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            renderPage(i);
        }
    }

    loadPdfJsLibrary().then(lib => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const arrayBuffer = e.target.result;
            lib.getDocument({ data: arrayBuffer }).promise.then(doc => {
                pdfDoc = doc;
                totalPages = doc.numPages;
                renderAllPages();
                
                zoomIn.onclick = () => {
                    currentScale = Math.min(currentScale + 0.1, 3);
                    zoomLabel.textContent = Math.round(currentScale * 100) + '%';
                    renderAllPages();
                };
                
                zoomOut.onclick = () => {
                    currentScale = Math.max(currentScale - 0.1, 0.3);
                    zoomLabel.textContent = Math.round(currentScale * 100) + '%';
                    renderAllPages();
                };
                
                // Keyboard shortcuts
                document.addEventListener('keydown', function onKey(e) {
                    if (e.key === 'ArrowRight') {
                        const canvases = container.querySelectorAll('canvas');
                        // Scroll to next page
                        let found = false;
                        for (let c of canvases) {
                            if (c.getBoundingClientRect().top >= 0 && !found) {
                                found = true;
                                continue;
                            }
                            if (found) {
                                c.scrollIntoView({ behavior: 'smooth' });
                                break;
                            }
                        }
                    }
                });
                
            }).catch(err => {
                console.error('PDF load error:', err);
                loading.innerHTML = `<div style="text-align:center;color:#ef4444;">Failed to load PDF. <button onclick="downloadPdfFallback()" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);border-radius:8px;color:#3b82f6;padding:8px 22px;margin-top:12px;cursor:pointer;">Download</button></div>`;
            });
        };
        reader.readAsArrayBuffer(fileData);
    }).catch(err => {
        console.error('PDF.js load error:', err);
        loading.innerHTML = `<div style="text-align:center;color:#ef4444;">Failed to load PDF viewer. <button onclick="downloadPdfFallback()" style="background:rgba(59,130,246,0.2);border:1px solid rgba(59,130,246,0.4);border-radius:8px;color:#3b82f6;padding:8px 22px;margin-top:12px;cursor:pointer;">Download</button></div>`;
    });
}

function downloadPdfFallback() {
    const viewer = document.getElementById('pdfViewer');
    if (viewer && viewer._fileData) {
        const blob = new Blob([viewer._fileData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = viewer._fileName || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showToast('Downloading: ' + (viewer._fileName || 'document.pdf'));
    }
}

function closePdfViewer() {
    const viewer = document.getElementById('pdfViewer');
    if (viewer) {
        if (viewer._url) URL.revokeObjectURL(viewer._url);
        viewer.remove();
    }
}

function downloadPdfFromViewer() {
    const viewer = document.getElementById('pdfViewer');
    if (viewer && viewer._fileData) {
        const blob = new Blob([viewer._fileData], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = viewer._fileName || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        showToast('Downloading: ' + (viewer._fileName || 'document.pdf'));
    }
}

window.closePdfViewer = closePdfViewer;
window.downloadPdfFromViewer = downloadPdfFromViewer;
window.downloadPdfFallback = downloadPdfFallback;

// ============================================================
// The rest of the functions (CONTEXT MENU, CARD CREATION, 
// FOLDER OPERATIONS, RENDER, STATS, FAVORITES, THEME, 
// SETTINGS, PIN, EXPORT/IMPORT, ETC.) remain the same as 
// the original file. They are not changed.
// ============================================================

// Note: The remaining code (context menu, card creation, 
// folder operations, render function, stats, favorites, 
// theme, settings panel, pin verification, export/import, 
// DOMContentLoaded, etc.) should be copied from your 
// original working version as they are not related to 
// the PDF issues.

// ============================================================
// END OF FILE
// ============================================================