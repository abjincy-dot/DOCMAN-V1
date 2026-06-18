
const DB_NAME = 'DocmanDB';
const DB_VERSION = 9;
let db = null;
let allFiles = {};
let allNotes = {};
let fileSystem = {};
let deptColors = {}; // store random gradients for departments
let currentPath = [];
let isSearchMode = false;
let currentActiveTab = 'pdfs';
let editingNoteId = null;

function showToast(msg, isErr = false) {
    const toast = document.getElementById('toast');
    toast.querySelector('span').textContent = msg;
    toast.style.background = isErr ? "linear-gradient(135deg,#ef4444,#dc2626)" : "linear-gradient(135deg,#10b981,#059669)";
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); toast.classList.add('hidden'); }, 3000);
}


function showPromptModal(message, defaultVal, callback) {
    const existing = document.getElementById('customPrompt');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'customPrompt';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:20px;';
    overlay.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid rgba(100,150,255,0.3);border-radius:20px;padding:28px 24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
            <p style="color:#e2e8f0;font-size:0.95rem;font-weight:600;margin-bottom:16px;font-family:Inter,sans-serif;">${message}</p>
            <input id="customPromptInput" type="text" value="${defaultVal || ''}" style="width:100%;box-sizing:border-box;padding:12px 16px;border-radius:12px;border:1px solid rgba(100,150,255,0.4);background:rgba(255,255,255,0.06);color:#f8fafc;font-size:16px;font-family:Inter,sans-serif;outline:none;margin-bottom:20px;">
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button id="customPromptCancel" style="padding:10px 22px;border-radius:40px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;cursor:pointer;font-family:Inter,sans-serif;font-size:0.85rem;">Cancel</button>
                <button id="customPromptOk" style="padding:10px 22px;border-radius:40px;border:none;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;cursor:pointer;font-weight:600;font-family:Inter,sans-serif;font-size:0.85rem;">OK</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const input = document.getElementById('customPromptInput');
    input.focus();
    input.select();
    const close = (val) => { overlay.remove(); if (val !== null) callback(val); };
    document.getElementById('customPromptOk').onclick = () => close(input.value);
    document.getElementById('customPromptCancel').onclick = () => close(null);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') close(input.value); if (e.key === 'Escape') close(null); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
}

function showConfirmModal(message, callback) {
    const existing = document.getElementById('customConfirm');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'customConfirm';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:20px;';
    overlay.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid rgba(255,80,80,0.3);border-radius:20px;padding:28px 24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
            <p style="color:#e2e8f0;font-size:0.95rem;font-weight:600;margin-bottom:24px;font-family:Inter,sans-serif;line-height:1.5;">${message}</p>
            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button id="customConfirmCancel" style="padding:10px 22px;border-radius:40px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;cursor:pointer;font-family:Inter,sans-serif;font-size:0.85rem;">Cancel</button>
                <button id="customConfirmOk" style="padding:10px 22px;border-radius:40px;border:none;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;cursor:pointer;font-weight:600;font-family:Inter,sans-serif;font-size:0.85rem;">Delete</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); callback(val); };
    document.getElementById('customConfirmOk').onclick = () => close(true);
    document.getElementById('customConfirmCancel').onclick = () => close(false);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
}

function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

function getRandomGradient() {
    const hue = Math.floor(Math.random() * 360);
    const sat = 40 + Math.random() * 20;
    const light1 = 30 + Math.random() * 10;
    const light2 = light1 - 5;
    return `linear-gradient(100deg, hsl(${hue}, ${sat}%, ${light1}%), hsl(${hue}, ${sat}%, ${light2}%))`;
}

async function saveDeptColors() {
    const tx = db.transaction('folderStructure', 'readwrite');
    const store = tx.objectStore('folderStructure');
    store.put({ key: 'deptColors', value: deptColors });
    tx.commit();
}

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

function selectDepartment(d){ 
    navigateWithPageTurn(() => {
        currentPath = [d]; 
        render();
    }, 'forward');
}

function goBack(){ 
    if(currentPath.length && !isSearchMode){ 
        navigateWithPageTurn(() => {
            currentPath.pop(); 
            render();
        }, 'back');
    } else if(isSearchMode) { 
        clearSearch(); 
    }
}

function goHome(){
    if(currentPath.length === 0 && !isSearchMode) return;
    if(isSearchMode){ clearSearch(); return; }
    navigateWithPageTurn(() => {
        currentPath = [];
        render();
    }, 'back');
}

function navigateToBreadcrumb(idx){
    if(idx===-1 && currentPath.length===0) return;
    if(idx >= 0 && idx === currentPath.length - 1) return;
    const isGoingBack = idx < currentPath.length - 1;
    navigateWithPageTurn(() => {
        if(idx===-1) currentPath=[];
        else currentPath = currentPath.slice(0,idx+1);
        render();
    }, isGoingBack ? 'back' : 'forward');
}

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'fa-file-pdf',
        'jpg': 'fa-file-image', 'jpeg': 'fa-file-image', 'png': 'fa-file-image', 'gif': 'fa-file-image', 'webp': 'fa-file-image', 'svg': 'fa-file-image'
    };
    return iconMap[ext] || 'fa-file';
}

function getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    return 'other';
}

function openImageViewer(imageUrl, fileName) {
    const viewer = document.getElementById('imageViewer');
    const viewerImage = document.getElementById('viewerImage');
    viewerImage.src = imageUrl;
    viewerImage.alt = fileName;
    viewer.classList.remove('hidden');
}

function closeImageViewer() {
    const viewer = document.getElementById('imageViewer');
    const viewerImage = document.getElementById('viewerImage');
    viewer.classList.add('hidden');
    viewerImage.src = '';
}

function openFile(dataUrl, fileName) {
    trackRecentFile(fileName, dataUrl);
    const fileType = getFileType(fileName);
    if (fileType === 'image') {
        openImageViewer(dataUrl, fileName);
    } 
    else if (fileType === 'pdf') {
        sharePdfFile(dataUrl, fileName);
    }
    else {
        showConfirmModal(`This file type may not be supported.<br>Download "<b>${fileName}</b>"?`, (confirmed) => {
            if (confirmed) {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                link.click();
            }
        });
    }
}

async function saveAllNotesToDB() {
    const tx = db.transaction('notes','readwrite');
    const store = tx.objectStore('notes');
    store.clear();
    for(const folderPath in allNotes) if(allNotes[folderPath]?.length) store.put({id:folderPath, folderPath, notes:allNotes[folderPath]});
    tx.commit();
}
async function saveAllFilesToDB() {
    const tx = db.transaction('files','readwrite');
    const store = tx.objectStore('files');
    store.clear();
    for(const folderPath in allFiles) if(allFiles[folderPath]?.length) store.put({id:folderPath, folderPath, files:allFiles[folderPath]});
    tx.commit();
}
function saveFolderStructure() {
    db.transaction('folderStructure','readwrite').objectStore('folderStructure').put({key:'structure', value:fileSystem});
}

function initDB() {
    return new Promise((resolve,reject)=>{
        const req = indexedDB.open(DB_NAME,DB_VERSION);
        req.onerror = ()=>reject(req.error);
        req.onsuccess = ()=>{ db=req.result; resolve(); };
        req.onupgradeneeded = e=>{
            const db2 = e.target.result;
            if(!db2.objectStoreNames.contains('files')) db2.createObjectStore('files',{keyPath:'id'});
            if(!db2.objectStoreNames.contains('folderStructure')) db2.createObjectStore('folderStructure',{keyPath:'key'});
            if(!db2.objectStoreNames.contains('notes')) db2.createObjectStore('notes',{keyPath:'id'});
        };
    });
}

function createFurnace1Logs() {
    return {
        "Temperature Records F1": {},
        "Pressure Data F1": {},
        "Quality Check F1": {},
        "Maintenance Log F1": {},
        "Production Report F1": {},
        "Safety Checklist F1": {},
        "Morning Shift F1": {},
        "Evening Shift F1": {},
        "Night Shift F1": {},
        "Raw Material F1": {},
        "Finished Goods F1": {},
        "Defect Report F1": {},
        "Efficiency Data F1": {},
        "Downtime Records F1": {},
        "Operator Notes F1": {},
        "Supervisor Log F1": {},
        "Weekly Summary F1": {},
        "Monthly Report F1": {},
        "Inspection Log F1": {},
        "Calibration Data F1": {}
    };
}

function createFurnace2Logs() {
    return {
        "Temp Records F2": {},
        "Pressure Logs F2": {},
        "Quality Data F2": {},
        "Maintenance Records F2": {},
        "Production Stats F2": {},
        "Safety Reports F2": {},
        "Shift A F2": {},
        "Shift B F2": {},
        "Raw Material Log F2": {},
        "Output Data F2": {},
        "Defects F2": {},
        "Performance F2": {},
        "Downtime F2": {},
        "Operator Log F2": {},
        "Supervisor Notes F2": {},
        "Weekly Report F2": {},
        "Monthly Data F2": {},
        "Annual Report F2": {},
        "Inspection F2": {},
        "Calibration F2": {}
    };
}

function createFurnace3Logs() {
    return {
        "Temperature F3": {},
        "Pressure F3": {},
        "Quality F3": {},
        "Maintenance F3": {},
        "Production F3": {},
        "Safety F3": {},
        "Shift-1 F3": {},
        "Shift-2 F3": {},
        "Raw F3": {},
        "Finished F3": {},
        "Defect F3": {},
        "Efficiency F3": {},
        "Downtime F3": {},
        "Operator F3": {},
        "Supervisor F3": {},
        "Weekly F3": {},
        "Monthly F3": {},
        "Annual F3": {},
        "Inspect F3": {},
        "Calibrate F3": {}
    };
}

function createFurnace4Logs() {
    return {
        "Temperature Log F4": {},
        "Pressure Log F4": {},
        "Quality Log F4": {},
        "Maintenance Log F4": {},
        "Production Log F4": {},
        "Safety Log F4": {},
        "Shift Morning F4": {},
        "Shift Evening F4": {},
        "Shift Night F4": {},
        "Raw Material F4": {},
        "Finished Product F4": {},
        "Defect Tracking F4": {},
        "Efficiency F4": {},
        "Downtime F4": {},
        "Operator Record F4": {},
        "Supervisor Record F4": {},
        "Weekly Record F4": {},
        "Monthly Record F4": {},
        "Inspection Record F4": {},
        "Calibration Record F4": {}
    };
}

async function loadFromIndexedDB() {
    const folderReq = db.transaction('folderStructure','readonly').objectStore('folderStructure').get('structure');
    folderReq.onsuccess = ()=>{
        if(folderReq.result) fileSystem = folderReq.result.value;
        else {
            fileSystem = {
                "REMELT": {
                    "FURNACE 1": createFurnace1Logs(), 
                    "FURNACE 2": createFurnace2Logs(), 
                    "FURNACE 3": createFurnace3Logs(),
                    "FURNACE 4": createFurnace4Logs(), 
                    "FURNACE 5": {}, 
                    "ACD": {}, 
                    "DBF": {}, 
                    "ROD FEEDER": {}, 
                    "LAUNDER HEATERS": {},
                    "LAUNDER PANEL ": {}, 
                    "HPU 1": {}, 
                    "HPU 2": {}, 
                    "M":{}, 
                    "N":{}, 
                    "O":{}, 
                    "P":{}, 
                    "Q":{}, 
                    "R":{}, 
                    "S":{}, 
                    "T":{}, 
                    "U":{}, 
                    "V":{}, 
                    "W":{}, 
                    "X":{}, 
                    "Y":{}, 
                    "Z":{}
                },
                "CASTER":{"Quality Reports":{},"Mechanical":{},"Maintenance":{},"Production Data":{},"Testing":{},"Checklists":{},"Safety":{},"Training":{}},
                "HRM":{"Employee Records":{},"Attendance":{},"Performance":{},"Training Logs":{},"Safety Compliance":{},"Policies":{},"Reports":{},"Certifications":{}},
                "CRM":{"PLC Programs":{},"CAD Drawings":{},"Electrical":{},"SCADA":{},"Automation":{},"Reports":{},"Configurations":{},"Manuals":{}},
                "ANNEALING":{"Temperature Control":{},"Process Parameters":{},"Quality Assurance":{},"Maintenance":{},"Safety":{},"Production Logs":{},"Testing":{},"SOP Documents":{}},
                "TLL":{"PLC Programs":{},"CAD Drawings":{},"Maintenance":{},"Production Logs":{},"Process Optimization":{},"Quality Reports":{},"Manuals":{},"Safety":{}},
                "SLITTER":{"Blade Maintenance":{},"Quality Control":{},"Production Reports":{},"Mechanical":{},"Safety":{},"Checklists":{},"Training":{},"Testing":{}},
                "UTILITY":{"Power Supply":{},"Water System":{},"Compressed Air":{},"HVAC":{},"Reports":{},"Safety":{},"Manuals":{},"Testing":{}}
            };
            saveFolderStructure();
        }

        const deptColorsReq = db.transaction('folderStructure','readonly').objectStore('folderStructure').get('deptColors');
        deptColorsReq.onsuccess = () => {
            if (deptColorsReq.result) {
                deptColors = deptColorsReq.result.value;
            }
        };
        
        const fileReq = db.transaction('files','readonly').objectStore('files').getAll();
        fileReq.onsuccess = ()=>{
            allFiles = {};
            for(let item of fileReq.result) allFiles[item.folderPath] = item.files;
            const notesReq = db.transaction('notes','readonly').objectStore('notes').getAll();
notesReq.onsuccess = ()=>{
    allNotes = {};

    for(let item of notesReq.result) {
        allNotes[item.folderPath] = item.notes;
    }

    render();

    drawDeptConnectorsWhenStable();

    if (typeof window !== "undefined") {
        window.docmanReady = true;
    }
};

        };   // fileReq.onsuccess
    };       // folderReq.onsuccess
}            // loadFromIndexedDB                       
function getCurrentFolderObject() { return currentPath.reduce((o,p)=>o?.[p], fileSystem); }
function getFilesForCurrentFolder() { return allFiles[currentPath.join('/')] || []; }
function getNotesForCurrentFolder() { return allNotes[currentPath.join('/')] || []; }

async function addFileToCurrentFolder(file) {
    const folderPath = currentPath.join('/');
    if(!allFiles[folderPath]) allFiles[folderPath] = [];
    const base64 = await new Promise(r=>{const rd=new FileReader(); rd.onload=e=>r(e.target.result); rd.readAsDataURL(file);});
    allFiles[folderPath].push({name:file.name, dataUrl:base64, type:file.type});
    await saveAllFilesToDB();
}
function deleteFileFromFolder(folderPath, fileName) {
    showConfirmModal(`Delete "<b>${fileName}</b>"?`, (confirmed) => {
    if(confirmed){
        if(allFiles[folderPath]){
            allFiles[folderPath] = allFiles[folderPath].filter(f=>f.name!==fileName);
            if(!allFiles[folderPath].length) delete allFiles[folderPath];
            saveAllFilesToDB();
            render();
        }
    }
    }); // end showConfirmModal
}
function renameFileInFolder(folderPath, oldName, newName){
    if(!newName?.trim()) return showToast("Name empty",true);
    if(allFiles[folderPath]){
        const idx = allFiles[folderPath].findIndex(f=>f.name===oldName);
        if(idx!==-1){
            allFiles[folderPath][idx].name = newName;
            saveAllFilesToDB();
            render();
        }
    }
}
async function addNoteToCurrentFolder(title, content){
    const folderPath = currentPath.join('/');
    if(!allNotes[folderPath]) allNotes[folderPath]=[];
    const note = { id: Date.now()+'-'+Math.random().toString(36).substr(2,6), title:title.trim(), content:content.trim(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    allNotes[folderPath].push(note);
    await saveAllNotesToDB();
    render();
}
async function updateNote(folderPath, noteId, title, content){
    const idx = allNotes[folderPath]?.findIndex(n=>n.id===noteId);
    if(idx!==-1){
        allNotes[folderPath][idx].title = title.trim();
        allNotes[folderPath][idx].content = content.trim();
        allNotes[folderPath][idx].updatedAt = new Date().toISOString();
        await saveAllNotesToDB();
        render();
        return true;
    }
    return false;
}
async function renameNote(folderPath, noteId, newTitle){
    if(!newTitle?.trim()) return showToast("Title empty",true);
    const idx = allNotes[folderPath]?.findIndex(n=>n.id===noteId);
    if(idx!==-1){
        allNotes[folderPath][idx].title = newTitle.trim();
        allNotes[folderPath][idx].updatedAt = new Date().toISOString();
        await saveAllNotesToDB();
        render();
    }
}
async function deleteNoteFromFolder(folderPath, noteId){
    if(allNotes[folderPath]){
        const note = allNotes[folderPath].find(n=>n.id===noteId);
        allNotes[folderPath] = allNotes[folderPath].filter(n=>n.id!==noteId);
        if(!allNotes[folderPath].length) delete allNotes[folderPath];
        await saveAllNotesToDB();
        render();
    }
}
function openNote(note){
    const modal = document.getElementById('noteModal');
        document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    editingNoteId = note.id;
    document.getElementById('saveNoteBtn').onclick = async ()=>{
        const newTitle = document.getElementById('noteTitle').value;
        const newContent = document.getElementById('noteContent').value;
        if(newTitle.trim()){ await updateNote(note.folder, note.id, newTitle, newContent); closeNoteModal(); }
        else showToast("Title empty",true);
    };
    modal.classList.add('show');
}

function createFileCard(file, folderPath){
    const iconClass = getFileIcon(file.name);
    const div = document.createElement('div');
    div.className = 'card file-card';
    div.innerHTML = `
        <div class="card-icon"><i class="fas ${iconClass}"></i></div>
        <div class="card-filename" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        <div class="card-buttons">
            <button class="rename-file-btn" title="Rename"><i class="fas fa-edit"></i></button>
            <button class="delete-file-btn" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;
    let _touchCount = 0;
    div.addEventListener('touchstart', (e) => { _touchCount = e.touches.length; }, { passive: true });
    div.addEventListener('click', (e)=>{
        if(_touchCount > 1) { _touchCount = 0; return; }
        _touchCount = 0;
        if(e.target.closest('.rename-file-btn') || e.target.closest('.delete-file-btn')) return;
        openFile(file.dataUrl, file.name);
    });
    div.querySelector('.rename-file-btn').addEventListener('click', (e)=>{
        e.stopPropagation();
        showPromptModal('Rename file:', file.name, (newName) => { if(newName?.trim()) renameFileInFolder(folderPath, file.name, newName.trim()); });
    });
    div.querySelector('.delete-file-btn').addEventListener('click', (e)=>{
        e.stopPropagation();
        deleteFileFromFolder(folderPath, file.name);
    });
    return div;
}

function createNoteCard(note, folderPath){
    const div = document.createElement('div');
    div.className = 'card note-card';
    div.innerHTML = `
        <div class="card-icon"><i class="fas fa-sticky-note"></i></div>
        <div class="card-filename" title="${escapeHtml(note.title)}">${escapeHtml(note.title)}</div>
        <div class="card-buttons">
            <button class="rename-note-btn" title="Rename Note"><i class="fas fa-edit"></i></button>
            <button class="delete-note-btn" title="Delete Note"><i class="fas fa-trash"></i></button>
        </div>
    `;
    div.addEventListener('click', (e)=>{
        if(e.target.closest('.rename-note-btn') || e.target.closest('.delete-note-btn')) return;
        openNote({...note, folder:folderPath});
    });
    div.querySelector('.rename-note-btn').addEventListener('click', (e)=>{
        e.stopPropagation();
        showPromptModal('Rename note:', note.title, (newTitle) => { if(newTitle?.trim()) renameNote(folderPath, note.id, newTitle.trim()); });
    });
    div.querySelector('.delete-note-btn').addEventListener('click', (e)=>{
        e.stopPropagation();
        showConfirmModal(`Delete note "<b>${note.title}</b>"?`, (confirmed) => { if(confirmed) deleteNoteFromFolder(folderPath, note.id); });
    });
    return div;
}

function createCard(title, onClick, isFolder=false){
    const div = document.createElement('div');
    div.className = isFolder ? 'card glow-folder' : 'card';
    div.innerHTML = `<div class="card-icon"><i class="fas ${isFolder ? 'fa-folder' : 'fa-folder-open'}"></i></div><div class="card-filename">${escapeHtml(title)}</div><div class="card-buttons"></div>`;
    div.onclick = onClick;
    return div;
}

function render(){
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    if(query){
        isSearchMode=true;
        document.getElementById('clearSearchBtn').classList.remove('hidden');
        const results=[];
        for(const path in allFiles) if(allFiles[path]) allFiles[path].forEach(f=>{ if(f.name.toLowerCase().includes(query)) results.push({...f, folder:path, type:'file'});});
        for(const path in allNotes) if(allNotes[path]) allNotes[path].forEach(n=>{ if(n.title.toLowerCase().includes(query) || n.content.toLowerCase().includes(query)) results.push({...n, folder:path, type:'note'});});
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
        if(!results.length) contentDiv.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results found.</p></div>';
        else results.forEach(item => { if(item.type==='file') contentDiv.appendChild(createFileCard(item, item.folder)); else contentDiv.appendChild(createNoteCard(item, item.folder)); });
        updateStats();
        attachPressEffects();
        return;
    }
    isSearchMode=false;
    document.getElementById('clearSearchBtn').classList.add('hidden');
    document.getElementById('searchInfo').classList.add('hidden');
    document.getElementById('content').innerHTML = '';
    const folder = getCurrentFolderObject();
    if(!folder){ currentPath=[]; render(); return; }
    document.getElementById('homeBtn').classList.toggle('hidden', currentPath.length===0);
    const bcDiv = document.getElementById('breadcrumb');
    const isRoot = currentPath.length===0;
    
    if(isRoot){

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
        let html = '<div class="departments-wrapper"><div class="departments-grid">';
        for(let dept in fileSystem){
            const sub = Object.keys(fileSystem[dept]).length;
            const fcount = allFiles[dept]?.length||0;
            const ncount = allNotes[dept]?.length||0;
            const total = countDepartmentFiles(fileSystem[dept], [dept]);
            const icon = deptIcons[dept] || 'fa-folder';
            const knownDepts = ['REMELT','CASTER','HRM','CRM','ANNEALING','TLL','SLITTER','UTILITY'];
            const pillBgStyle = (!knownDepts.includes(dept) && deptColors[dept]) ? ` style="background:${deptColors[dept]}"` : '';
        html += `<div class="dept-card" data-dept="${escapeHtml(dept)}">
            <div class="dept-oval" onclick="selectDepartment('${escapeHtml(dept)}')">
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
</div>
<div class="dept-add-footer">
    <button class="dept-add-btn" onclick="addNewDepartment()">
        <span class="dept-add-btn-icon"><i class="fas fa-plus"></i></span>
        <span class="dept-add-btn-label">Add Department</span>
    </button>
</div>`;
        
        document.getElementById('departmentsSection').innerHTML = html;
        document.getElementById('homeBtn').classList.add('hidden');
        document.getElementById('uploadBtn').classList.add('hidden');
        document.getElementById('newNoteBtn').classList.add('hidden');
        attachDepartmentPressEffects();
        drawDeptConnectorsWhenStable();
    } else document.getElementById('departmentsSection').innerHTML = '';
    
    const hasSubfolders = Object.keys(folder).length>0;
    const isLeafFolder = !isRoot && !hasSubfolders;
    const typeSelector = document.querySelector('.type-selector');
    if(typeSelector) typeSelector.style.display = isLeafFolder ? 'flex' : 'none';
    if(isLeafFolder){
        if(currentActiveTab==='pdfs'){ document.getElementById('uploadBtn').classList.remove('hidden'); document.getElementById('newNoteBtn').classList.add('hidden'); }
        else { document.getElementById('uploadBtn').classList.add('hidden'); document.getElementById('newNoteBtn').classList.remove('hidden'); }
       
    } else { document.getElementById('uploadBtn').classList.add('hidden'); document.getElementById('newNoteBtn').classList.add('hidden'); }

    if(!isRoot){
        const folderCardEl = document.createElement('div');
        folderCardEl.className = 'current-folder-card';


        const parentPath = currentPath.slice(0, -1);
        const pathHtml = `<span class="cf-home" onclick="navigateToBreadcrumb(-1)"><i class="fas fa-home"></i> <span style="color:#3b82f6">Home</span></span>` +
            parentPath.map((p,i) => `<span class="cf-sep"> / </span><span class="cf-part">${escapeHtml(p)}</span>`).join('') +
            `<span class="cf-sep"> / </span>`;
        folderCardEl.innerHTML = `
            <div class="cf-path-row">${pathHtml}</div>
            <div class="cf-bottom-row">
                <div class="cf-folder-name">${escapeHtml(currentPath[currentPath.length-1])}</div>
                <div class="cf-folder-icon"><i class="fas fa-folder"></i><i class="fas fa-star cf-star"></i></div>
            </div>`;
        document.getElementById('content').appendChild(folderCardEl);
    }

    if(!isRoot){
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
        const _contentEl = document.getElementById('content');
        const _folderCardInDom = _contentEl.querySelector('.current-folder-card');
        if(_folderCardInDom){
            _contentEl.insertBefore(actionDiv, _folderCardInDom);
        } else {
            _contentEl.appendChild(actionDiv);
        }
    }
    
    if(!isRoot && hasSubfolders){
        for(let key in folder) {
            const folderCard = createCard(key, () => { 
                navigateWithPageTurn(() => {
                    currentPath.push(key); 
                    render();
                }, 'forward');
            }, true);
            document.getElementById('content').appendChild(folderCard);
        }
    }
    
    if(isLeafFolder){
        if(currentActiveTab==='pdfs'){
            const files = getFilesForCurrentFolder();
            const path = currentPath.join('/');
            if(files.length) files.forEach(f=>document.getElementById('content').appendChild(createFileCard(f,path)));
            else {
                const dz = document.createElement('div');
                dz.className = 'upload-drop-zone';
                dz.innerHTML = `<i class="fas fa-cloud-upload-alt upload-dz-icon"></i><div class="upload-dz-text">Drag &amp; drop files here or click to upload</div><div class="upload-dz-sub">Supports all file types.</div>`;
                dz.addEventListener('click', () => triggerUpload());
                dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
                dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
                dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if(e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files)); });
                document.getElementById('content').appendChild(dz);
            }
        } else {
            const notes = getNotesForCurrentFolder();
            const path = currentPath.join('/');
            if(notes.length) notes.forEach(n=>document.getElementById('content').appendChild(createNoteCard(n,path)));
            else document.getElementById('content').innerHTML += '<div class="empty-state empty-state-note"><i class="fas fa-sticky-note"></i><p>No notes yet. Click + New Note to add.</p></div>';
        }
    }
    updateStats();
    attachPressEffects();
}
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
    const badges    = wrapper.querySelectorAll('.dept-pill-icon');
    if (!hubCircle || !badges.length) return;

    const wW = wrapper.offsetWidth;
    const wR = wrapper.getBoundingClientRect();
    const wH = wrapper.offsetHeight;
    if (!wW) { setTimeout(drawDeptConnectors, 100); return; }

    function offsetRelTo(el, ancestor) {
        let top = 0, left = 0;
        while (el && el !== ancestor) {
            top  += el.offsetTop;
            left += el.offsetLeft;
            el = el.offsetParent;
        }
        return { top, left };
    }

    const badgeData = Array.from(badges).map(b => {
        const off = offsetRelTo(b, wrapper);
        return {
            top:    off.top,
            left:   off.left,
            width:  b.offsetWidth,
            height: b.offsetHeight
        };
    });
    if (!badgeData.every(r => r.width > 0)) { setTimeout(drawDeptConnectors, 100); return; }

    const wrapperOffFromParent = offsetRelTo(wrapper, wrapper.offsetParent || document.body);
    const centerYwrapper = (
        Math.min(...badgeData.map(r => r.top + r.height / 2)) +
        Math.max(...badgeData.map(r => r.top + r.height / 2))
    ) / 2;
    const hubParent  = hubCircle.offsetParent || hubCircle.parentElement;
    const hubParentOff = offsetRelTo(hubParent, wrapper.offsetParent || document.body);
    const hubTopLocal = (wrapperOffFromParent.top + centerYwrapper) - hubParentOff.top - hubCircle.offsetHeight / 2;

    hubCircle.style.position = 'absolute';
    hubCircle.style.top = hubTopLocal + 'px';
    hubCircle.style.right = '8px';
    hubCircle.style.left = 'auto';
    hubCircle.style.transform = 'none';

    void hubCircle.offsetHeight; // force reflow

    if (!hubCircle.offsetWidth) { setTimeout(drawDeptConnectors, 100); return; }

    const hubOffNow  = offsetRelTo(hubCircle, wrapper);
    const hubLeftX   = hubOffNow.left;
    const hubTopY    = hubOffNow.top;
    const hubCenterY = hubTopY + hubCircle.offsetHeight / 2;
    const svgTotalW2 = Math.max(wW, hubOffNow.left + hubCircle.offsetWidth + 10);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('dept-connector-svg');
    svg.setAttribute('width',  svgTotalW2);
    svg.setAttribute('height', wH);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';

    const n  = badgeData.length;
    const cr = 25; // corner radius for 90ÃÂ° curves

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

        const y2 =
    n === 1
        ? hubCenterY
        : hubStartY + hubStep * si;

const dy = y2 - d.y1;
const safeCr = Math.min(cr, Math.abs(dy) / 2);
        let pathD;
        const segments = [];

const hubRadius = hubCircle.offsetWidth / 2 + 8;

const hubCenterX = hubLeftX + hubCircle.offsetWidth / 2;

const dyFromCenter = y2 - hubCenterY;

const safeDy = Math.max(
    -hubRadius + 2,
    Math.min(hubRadius - 2, dyFromCenter)
);

const dotX =
    hubCenterX -
    Math.sqrt(
        hubRadius * hubRadius -
        safeDy * safeDy
    );

const lineEndX = dotX;

        segments.push(`M ${d.x1} ${d.y1}`);

        const exitX = d.x1 + 6;
        segments.push(`L ${exitX} ${d.y1}`);
const centerIndex = (n - 1) / 2;
const distanceFromCenter = Math.abs(si - centerIndex);

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
const hDot = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'circle'
);

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
        bDot.setAttribute('r',  '3');
        bDot.setAttribute('fill', 'rgba(255,255,255,0.75)');
        svg.appendChild(bDot);
    });

    wrapper.appendChild(svg);
}

function attachDepartmentPressEffects() {
    document.querySelectorAll('.dept-oval').forEach(oval => {
        oval.addEventListener('touchstart', () => {}, { passive: false });
    });
}

function triggerUpload(){ document.getElementById('fileInput').click(); }
function triggerNewNote(){ openNewNoteModal(); }
function clearSearch(){
    document.getElementById('searchInput').value='';
    isSearchMode=false;
    document.getElementById('searchInfo').classList.add('hidden');
    document.getElementById('clearSearchBtn').classList.add('hidden');
    render();
}
function renameCurrentFolder(){
    if(!currentPath.length) return;
    const old = currentPath[currentPath.length-1];
    showPromptModal('Rename folder:', old, (newName) => {
    if(newName && newName!==old && newName.trim()){
        const parent = currentPath.slice(0,-1).reduce((o,p)=>o[p], fileSystem);

        const rebuilt = {};
        for (const key of Object.keys(parent)) {
            if (key === old) rebuilt[newName] = parent[old];
            else rebuilt[key] = parent[key];
        }

        for (const key of Object.keys(parent)) delete parent[key];
        for (const key of Object.keys(rebuilt)) parent[key] = rebuilt[key];
        const oldPath = currentPath.join('/');
        const newPath = [...currentPath.slice(0,-1), newName].join('/');
        if(allFiles[oldPath]){ allFiles[newPath]=allFiles[oldPath]; delete allFiles[oldPath]; }
        if(allNotes[oldPath]){ allNotes[newPath]=allNotes[oldPath]; delete allNotes[oldPath]; }
        currentPath[currentPath.length-1]=newName;
        saveFolderStructure(); saveAllFilesToDB(); saveAllNotesToDB();
        render();
    }
    }); // end showPromptModal
}
function deleteCurrentFolder(){
    if(!currentPath.length) return;
    const name = currentPath[currentPath.length-1];
    showConfirmModal(`Delete "<b>${name}</b>" and all its contents? This cannot be undone.`, (confirmed) => {
    if(confirmed){
        const path = currentPath.join('/');
        const prefix = path + '/';
        for (const k of Object.keys(allFiles)) { if (k === path || k.startsWith(prefix)) delete allFiles[k]; }
        for (const k of Object.keys(allNotes)) { if (k === path || k.startsWith(prefix)) delete allNotes[k]; }
        const parent = currentPath.slice(0,-1).reduce((o,p)=>o[p], fileSystem);
        delete parent[name];
        currentPath.pop();
        saveFolderStructure(); saveAllFilesToDB(); saveAllNotesToDB();
        render();
    }
    }); // end showConfirmModal
}
function addNewFolder(){
    showPromptModal('New folder name:', '', (name) => {
        if(name && name.trim()){
            const cur = getCurrentFolderObject();
            if(cur && !cur[name]){ cur[name]={}; saveFolderStructure(); render(); }
            else showToast('Already exists',true);
        }
    });
}

function addNewDepartment(){
    showPromptModal('New department name:', '', (name) => {
        if(name && name.trim()){
            const trimmed = name.trim();
            if(!fileSystem[trimmed]){
                fileSystem[trimmed] = {};

                if(!deptColors[trimmed]){
                    deptColors[trimmed] = getRandomGradient();
                    saveDeptColors();
                }
                saveFolderStructure();
                render();
            } else {
                showToast('Department already exists', true);
            }
        } else if(name !== null && name.trim() === '') {
            showToast('Department name cannot be empty', true);
        }
    });
}

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
function updateStats(){
    let folderCount=0, fileCount=0, notesCount=0;
    function countFolders(obj){ for(let k in obj) if(typeof obj[k]==='object'){ folderCount++; countFolders(obj[k]); } }
    countFolders(fileSystem);
    for(let k in allFiles) if(allFiles[k]) fileCount += allFiles[k].length;
    for(let k in allNotes) if(allNotes[k]) notesCount += allNotes[k].length;
    document.getElementById('folderCount').textContent = folderCount;
    document.getElementById('fileCount').textContent = fileCount;
    document.getElementById('notesCount').textContent = notesCount;
}
function setActiveTab(tab){
    currentActiveTab = tab;
    const pdfBtn = document.getElementById('pdfTabBtn');
    const notesBtn = document.getElementById('notesTabBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const newNoteBtn = document.getElementById('newNoteBtn');
    if(tab==='pdfs'){ pdfBtn.classList.add('active'); notesBtn.classList.remove('active'); uploadBtn.classList.remove('hidden'); newNoteBtn.classList.add('hidden'); }
    else { pdfBtn.classList.remove('active'); notesBtn.classList.add('active'); uploadBtn.classList.add('hidden'); newNoteBtn.classList.remove('hidden'); }
    render();
}
function openNewNoteModal(){
    editingNoteId = null;
        document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('saveNoteBtn').onclick = async ()=>{
        const title = document.getElementById('noteTitle').value;
        const content = document.getElementById('noteContent').value;
        if(title.trim()){ await addNoteToCurrentFolder(title, content); closeNoteModal(); }
        else showToast("Title empty",true);
    };
    document.getElementById('noteModal').classList.add('show');
}
function closeNoteModal(){ document.getElementById('noteModal').classList.remove('show'); editingNoteId = null; }
function toggleTheme(){ document.body.classList.toggle('light-mode'); localStorage.setItem('docman_theme', document.body.classList.contains('light-mode') ? 'light-mode' : ''); updateThemeIcon(); }
function updateThemeIcon(){
    const isDark = !document.body.classList.contains('light-mode');
    const themeBtn = document.getElementById('themeToggle');
    if(themeBtn) themeBtn.innerHTML = `<div class="theme-icon-wrapper"><i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}"></i></div>`;
    
}
function addDepthEffect(element, event){
    if(!element || element.hasAttribute('data-press-animating')) return;
    element.setAttribute('data-press-animating','true');
    element.classList.add('press-depth-3d');
    if(window.navigator?.vibrate) window.navigator.vibrate(12);
    setTimeout(()=>{
        element.classList.remove('press-depth-3d');
        element.removeAttribute('data-press-animating');
    },150);
}
function pressHandler(e){
    if(this.hasAttribute('data-press-animating') || (e.button===2)) return;
    if(e.type==='touchstart' && this.hasAttribute('data-touch-processing')) return;
    if(e.type==='touchstart'){ this.setAttribute('data-touch-processing','true'); setTimeout(()=>this.removeAttribute('data-touch-processing'),200); }
    addDepthEffect(this,e);
}
function attachPressEffects(){

    const themeBtn = document.getElementById('themeToggle');
    if(themeBtn){
        themeBtn.onclick = toggleTheme;
    }

    const selectors = ['#homeBtn','.type-btn','#uploadBtn','#newNoteBtn','.action-btn','.rename-file-btn','.delete-file-btn','.rename-note-btn','.delete-note-btn','.clear-search','.modal-close','.modal-footer button','.breadcrumb-item','.card','.dept-oval','#closeImageViewer'];
    document.querySelectorAll(selectors.join(',')).forEach(el=>{
        el.removeEventListener('click', pressHandler);
        el.removeEventListener('touchstart', pressHandler, {passive:false});
        el.removeEventListener('mousedown', pressHandler);
        el.addEventListener('mousedown', pressHandler);
        el.addEventListener('touchstart', pressHandler, {passive:false});
        if(window.getComputedStyle(el).cursor==='auto') el.style.cursor='pointer';
    });
}
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

let pdfViewerDoc = null;
let pdfPageHeights = [];
let pdfRenderedPages = new Set();
let pdfScrollListener = null;
let pdfScale = 1;
let pdfBaseScale = 1;
const PDF_BUFFER = 2; // pages above/below viewport to keep rendered

async function openPdfViewer(dataUrl, fileName) {
    const viewer = document.getElementById('pdfViewer');
    const body = document.getElementById('pdfViewerBody');
    const loadingMsg = document.getElementById('pdfLoadingMsg');
    const titleEl = document.getElementById('pdfViewerTitle');
    const pageInfo = document.getElementById('pdfPageInfo');

    body.innerHTML = '';
    pdfPageHeights = [];
    pdfRenderedPages = new Set();
    if (pdfScrollListener) { body.removeEventListener('scroll', pdfScrollListener); pdfScrollListener = null; }
    loadingMsg.classList.remove('hidden');
    titleEl.textContent = fileName;
    pageInfo.textContent = '';
    viewer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        const base64 = dataUrl.split(',')[1];
        const byteChars = atob(base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);

        if (pdfViewerDoc) { pdfViewerDoc.destroy(); pdfViewerDoc = null; }
        pdfViewerDoc = await pdfjsLib.getDocument({ data: byteArr }).promise;
        const totalPages = pdfViewerDoc.numPages;
        pageInfo.textContent = '1 / ' + totalPages;
        loadingMsg.classList.add('hidden');

        const firstPage = await pdfViewerDoc.getPage(1);
        const firstVp = firstPage.getViewport({ scale: 1 });
        pdfBaseScale = Math.min(window.innerWidth, 900) / firstVp.width;
        pdfScale = pdfBaseScale;

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdfViewerDoc.getPage(i);
            const vp = page.getViewport({ scale: pdfScale });
            const wrapper = document.createElement('div');
            wrapper.className = 'pdf-page-wrapper';
            wrapper.dataset.page = i;
            wrapper.style.width = vp.width + 'px';
            wrapper.style.height = vp.height + 'px';
            body.appendChild(wrapper);
            pdfPageHeights.push(vp.height + 8); // 8 = gap
        }

        await renderVisiblePages(body, totalPages, pageInfo);

        pdfScrollListener = throttle(async () => {
            await renderVisiblePages(body, totalPages, pageInfo);
        }, 150);
        body.addEventListener('scroll', pdfScrollListener, { passive: true });

    } catch(err) {
        loadingMsg.classList.add('hidden');
        body.innerHTML = '<p style="color:#ef4444;padding:20px;">Failed to load PDF: ' + err.message + '</p>';
    }
}

async function renderVisiblePages(body, totalPages, pageInfo) {
    if (!pdfViewerDoc) return;
    const scrollTop = body.scrollTop;
    const viewHeight = body.clientHeight;

    let cumH = 0;
    let firstVisible = totalPages, lastVisible = 1;
    for (let i = 0; i < pdfPageHeights.length; i++) {
        const pageTop = cumH;
        const pageBottom = cumH + pdfPageHeights[i];
        const bufferPx = viewHeight * PDF_BUFFER;
        if (pageBottom >= scrollTop - bufferPx && pageTop <= scrollTop + viewHeight + bufferPx) {
            if (i + 1 < firstVisible) firstVisible = i + 1;
            if (i + 1 > lastVisible) lastVisible = i + 1;
        }
        cumH += pdfPageHeights[i];
    }

    cumH = 0;
    for (let i = 0; i < pdfPageHeights.length; i++) {
        if (cumH + pdfPageHeights[i] > scrollTop) {
            pageInfo.textContent = (i + 1) + ' / ' + totalPages;
            break;
        }
        cumH += pdfPageHeights[i];
    }

    const wrappers = body.querySelectorAll('.pdf-page-wrapper');
    for (let i = 0; i < wrappers.length; i++) {
        const pageNum = i + 1;
        const wrapper = wrappers[i];
        if (pageNum >= firstVisible && pageNum <= lastVisible) {
            if (!pdfRenderedPages.has(pageNum)) {
                pdfRenderedPages.add(pageNum);
                renderPageIntoWrapper(wrapper, pageNum);
            }
        } else if (Math.abs(pageNum - firstVisible) > PDF_BUFFER * 2 + 4) {

            if (pdfRenderedPages.has(pageNum)) {
                pdfRenderedPages.delete(pageNum);
                const canvas = wrapper.querySelector('canvas');
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    wrapper.removeChild(canvas);
                }
            }
        }
    }
}

async function renderPageIntoWrapper(wrapper, pageNum) {
    if (!pdfViewerDoc) return;
    try {
        const page = await pdfViewerDoc.getPage(pageNum);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: pdfScale * dpr });
        const canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = (vp.width / dpr) + 'px';
        canvas.style.height = (vp.height / dpr) + 'px';
        wrapper.style.width = (vp.width / dpr) + 'px';
        wrapper.style.height = (vp.height / dpr) + 'px';
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

        if (pdfViewerDoc && !wrapper.querySelector('canvas')) {
            wrapper.appendChild(canvas);
        }
    } catch(e) {  }
}

function throttle(fn, delay) {
    let last = 0, timer = null;
    return function(...args) {
        const now = Date.now();
        if (now - last >= delay) { last = now; fn(...args); }
        else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...args); }, delay); }
    };
}

function closePdfViewer() {
    const viewer = document.getElementById('pdfViewer');
    viewer.classList.add('hidden');
    document.body.style.overflow = '';
    const body = document.getElementById('pdfViewerBody');
    if (pdfScrollListener) { body.removeEventListener('scroll', pdfScrollListener); pdfScrollListener = null; }
    body.innerHTML = '';
    document.getElementById('pdfPageInfo').textContent = '';
    pdfRenderedPages = new Set();
    pdfPageHeights = [];
    if (pdfViewerDoc) { pdfViewerDoc.destroy(); pdfViewerDoc = null; }
}

async function sharePdfFile(dataUrl, fileName) {
    try {

        const base64 = dataUrl.split(',')[1];
        const byteChars = atob(base64);
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: 'application/pdf' });
        const file = new File([blob], fileName, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: fileName });
        } else {

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
    } catch(err) {
        if (err.name !== 'AbortError') {
            showToast('Could not open file: ' + err.message, true);
        }
    }
}

window.openFile = openFile;
window.openNote = openNote;
window.closeNoteModal = closeNoteModal;
window.renameNote = renameNote;
window.deleteNoteFromFolder = deleteNoteFromFolder;
window.closeImageViewer = closeImageViewer;

async function handleFiles(files) {
    for(let f of files) {
        const fileType = getFileType(f.name);
        if (fileType === 'image' || fileType === 'pdf') {
            await addFileToCurrentFolder(f);
        } else {
            showToast('Skipped: ' + f.name + ' (not supported)', true);
        }
    }
    render();
}

document.addEventListener('DOMContentLoaded', async ()=>{
    const themeBtn = document.getElementById('themeToggle');
    if(themeBtn) themeBtn.onclick = toggleTheme;
    const _theme = localStorage.getItem('docman_theme') || localStorage.getItem('oarcel_theme');
    if(_theme === 'light-mode') document.body.classList.add('light-mode');
    updateThemeIcon();
    document.getElementById('pdfTabBtn').onclick = ()=>setActiveTab('pdfs');
    document.getElementById('notesTabBtn').onclick = ()=>setActiveTab('notes');
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImageViewer();
        }
    });
    
    const closeBtn = document.getElementById('closeImageViewer');
    if(closeBtn) closeBtn.onclick = closeImageViewer;
    
    const viewer = document.getElementById('imageViewer');
    if(viewer) {
        viewer.addEventListener('click', (e) => {
            if (e.target === viewer) closeImageViewer();
        });
    }

    const closePdfBtn = document.getElementById('closePdfViewer');
    if(closePdfBtn) closePdfBtn.onclick = closePdfViewer;
    
    document.getElementById('fileInput').addEventListener('change', async (e)=>{
        await handleFiles(Array.from(e.target.files));
        e.target.value = '';
    });
    document.getElementById('newNoteBtn').onclick = triggerNewNote;
    document.getElementById('searchInput').addEventListener('input', ()=>render());
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('homeBtn').addEventListener('click', goHome);
    document.getElementById('uploadBtn').addEventListener('click', triggerUpload);
    initSettingsPage();
    await initDB();
    await loadFromIndexedDB();
    attachPressEffects();

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

});

function showInfo() {

    const deptCount = Object.keys(fileSystem).length;
    let folderCount = 0, fileCount = 0, noteCount = 0;
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

/* ============================================
   SETTINGS PAGE
   ============================================ */
const SETTINGS_KEY = 'docman_settings_v1';
const RECENTS_KEY = 'docman_recents_v1';
const SEARCH_HISTORY_KEY = 'docman_search_history_v1';
const PIN_KEY = 'docman_pin_v1';

const defaultSettings = {
    reduceMotion: false,
    compactCards: false,
    pdfZoom: 100,
    pdfHighQuality: true,
    pdfRememberPage: true,
    trackRecents: true,
    searchNoteContent: true,
    searchGlobal: true,
    appLock: false,
    hidePreviews: false
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

function loadRecents() {
    try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; }
    catch (e) { return []; }
}
function saveRecents(list) {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 20)));
}
function trackRecentFile(fileName) {
    if (!docmanSettings.trackRecents) return;
    let list = loadRecents();
    list = list.filter(r => r.name !== fileName);
    list.unshift({ name: fileName, time: Date.now() });
    saveRecents(list);
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
function showSettingsScreen(screenId) {
    document.querySelectorAll('.settings-screen').forEach(s => s.classList.remove('settings-screen-active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('settings-screen-active');
    const inner = document.querySelector('.settings-page-inner');
    if (inner) inner.scrollTop = 0;
}

function refreshSettingsListSubtitles() {
    const deptCount = Object.keys(fileSystem).length;
    const deptSub = document.getElementById('settingsDeptSub');
    if (deptSub) deptSub.textContent = `${deptCount} department${deptCount === 1 ? '' : 's'}`;
    updateStorageSummary();
}

async function updateStorageSummary() {
    const sub = document.getElementById('settingsStorageSub');
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            const usedMB = (est.usage / (1024 * 1024)).toFixed(1);
            if (sub) sub.textContent = `${usedMB} MB used`;
        } else if (sub) sub.textContent = 'Tap to view';
    } catch (e) { if (sub) sub.textContent = 'Tap to view'; }
}

async function renderStoragePanel() {
    let fileBytes = 0, noteBytes = 0;
    for (const path in allFiles) (allFiles[path] || []).forEach(f => { fileBytes += (f.dataUrl ? f.dataUrl.length * 0.75 : 0); });
    for (const path in allNotes) (allNotes[path] || []).forEach(n => { noteBytes += ((n.title || '').length + (n.content || '').length) * 2; });
    const totalBytes = fileBytes + noteBytes;

    let usage = totalBytes, quota = null;
    try {
        if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            usage = est.usage || totalBytes;
            quota = est.quota || null;
        }
    } catch (e) {}

    const fmtMB = (b) => (b / (1024 * 1024)).toFixed(2) + ' MB';
    document.getElementById('storageUsedVal').textContent = fmtMB(usage);
    document.getElementById('storageQuotaVal').textContent = quota ? fmtMB(quota) : 'device storage';
    const pct = quota ? Math.min(100, Math.round((usage / quota) * 100)) : Math.min(100, Math.round((usage / (200 * 1024 * 1024)) * 100));
    document.getElementById('storageUsedPct').textContent = pct + '%';
    document.getElementById('storageAvailVal').textContent = quota ? `${fmtMB(quota - usage)} available` : '';

    const ring = document.getElementById('storageRingFg');
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference - (circumference * pct / 100);

    const breakdown = document.getElementById('storageBreakdown');
    const rows = [
        { label: 'Files (PDFs & Images)', val: fileBytes, color: '#3b82f6' },
        { label: 'Notes', val: noteBytes, color: '#fbbf24' }
    ];
    const maxVal = Math.max(1, ...rows.map(r => r.val));
    breakdown.innerHTML = rows.map(r => `
        <div class="storage-breakdown-row">
            <div class="storage-breakdown-dot" style="background:${r.color}"></div>
            <div class="storage-breakdown-label">${r.label}</div>
            <div class="storage-breakdown-val">${fmtMB(r.val)}</div>
        </div>
    `).join('');
}

function exportBackupData() {
    const backup = { fileSystem, allFiles, allNotes, deptColors, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `docman-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported');
}

function clearAllAppData() {
    showConfirmModal('This will permanently delete <b>all files, notes and departments</b>. This cannot be undone. Continue?', async (confirmed) => {
        if (!confirmed) return;
        fileSystem = {}; allFiles = {}; allNotes = {}; deptColors = {};
        await saveFolderStructure();
        const tx = db.transaction(['files', 'notes'], 'readwrite');
        tx.objectStore('files').clear();
        tx.objectStore('notes').clear();
        tx.commit();
        currentPath = [];
        closeSettingsPage();
        render();
        showToast('All data erased');
    });
}

function applyThemePickUI() {
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('themePickDark')?.classList.toggle('active', !isLight);
    document.getElementById('themePickLight')?.classList.toggle('active', isLight);
}

function applyReduceMotion() {
    document.body.classList.toggle('reduce-motion', docmanSettings.reduceMotion);
}
function applyCompactCards() {
    document.body.classList.toggle('compact-cards', docmanSettings.compactCards);
}

function renderFavoritesPanel() {
    const list = loadRecents();
    document.getElementById('recentsCount').textContent = list.length;
    const card = document.getElementById('recentsListCard');
    if (!list.length) { card.innerHTML = '<div class="settings-empty-row">No recent files yet</div>'; return; }
    card.innerHTML = list.slice(0, 10).map(r => `
        <div class="dept-manage-row">
            <div class="settings-item-icon settings-icon-favorites" style="width:32px;height:32px;font-size:0.8rem;"><i class="fas fa-file"></i></div>
            <div class="dept-manage-name" style="font-weight:600;font-size:0.82rem;">${escapeHtml(r.name)}</div>
            <span class="dept-manage-count">${new Date(r.time).toLocaleDateString()}</span>
        </div>
    `).join('');
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
                if (currentPath[0] === dept) { currentPath = []; }
                render();
                showToast(`Department "${dept}" deleted`);
            });
        };
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

function promptSetPin(callback) {
    showPromptModal('Set a 4-digit PIN:', '', (val) => {
        if (val === null) { callback(false); return; }
        const pin = val.trim();
        if (!/^\d{4}$/.test(pin)) { showToast('PIN must be exactly 4 digits', true); callback(false); return; }
        localStorage.setItem(PIN_KEY, pin);
        showToast('PIN saved');
        callback(true);
    });
}

async function renderAboutPanel() {
    const deptCount = Object.keys(fileSystem).length;
    let folderCount = 0, fileCount = 0, noteCount = 0;
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
    document.getElementById('aboutStatDepts').textContent = deptCount;
    document.getElementById('aboutStatFolders').textContent = folderCount;
    document.getElementById('aboutStatFiles').textContent = fileCount;
    document.getElementById('aboutStatNotes').textContent = noteCount;
}

const settingsPanelRenderers = {
    storage: renderStoragePanel,
    appearance: applyThemePickUI,
    favorites: renderFavoritesPanel,
    departments: renderDepartmentsManagePanel,
    security: updatePinStatusUI,
    about: renderAboutPanel
};

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
        document.body.classList.remove('light-mode');
        localStorage.setItem('docman_theme', '');
        updateThemeIcon(); applyThemePickUI();
    };
    document.getElementById('themePickLight').onclick = () => {
        document.body.classList.add('light-mode');
        localStorage.setItem('docman_theme', 'light-mode');
        updateThemeIcon(); applyThemePickUI();
    };
    const reduceMotionToggle = document.getElementById('reduceMotionToggle');
    reduceMotionToggle.checked = docmanSettings.reduceMotion;
    reduceMotionToggle.onchange = () => { docmanSettings.reduceMotion = reduceMotionToggle.checked; saveSettings(); applyReduceMotion(); };
    const compactCardsToggle = document.getElementById('compactCardsToggle');
    compactCardsToggle.checked = docmanSettings.compactCards;
    compactCardsToggle.onchange = () => { docmanSettings.compactCards = compactCardsToggle.checked; saveSettings(); applyCompactCards(); };
    applyReduceMotion(); applyCompactCards();

    // PDF Settings
    const zoomSlider = document.getElementById('pdfZoomSlider');
    const zoomLabel = document.getElementById('pdfZoomValueLabel');
    zoomSlider.value = docmanSettings.pdfZoom;
    zoomLabel.textContent = docmanSettings.pdfZoom + '%';
    zoomSlider.oninput = () => {
        zoomLabel.textContent = zoomSlider.value + '%';
        docmanSettings.pdfZoom = parseInt(zoomSlider.value, 10);
        if (typeof pdfScale !== 'undefined') pdfScale = docmanSettings.pdfZoom / 100;
        saveSettings();
    };
    const hqToggle = document.getElementById('pdfHighQualityToggle');
    hqToggle.checked = docmanSettings.pdfHighQuality;
    hqToggle.onchange = () => { docmanSettings.pdfHighQuality = hqToggle.checked; saveSettings(); };
    const rememberPageToggle = document.getElementById('pdfRememberPageToggle');
    rememberPageToggle.checked = docmanSettings.pdfRememberPage;
    rememberPageToggle.onchange = () => { docmanSettings.pdfRememberPage = rememberPageToggle.checked; saveSettings(); };

    // Favorites & Recents
    const trackRecentsToggle = document.getElementById('trackRecentsToggle');
    trackRecentsToggle.checked = docmanSettings.trackRecents;
    trackRecentsToggle.onchange = () => { docmanSettings.trackRecents = trackRecentsToggle.checked; saveSettings(); };
    document.getElementById('clearRecentsBtn').onclick = () => {
        showConfirmModal('Clear your recently opened files history?', (ok) => {
            if (!ok) return;
            saveRecents([]);
            renderFavoritesPanel();
            showToast('Recents cleared');
        });
    };

    // Search
    const noteContentToggle = document.getElementById('searchNoteContentToggle');
    noteContentToggle.checked = docmanSettings.searchNoteContent;
    noteContentToggle.onchange = () => { docmanSettings.searchNoteContent = noteContentToggle.checked; saveSettings(); };
    const globalToggle = document.getElementById('searchGlobalToggle');
    globalToggle.checked = docmanSettings.searchGlobal;
    globalToggle.onchange = () => { docmanSettings.searchGlobal = globalToggle.checked; saveSettings(); };
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
                if (success) { docmanSettings.appLock = true; saveSettings(); }
                else { appLockToggle.checked = false; }
                updatePinStatusUI();
            });
        } else {
            docmanSettings.appLock = appLockToggle.checked;
            saveSettings();
            updatePinStatusUI();
        }
    };
    document.getElementById('changePinBtn').onclick = () => promptSetPin(() => {});
    const hidePreviewsToggle = document.getElementById('hidePreviewsToggle');
    hidePreviewsToggle.checked = docmanSettings.hidePreviews;
    hidePreviewsToggle.onchange = () => { docmanSettings.hidePreviews = hidePreviewsToggle.checked; saveSettings(); };

    // Data management
    document.getElementById('exportDataBtn').onclick = exportBackupData;
    document.getElementById('clearAllDataBtn').onclick = clearAllAppData;

    if (typeof pdfScale !== 'undefined') pdfScale = docmanSettings.pdfZoom / 100;
}
