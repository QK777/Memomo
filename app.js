
// --- Rich text helpers (apply styles to selected text inside a note) ---
function selectionInside(el){
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const common = range.commonAncestorContainer;
  const node = (common.nodeType === 1) ? common : common.parentElement;
  if (!node) return null;
  if (!el.contains(node)) return null;
  return { sel, range };
}
function wrapSelectionWithSpan(range, styles){
  const frag = range.extractContents();
  const span = document.createElement("span");
  Object.entries(styles).forEach(([k,v]) => (span.style[k] = v));
  span.appendChild(frag);
  range.insertNode(span);
  const sel = window.getSelection();
  if (sel){
    sel.removeAllRanges();
    const r = document.createRange();
    r.setStartAfter(span);
    r.collapse(true);
    sel.addRange(r);
  }
}

// --- Color helper ---
// Sticky note styling uses RGBA backgrounds; keep this in the main scope.
function hexToRgba(hex, a){
  let h = String(hex || "#ffffff").trim();
  if (h.startsWith("rgba") || h.startsWith("rgb")) return h; // already rgb/rgba
  h = h.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map(ch => ch + ch).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const rr = Number.isFinite(r) ? r : 255;
  const gg = Number.isFinite(g) ? g : 255;
  const bb = Number.isFinite(b) ? b : 255;
  const aa = (a === 0) ? 0 : (Number.isFinite(Number(a)) ? Number(a) : 1);
  return `rgba(${rr},${gg},${bb},${aa})`;
}
/* =========================
   Selection helpers (v6.20)
   - select/btn UI steals focus -> keep last selection per editor
========================= */
const _lastSelByEditor = new WeakMap();

function saveSelectionFor(editor){
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0);
  if (!editor.contains(r.commonAncestorContainer)) return;
  _lastSelByEditor.set(editor, r.cloneRange());
}

function restoreSelectionFor(editor){
  const r = _lastSelByEditor.get(editor);
  if (!r) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(r);
  editor.focus({ preventScroll:true });
  return true;
}

function execFontSizePx(editor, px){
  if (!restoreSelectionFor(editor)) editor.focus({preventScroll:true});
  document.execCommand("styleWithCSS", true);

  // execCommand fontSize uses 1-7; use 7 then replace <font> tags.
  document.execCommand("fontSize", false, "7");

  const fonts = editor.querySelectorAll('font[size="7"]');
  fonts.forEach(f => {
    const span = document.createElement("span");
    span.style.fontSize = String(px) + "px";
    // preserve existing bold/italic etc inside
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
  });

  // Update saved selection after DOM surgery
  saveSelectionFor(editor);
}

function execToggleBold(editor){
  if (!restoreSelectionFor(editor)) editor.focus({preventScroll:true});
  document.execCommand("styleWithCSS", true);
  document.execCommand("bold", false, null);
  saveSelectionFor(editor);
}

function applyFontSizeToSelection(editor, px){
  const info = selectionInside(editor);
  if (!info) return;
  const { range } = info;
  // No selection: set style for next typing by inserting a zero-width span
  if (range.collapsed){
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    span.appendChild(document.createTextNode("\u200B"));
    range.insertNode(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.setStart(span.firstChild, 1);
    r.collapse(true);
    sel.addRange(r);
    return;
  }
  wrapSelectionWithSpan(range, { fontSize: `${px}px` });
}
function applyBoldToSelection(editor){
  const info = selectionInside(editor);
  if (!info) return;
  const { range } = info;
  if (range.collapsed){
    const span = document.createElement("span");
    span.style.fontWeight = "700";
    span.appendChild(document.createTextNode("\u200B"));
    range.insertNode(span);
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.setStart(span.firstChild, 1);
    r.collapse(true);
    sel.addRange(r);
    return;
  }
  wrapSelectionWithSpan(range, { fontWeight: "700" });
}

// app.js
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const stage = $("#stage");
  const frame = $("#frame");
  const img = $("#img");
  const notesLayer = $("#notesLayer");
  const thumbs = $("#thumbs");

  // Note settings panel (top-right on image)
  const notePanel = $("#notePanel");
  const npBg = $("#npBg");
  const npFg = $("#npFg");
  const npAlpha = $("#npAlpha");
  const npFs = $("#npFs");
  const npFsVal = $("#npFsVal");
  const npBold = $("#npBold");
  const npDelete = $("#npDelete");
  const npClear = $("#npClear");

  // Shared helper: whether a drag/drop contains files
  function hasFiles(dt){
    try{
      if (!dt) return false;
      const types = Array.from(dt.types || []);
      return types.includes("Files") || (dt.files && dt.files.length > 0);
    }catch(_){ return false; }
  }

  

// File drop targets (stage / thumbnails)
const dropFilesHere = (e) => {
  if (!hasFiles(e.dataTransfer)) return;
  e.preventDefault();
  e.stopPropagation();
  const files = e.dataTransfer?.files;
  if (files && files.length) addFiles(files);
};
stage.addEventListener("dragover", (e)=>{ if(hasFiles(e.dataTransfer)){ e.preventDefault(); e.stopPropagation(); } }, {capture:true});
stage.addEventListener("drop", dropFilesHere, {capture:true});
thumbs.addEventListener("dragover", (e)=>{ if(hasFiles(e.dataTransfer)){ e.preventDefault(); e.stopPropagation(); } }, {capture:true});
thumbs.addEventListener("drop", dropFilesHere, {capture:true});
const btnAddImages = $("#btnAddImages");
  const btnSaveDoc = $("#btnSaveDoc");
  const btnLoadDoc = $("#btnLoadDoc");
  const btnPrint = $("#btnPrint");
  const btnDeleteAllImages = $("#btnDeleteAllImages");
  const btnToggleMode = $("#btnToggleMode");
  const btnPrev = $("#btnPrev");
  const btnNext = $("#btnNext");
  const btnAddNote = $("#btnAddNote");
  const pageInfo = $("#pageInfo");
  const pageMemo = null; // removed page memo
const fileInput = $("#fileInput");
  const fileDocInput = $("#fileDocInput");

  img?.setAttribute("draggable", "false");
  img?.addEventListener("dragstart", (e) => e.preventDefault());

  // When the image size changes (load / window resize), re-render notes so they stay aligned.
  img?.addEventListener("load", () => {
    const p = currentPage();
    if (p) migrateNotesIfNeeded(p);
    renderNotes();
  });

  let _resizeT = null;
  window.addEventListener("resize", () => {
    if (_resizeT) clearTimeout(_resizeT);
    _resizeT = setTimeout(() => renderNotes(), 60);
  });

  // --- state ---
  let pages = []; // {id, name, mime, blob, url, memoHtml, notes:[]}
  let index = 0;
  let mode = "edit"; // edit | view

  // View mode: allow moving sticky notes without enabling editing (OFF by default)
  let viewMoveEnabled = false;
  let viewFabEl = null;
  let btnViewMove = null;
  let btnExitView = null;

  // --- active note selection (for Note Panel) ---
  let activeNoteId = null;

  function getNoteHeadPx(){
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--noteHeadH").trim();
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 36;
  }

  function getActiveNote(){
    const p = currentPage();
    if (!p || !Array.isArray(p.notes)) return null;
    return p.notes.find(x => x.id === activeNoteId) || null;
  }

  function getNoteEl(id){
    if (!id) return null;
    return notesLayer.querySelector(`.note[data-id="${id}"]`);
  }

  function applyNoteStyle(el, n){
    if (!el || !n) return;
    el.style.background = hexToRgba(n.bg || "#ffffff", n.alpha ?? 0.85);
    el.style.color = n.fg || "#000000";
    el.style.fontSize = String(n.fs ?? 16) + "px";
    el.style.fontWeight = (n.bold ? "700" : "400");
  }

  function setActiveNote(id){
    const prev = activeNoteId;
    activeNoteId = id || null;
    if (prev && prev !== activeNoteId) getNoteEl(prev)?.classList.remove("active");
    if (activeNoteId) getNoteEl(activeNoteId)?.classList.add("active");
    updateNotePanel();
  }

  function updateNotePanel(){
    if (!notePanel) return;
    const n = getActiveNote();
    const isView = (mode === "view");
    if (!n || isView){
      notePanel.classList.remove("show");
      notePanel.setAttribute("aria-hidden", "true");
      return;
    }
    notePanel.classList.add("show");
    notePanel.setAttribute("aria-hidden", "false");
    if (npBg) npBg.value = n.bg || "#ffffff";
    if (npFg) npFg.value = n.fg || "#000000";
    if (npAlpha) npAlpha.value = String(n.alpha ?? 0.85);
    if (npFs) npFs.value = String(n.fs ?? 16);
    if (npFsVal) npFsVal.textContent = String(n.fs ?? 16);
    if (npBold){
      npBold.classList.toggle("on", !!n.bold);
      npBold.setAttribute("aria-pressed", n.bold ? "true" : "false");
    }
  }

  // --- IndexedDB ---
  const DB_NAME = "memomo_db";
  const DB_VER = 2;
  const STORE = "docs";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbSet(key, val) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbDel(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbClear() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- helpers ---
  const uid = () => crypto.randomUUID();

  function setMode(next) {
    mode = next;
    setActiveNote(null);
    document.body.classList.toggle("mode-view", mode === "view");
    document.body.classList.toggle("mode-edit", mode !== "view");
    btnToggleMode.textContent = mode === "view" ? "設定モード" : "閲覧モード";
    if (mode === "view") {
      // prevent accidental editing
      if (pageMemo) pageMemo?.setAttribute("contenteditable", "false");
    } else {
      if (pageMemo) pageMemo?.setAttribute("contenteditable", "true");
    }
    // View mode conveniences
    if (mode === 'view') viewMoveEnabled = false;
    ensureViewFab();
    updateViewFab();
    try{ frame.style.touchAction = (mode === 'view') ? 'none' : ''; }catch(_){ }

    renderNotes();

    // ページメモ機能は削除
  }

  function isViewMode() { return mode === "view"; }

  function showPageWrap(i){
    if (!pages.length){ showPage(0); return; }
    const len = pages.length;
    const ni = ((i % len) + len) % len;
    showPage(ni);
  }
  function goNext(){ showPageWrap(index + 1); }
  function goPrev(){ showPageWrap(index - 1); }

  function ensureViewFab(){
    if (viewFabEl) return;
    viewFabEl = document.createElement('div');
    viewFabEl.id = 'viewFab';
    viewFabEl.setAttribute('aria-hidden','true');

    btnViewMove = document.createElement('button');
    btnViewMove.type = 'button';
    btnViewMove.className = 'btn view-fab-btn';
    btnViewMove.textContent = '付箋移動: OFF';
    btnViewMove.setAttribute('aria-pressed','false');
    btnViewMove.addEventListener('click', (e) => {
      e.preventDefault();
      viewMoveEnabled = !viewMoveEnabled;
      updateViewFab();
      renderNotes();
    });

    btnExitView = document.createElement('button');
    btnExitView.type = 'button';
    btnExitView.className = 'btn ghost view-fab-btn';
    btnExitView.textContent = '設定モードへ';
    btnExitView.addEventListener('click', (e) => {
      e.preventDefault();
      setMode('edit');
    });

    viewFabEl.appendChild(btnViewMove);
    viewFabEl.appendChild(btnExitView);
    document.body.appendChild(viewFabEl);
    updateViewFab();
  }

  function updateViewFab(){
    if (!viewFabEl) return;
    const show = isViewMode();
    viewFabEl.style.display = show ? 'flex' : 'none';
    viewFabEl.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (btnViewMove){
      btnViewMove.textContent = viewMoveEnabled ? '付箋移動: ON' : '付箋移動: OFF';
      btnViewMove.classList.toggle('on', !!viewMoveEnabled);
      btnViewMove.setAttribute('aria-pressed', viewMoveEnabled ? 'true' : 'false');
    }
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function currentPage() { return pages[index] || null; }

  function updatePageInfo() {
    pageInfo.textContent = `${pages.length ? (index + 1) : 0} / ${pages.length}`;
  }

  function revokeUrls() {
    for (const p of pages) {
      if (p.url) URL.revokeObjectURL(p.url);
      p.url = null;
    }
  }

  // --- page rendering ---
  function showPage(i) {
    if (!pages.length) {
      img.src = "";
      if (pageMemo) pageMemo.innerHTML = "";
      notesLayer.innerHTML = "";
      updatePageInfo();
      renderThumbs();
      return;
    }
    index = clamp(i, 0, pages.length - 1);
    const p = pages[index];
    if (!p.url && p.blob) p.url = URL.createObjectURL(p.blob);
    img.src = p.url || "";
    if (pageMemo) pageMemo.innerHTML = p.memoHtml || "";
    updatePageInfo();
    renderThumbs();
    renderNotes();
    saveMetaSoon();
  }

  function renderThumbs() {
    thumbs.innerHTML = "";
    pages.forEach((p, i) => {
      const item = document.createElement("div");
      item.className = "thumb" + (i === index ? " active" : "");
      item.dataset.id = p.id;

      const timg = document.createElement("div");
      timg.className = "timg";
      const im = document.createElement("img");
      im.draggable = false;
      im.setAttribute("draggable","false");
      im.addEventListener("dragstart", (e) => e.preventDefault());
      if (!p.url && p.blob) p.url = URL.createObjectURL(p.blob);
      im.src = p.url || "";
      timg.appendChild(im);

      const meta = document.createElement("div");
      meta.className = "tmeta";
      const name = document.createElement("div");
      name.className = "tname";
      name.textContent = p.name || `Image ${i + 1}`;
      const sub = document.createElement("div");
      sub.className = "tsub";
      sub.textContent = `${p.notes?.length || 0} 付箋 / ${stripHtml(p.memoHtml || "").slice(0, 30)}`;
      meta.appendChild(name);
      meta.appendChild(sub);

      const del = document.createElement("div");
      del.className = "thumb-del";
      del.textContent = "×";
      del.title = "削除";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteOne(p.id);
      });

      item.appendChild(timg);
      item.appendChild(meta);
      item.appendChild(del);
      thumbs.appendChild(item);
    });
  }

  function stripHtml(s) {
    const div = document.createElement("div");
    div.innerHTML = s;
    return div.textContent || "";
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  // --- printing (prints what you see in view mode) ---
  let _printPrevMode = null;
  function buildPrintRoot(){
    const p = currentPage();
    if (!p || !img || !img.src) return;
    migrateNotesIfNeeded(p);

    const old = document.getElementById("printRoot");
    if (old) old.remove();

    const root = document.createElement("div");
    root.id = "printRoot";
    root.className = "print-root";

    const stage = document.createElement("div");
    stage.className = "print-stage";

    const im = document.createElement("img");
    im.className = "print-img";
    im.src = img.src;
    im.alt = p.name || "";

    const layer = document.createElement("div");
    layer.className = "print-notes";

    // notes are normalized to the displayed image rect (0..1). Use % so it scales with the print image.
    for (const n of (p.notes || [])){
      const el = document.createElement("div");
      el.className = "print-note";
      el.style.left = (n.nx * 100) + "%";
      el.style.top = (n.ny * 100) + "%";
      el.style.width = (n.nw * 100) + "%";
      el.style.height = (n.nh * 100) + "%";
      el.style.zIndex = String(n.z || 20);
      el.style.background = hexToRgba(n.bg || "#ffffff", Number(n.alpha ?? 1));
      el.style.color = n.fg || "#000000";

      const body = document.createElement("div");
      body.className = "print-note-body";
      if (typeof n.html === "string" && n.html.trim() !== ""){
        body.innerHTML = n.html;
      } else {
        body.innerHTML = escapeHtml(n.text || "").replace(/\n/g,"<br>");
      }
      el.appendChild(body);
      layer.appendChild(el);
    }

    stage.appendChild(im);
    stage.appendChild(layer);
    root.appendChild(stage);
    document.body.appendChild(root);
  }

  function clearPrintRoot(){
    const root = document.getElementById("printRoot");
    if (root) root.remove();
  }

  function canUseImageBox(){
    return !!(img && img.naturalWidth > 0 && img.clientWidth > 0 && img.clientHeight > 0);
  }

  // --- notes coordinate system (normalized to the *displayed image rect*) ---
  // This keeps notes fixed relative to the image even when the window resizes.
  function getImgBox() {
    const fw = frame.clientWidth || 1;
    const fh = frame.clientHeight || 1;
    if (!canUseImageBox()) return { x: 0, y: 0, w: fw, h: fh };

    const fr = frame.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    // Clamp to frame just in case
    const x = clamp(ir.left - fr.left, 0, fw);
    const y = clamp(ir.top - fr.top, 0, fh);
    const w = clamp(ir.width, 1, fw);
    const h = clamp(ir.height, 1, fh);
    return { x, y, w, h };
  }

  // Migrate old notes (normalized to frame) to new coords (normalized to displayed image rect)
  function migrateNotesIfNeeded(p){
    if (!p || !Array.isArray(p.notes) || p.notes.length === 0) return;
    if (!canUseImageBox()) return;
    const b = getImgBox();
    const fw = frame.clientWidth || 1;
    const fh = frame.clientHeight || 1;
    let changed = false;
    for (const n of p.notes){
      if (n.v === 2) continue;
      // assume old coords were frame-normalized
      const old = {
        x: (n.nx ?? 0) * fw,
        y: (n.ny ?? 0) * fh,
        w: (n.nw ?? 0.3) * fw,
        h: (n.nh ?? 0.3) * fh
      };
      const nn = {
        nx: (old.x - b.x) / b.w,
        ny: (old.y - b.y) / b.h,
        nw: old.w / b.w,
        nh: old.h / b.h
      };
      n.nx = clamp(nn.nx, 0, 1);
      n.ny = clamp(nn.ny, 0, 1);
      n.nw = clamp(nn.nw, 0.05, 1);
      n.nh = clamp(nn.nh, 0.05, 1);
      n.v = 2;
      changed = true;
    }
    if (changed) saveNotesSoon();
  }

  function noteToPx(n) {
    const b = getImgBox();
    return {
      x: b.x + (n.nx * b.w),
      y: b.y + (n.ny * b.h),
      w: n.nw * b.w,
      h: n.nh * b.h
    };
  }
  function pxToNoteNorm(px) {
    const b = getImgBox();
    return {
      nx: (px.x - b.x) / b.w,
      ny: (px.y - b.y) / b.h,
      nw: px.w / b.w,
      nh: px.h / b.h
    };
  }

  function bringNoteFront(id) {
    const p = currentPage();
    if (!p) return;
    const n = p.notes?.find(x => x.id === id);
    if (!n) return;
    const maxZ = Math.max(10, ...(p.notes || []).map(x => x.z || 10));
    n.z = maxZ + 1;
    const el = notesLayer.querySelector(`.note[data-id="${id}"]`);
    if (el) el.style.zIndex = String(n.z);
    saveNotesSoon();
  }

  function trackPointer(downEvent, onMove, onUp){
    const pid = downEvent.pointerId;
    function move(ev){
      if (ev.pointerId !== pid) return;
      ev.preventDefault();
      onMove(ev);
    }
    function up(ev){
      if (ev.pointerId !== pid) return;
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      onUp(ev);
    }
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
  }


  function renderNotes() {
    notesLayer.innerHTML = "";
    const p = currentPage();
    if (!p) return;
    p.notes = p.notes || [];

    const headPx = getNoteHeadPx();

    for (const n of p.notes) {
      // defaults (backward compatible)
      if (n.bg == null) n.bg = "#ffffff";
      if (n.fg == null) n.fg = "#000000";
      if (n.alpha == null) n.alpha = 0.85;
      if (n.fs == null) n.fs = 16;
      if (n.bold == null) n.bold = false;

      const px = noteToPx(n);

      const el = document.createElement("div");
      el.className = "note";
      el.dataset.id = n.id;
      el.style.left = px.x + "px";
      el.style.width = px.w + "px";
      el.style.zIndex = String(n.z || 10);

      if (isViewMode()) {
        // Hide header visually, but keep text position stable by shifting the whole note down
        // and shrinking height by header size.
        el.style.top = (px.y + headPx) + "px";
        el.style.height = Math.max(24, px.h - headPx) + "px";
      } else {
        el.style.top = px.y + "px";
        el.style.height = px.h + "px";
      }

      applyNoteStyle(el, n);
      if (n.id === activeNoteId) el.classList.add("active");

      /* view-move */
      if (isViewMode()) {
        el.addEventListener("pointerdown", (e) => {
          if (!viewMoveEnabled) return;
          // allow touch + left click
          if (e.pointerType !== "touch" && e.button !== 0) return;
          // don't hijack if user taps on the panel
          if (e.target?.closest?.("#notePanel")) return;
          e.preventDefault();
          e.stopPropagation();
          setActiveNote(n.id);
          bringNoteFront(n.id);

          const startLeft = parseFloat(el.style.left) || px.x;
          const startTopDisp = parseFloat(el.style.top) || (px.y + headPx);
          const start = { x: e.clientX, y: e.clientY, left: startLeft, top: startTopDisp };

          trackPointer(e, (ev) => {
            const nx = start.left + (ev.clientX - start.x);
            const ny = start.top + (ev.clientY - start.y);
            el.style.left = nx + "px";
            el.style.top = ny + "px";
          }, () => {
            const finalPx = {
              x: parseFloat(el.style.left) || 0,
              // stored note y is the original top (including hidden header)
              y: (parseFloat(el.style.top) || 0) - headPx,
              w: parseFloat(el.style.width) || px.w,
              // stored height includes hidden header too
              h: (parseFloat(el.style.height) || 0) + headPx
            };
            const norm = pxToNoteNorm(finalPx);
            n.nx = clamp(norm.nx, 0, 1);
            n.ny = clamp(norm.ny, 0, 1);
            n.nw = clamp(norm.nw, 0.05, 1);
            n.nh = clamp(norm.nh, 0.05, 1);
            saveNotesSoon();
          });
        }, { capture:true });
      }

      // header (edit only)
      if (!isViewMode()) {
        const top = document.createElement("div");
        top.className = "note-top";

        const title = document.createElement("div");
        title.className = "note-title";
        title.textContent = "付箋";

        const xbtn = document.createElement("button");
        xbtn.className = "note-x";
        xbtn.type = "button";
        xbtn.textContent = "×";
        xbtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteNote(n.id);
        });

        top.appendChild(title);
        top.appendChild(xbtn);

        // drag from header
        top.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          if (e.target.closest(".note-x")) return;
          e.preventDefault();
          setActiveNote(n.id);
          bringNoteFront(n.id);

          const startLeft = parseFloat(el.style.left) || px.x;
          const startTop = parseFloat(el.style.top) || px.y;
          const start = { x: e.clientX, y: e.clientY, left: startLeft, top: startTop };

          trackPointer(e, (ev) => {
            const nx = start.left + (ev.clientX - start.x);
            const ny = start.top + (ev.clientY - start.y);
            el.style.left = nx + "px";
            el.style.top = ny + "px";
          }, () => {
            const finalPx = {
              x: parseFloat(el.style.left) || 0,
              y: parseFloat(el.style.top) || 0,
              w: parseFloat(el.style.width) || px.w,
              h: parseFloat(el.style.height) || px.h
            };
            const norm = pxToNoteNorm(finalPx);
            n.nx = clamp(norm.nx, 0, 1);
            n.ny = clamp(norm.ny, 0, 1);
            n.nw = clamp(norm.nw, 0.05, 1);
            n.nh = clamp(norm.nh, 0.05, 1);
            saveNotesSoon();
          });
        });

        el.appendChild(top);
      }

      // body
      const body = document.createElement("div");
      body.className = "note-body";

      const editor = document.createElement("div");
      editor.className = "note-editor";
      editor.setAttribute("contenteditable", isViewMode() ? "false" : "true");
      editor.innerHTML = n.html || "";

      editor.addEventListener("focus", () => setActiveNote(n.id));
      editor.addEventListener("pointerdown", () => setActiveNote(n.id), { passive: true });
      editor.addEventListener("input", () => {
        n.html = editor.innerHTML;
        saveNotesSoon();
      });

      body.appendChild(editor);
      el.appendChild(body);

      // resizer (edit only)
      if (!isViewMode()) {
        const resizer = document.createElement("div");
        resizer.className = "resizer";
        resizer.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          setActiveNote(n.id);
          bringNoteFront(n.id);

          const startW = parseFloat(el.style.width) || px.w;
          const startH = parseFloat(el.style.height) || px.h;
          const start = { x: e.clientX, y: e.clientY, w: startW, h: startH };

          trackPointer(e, (ev) => {
            const nw = Math.max(120, start.w + (ev.clientX - start.x));
            const nh = Math.max(80, start.h + (ev.clientY - start.y));
            el.style.width = nw + "px";
            el.style.height = nh + "px";
          }, () => {
            const finalPx = {
              x: parseFloat(el.style.left) || 0,
              y: parseFloat(el.style.top) || 0,
              w: parseFloat(el.style.width) || px.w,
              h: parseFloat(el.style.height) || px.h
            };
            const norm = pxToNoteNorm(finalPx);
            n.nx = clamp(norm.nx, 0, 1);
            n.ny = clamp(norm.ny, 0, 1);
            n.nw = clamp(norm.nw, 0.05, 1);
            n.nh = clamp(norm.nh, 0.05, 1);
            saveNotesSoon();
          });
        });
        el.appendChild(resizer);
      }

      notesLayer.appendChild(el);
    }

    // Refresh panel visibility/value after a re-render
    updateNotePanel();
  }

  function addNote() {
    // Allow adding notes even when no images are loaded (create a blank page).
    if (!pages.length){
      pages.push({
        id: uid(),
        name: "(blank)",
        mime: "",
        blob: null,
        url: "",
        memoHtml: "",
        notes: []
      });
      index = 0;
      updatePageInfo();
      renderThumbs();
      // showPage will set up the view; it is safe even with empty src.
      showPage(0);
    }

    const p = currentPage();
    if (!p) return;
    p.notes = p.notes || [];
    const n = {
      id: uid(),
      v: 2,
      nx: 0.08,
      ny: 0.10,
      nw: 0.38,
      nh: 0.28,
      text: "",
      html: "",
      bg: "#ffffff",
      fg: "#000000",
      alpha: 0.85,
      fs: 16,
      bold: false,
      z: 20
    };
    p.notes.push(n);
    renderNotes();
    saveNotesSoon();
    setActiveNote(n.id);
    renderThumbs();
  }

  function deleteNote(noteId){
    const p = currentPage();
    if (!p) return;
    p.notes = (p.notes || []).filter(n => n.id !== noteId);
    if (activeNoteId === noteId) setActiveNote(null);
    renderNotes();
    saveNotesSoon();
    renderThumbs();
  }

  // --- meta save (memo, order, notes) ---
  let metaSaveTimer = null;
  function saveMetaSoon(){
    if (metaSaveTimer) clearTimeout(metaSaveTimer);
    metaSaveTimer = setTimeout(saveMeta, 200);
  }
  async function saveMeta(){
    await dbSet("meta", {
      index,
      mode,
      pages: pages.map(p => ({
        id: p.id, name: p.name, mime: p.mime,
        memoHtml: p.memoHtml || "",
        notes: p.notes || []
      }))
    });
  }

  let notesSaveTimer = null;
  function saveNotesSoon(){
    if (notesSaveTimer) clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(saveMeta, 150);
  }

  pageMemo?.addEventListener("input", () => {
    const p = currentPage();
    if (!p) return;
    p.memoHtml = pageMemo.innerHTML;
    saveMetaSoon();
    renderThumbs();
  });

  // --- order ---
  function saveOrder(){ saveMetaSoon(); }

  // --- add images ---
  async function addFiles(fileList){
    const incoming = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith("image/"));
    if (!incoming.length) return;

    for (const f of incoming) {
      const id = uid();
      const blob = f.slice(0, f.size, f.type);
      pages.push({
        id,
        name: f.name,
        mime: f.type,
        blob,
        url: null,
        memoHtml: "",
        notes: []
      });
      await dbSet("img:" + id, blob);
    }
    await saveMeta();
    if (pages.length === incoming.length) showPage(0);
    else showPage(pages.length - incoming.length);
  }

  async function deleteOne(id){
    const i = pages.findIndex(p => p.id === id);
    if (i < 0) return;
    const was = (i === index);
    const p = pages[i];
    if (p.url) URL.revokeObjectURL(p.url);

    pages.splice(i, 1);
    await dbDel("img:" + id);
    await saveMeta();

    if (!pages.length) showPage(0);
    else if (was) showPage(clamp(i, 0, pages.length - 1));
    else showPage(clamp(index, 0, pages.length - 1));
  }

  async function deleteAllImages(){
    if (!confirm("すべての画像とメモを削除します。よろしいですか？")) return;
    revokeUrls();
    pages = [];
    index = 0;
    await dbClear();
    showPage(0);
  }

  // --- doc save/load (file) ---
  async function saveDoc(){
    const meta = await dbGet("meta");
    const pack = meta || { index, mode, pages: [] };

    const images = [];
    for (const p of pages) {
      const blob = await dbGet("img:" + p.id);
      if (!blob) continue;
      const buf = await blob.arrayBuffer();
      images.push({
        id: p.id,
        name: p.name,
        mime: p.mime,
        data: arrayBufferToBase64(buf)
      });
    }
    const doc = { version: 1, pack, images };
    const json = JSON.stringify(doc);

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = "memomo_document.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function arrayBufferToBase64(buf){
    const bytes = new Uint8Array(buf);
    let bin = "";
    const chunk = 0x8000;
    for (let i=0;i<bytes.length;i+=chunk){
      bin += String.fromCharCode(...bytes.slice(i, i+chunk));
    }
    return btoa(bin);
  }

  function base64ToArrayBuffer(b64){
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function loadDocFromFile(file){
    const text = await file.text();
    const doc = JSON.parse(text);

    if (!doc || !doc.pack || !Array.isArray(doc.images)) throw new Error("invalid doc");

    // clear current
    revokeUrls();
    pages = [];
    index = 0;
    await dbClear();

    // restore blobs first
    for (const im of doc.images) {
      const buf = base64ToArrayBuffer(im.data);
      const blob = new Blob([buf], { type: im.mime || "image/png" });
      await dbSet("img:" + im.id, blob);
    }

    // restore pages/meta
    pages = (doc.pack.pages || []).map(p => ({
      id: p.id,
      name: p.name,
      mime: p.mime,
      blob: null,
      url: null,
      memoHtml: p.memoHtml || "",
      notes: p.notes || []
    }));

    // attach blobs
    for (const p of pages) {
      p.blob = await dbGet("img:" + p.id);
    }

    index = clamp(doc.pack.index || 0, 0, Math.max(0, pages.length - 1));
    await dbSet("meta", { index, mode: doc.pack.mode || "edit", pages: doc.pack.pages || [] });
    setMode(doc.pack.mode || "edit");
    showPage(index);
  }

  // --- thumbs reorder (pointer-based ghost + placeholder) ---
  function setupThumbPointerSort(){
    if (thumbs._sorted) return;
    thumbs._sorted = true;

    let dragging = null;
    let placeholder = null;
    let ghost = null;
    let start = null;
    let started = false;
    let moved = false;

    const THRESH = 6;

    function childrenThumbs(){
      return Array.from(thumbs.querySelectorAll(".thumb"));
    }
    function makePlaceholder(height){
      const ph = document.createElement("div");
      ph.className = "thumb placeholder";
      ph.style.height = height + "px";
      return ph;
    }
    function makeGhost(fromEl){
      const r = fromEl.getBoundingClientRect();
      const g = fromEl.cloneNode(true);
      g.classList.add("dragging");
      g.style.position = "fixed";
      g.style.left = r.left + "px";
      g.style.top = r.top + "px";
      g.style.width = r.width + "px";
      g.style.height = r.height + "px";
      g.style.zIndex = "9999";
      g.style.pointerEvents = "none";
      g.style.opacity = "0.95";
      document.body.appendChild(g);
      return { el: g, rect: r };
    }
    function getInsertBefore(clientY){
      const items = childrenThumbs().filter(el => el !== placeholder);
      for (const it of items){
        const r = it.getBoundingClientRect();
        if (clientY < r.top + r.height/2) return it;
      }
      return null;
    }
    function commitOrder(){
      const ids = childrenThumbs().map(el => el.dataset.id);
      const currentId = pages[index]?.id;
      pages = ids.map(id => pages.find(p => p.id === id)).filter(Boolean);
      const ni = pages.findIndex(p => p.id === currentId);
      index = ni >= 0 ? ni : clamp(index, 0, pages.length-1);
      saveOrder();
      renderThumbs();
      showPage(index);
    }

    function beginDrag(thumbEl, clientX, clientY){
      dragging = thumbEl;
      const r = dragging.getBoundingClientRect();
      placeholder = makePlaceholder(r.height);
      thumbs.insertBefore(placeholder, dragging);

      ghost = makeGhost(dragging);
      dragging.remove();

      start = { x: clientX, y: clientY, top: ghost.rect.top };
      started = true;
      moved = false;
    }

    function moveDrag(clientX, clientY){
      if (!started || !ghost) return;
      const dy = clientY - start.y;
      if (Math.abs(dy) > 2) moved = true;
      ghost.el.style.top = (start.top + dy) + "px";

      const before = getInsertBefore(clientY);
      if (before) thumbs.insertBefore(placeholder, before);
      else thumbs.appendChild(placeholder);
    }

    function endDrag(){
      if (!started) return;

      thumbs.insertBefore(dragging, placeholder);
      placeholder.remove();
      placeholder = null;

      if (ghost?.el) ghost.el.remove();
      ghost = null;

      started = false;

      if (!moved){
        const i = pages.findIndex(p => p.id === dragging.dataset.id);
        if (i >= 0) showPage(i);
        dragging = null;
        return;
      }

      commitOrder();
      dragging = null;
    }

    thumbs.addEventListener("pointerdown", (e) => {
      const thumb = e.target.closest(".thumb");
      if (!thumb) return;
      if (e.target.closest(".thumb-del")) return;

      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      let prepared = false;

      trackPointer(e, (ev) => {
        const cx = ev.clientX, cy = ev.clientY;
        const dx = cx - startX, dy = cy - startY;
        if (!prepared && Math.hypot(dx, dy) >= THRESH) prepared = true;
        if (!prepared) return;
        if (!started) beginDrag(thumb, startX, startY);
        moveDrag(cx, cy);
      }, () => {
        if (started) endDrag();
        else {
          const i = pages.findIndex(p => p.id === thumb.dataset.id);
          if (i >= 0) showPage(i);
        }
      });
    }, { passive:false });
  }

  // --- drop helpers ---
  function attachDropTarget(el){
    if (!el) return;
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.add("dragover");
      el.classList.add("dragover");
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    el.addEventListener("dragleave", (e) => {
      if (!stage.contains(e.relatedTarget)) {
        stage.classList.remove("dragover");
      }
      el.classList.remove("dragover");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      stage.classList.remove("dragover");
      el.classList.remove("dragover");
      if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    });
  }

  attachDropTarget(stage);
  attachDropTarget(frame);
  attachDropTarget(notesLayer);
  attachDropTarget(thumbs);
  attachDropTarget(document.querySelector(".sidebar"));

  // --- Global drop overlay (prevents navigation/opening dropped files) ---
  (function installGlobalDropOverlay(){
    const overlay = $("#globalDrop");
    if (!overlay) return;

    let dragDepth = 0;
    const opts = { capture:true, passive:false };

    const hasFiles = (dt) => {
      try{
        if (!dt) return false;
        const types = Array.from(dt.types || []);
        return types.includes("Files");
      }catch(_){ return false; }
    };

    const show = () => overlay.classList.add("show");
    const hide = () => overlay.classList.remove("show");

    
// Prevent default navigation only for file drags/drops (so thumbnail reordering still works)
const preventFiles = (e) => {
  if (!hasFiles(e.dataTransfer)) return;
  e.preventDefault();
  e.stopPropagation();
};
window.addEventListener("dragover", preventFiles, opts);
window.addEventListener("drop", preventFiles, opts);
document.addEventListener("dragover", preventFiles, opts);
document.addEventListener("drop", preventFiles, opts);

// Accept file drop anywhere (stage / thumbs / outside)
window.addEventListener("drop", (e) => {
  if (!hasFiles(e.dataTransfer)) return;
  const files = e.dataTransfer?.files;
  if (files && files.length) addFiles(files);
  dragDepth = 0;
  hide();
}, opts);
window.addEventListener("dragenter", (e) => {
      if (!hasFiles(e.dataTransfer)) return;
      dragDepth++;
      show();
    }, opts);

    window.addEventListener("dragleave", (e) => {
      if (!hasFiles(e.dataTransfer)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) hide();
    }, opts);

    overlay.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    }, opts);

    overlay.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth = 0;
      hide();
      const files = e.dataTransfer?.files;
      if (files && files.length) addFiles(files);
    }, opts);

    overlay.addEventListener("click", () => { dragDepth = 0; hide(); });
  })();

  // Prevent native image dragging that can open images
  document.addEventListener("dragstart", (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG") e.preventDefault();
  }, { capture:true });

  document.addEventListener("contextmenu", (e) => {
    if (e.target?.tagName === "IMG" || e.target?.closest?.(".thumb") || e.target?.closest?.("#stage")) {
      e.preventDefault();
    }
  }, { capture:true });

  // Touch navigation (iPad / mobile) in view mode:
  // - Tap: same as Space (next)
  // - Swipe left/right: same as →/← buttons (next/prev)
  (function setupTouchNav(){
    let pStart = null;
    let tStart = null;
    let suppressClickUntil = 0;

    const isInteractiveTarget = (t) => {
      if (!t) return false;
      return !!(
        t.closest?.('.note') ||
        t.closest?.('#notePanel') ||
        t.closest?.('button') ||
        t.closest?.('input') ||
        t.closest?.('textarea') ||
        t.closest?.('a')
      );
    };

    const handleGesture = (sx, sy, ex, ey, dt) => {
      if (dt > 700) return false;
      const dx = ex - sx;
      const dy = ey - sy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const SW = 40;
      const TAP = 10;

      if (adx > SW && adx > ady * 1.2){
        if (dx < 0) goNext();
        else goPrev();
        return true;
      }
      if (adx < TAP && ady < TAP){
        goNext();
        return true;
      }
      return false;
    };

    // Pointer Events (works on most iPadOS). Allow pen too, but ignore mouse.
    frame.addEventListener('pointerdown', (e) => {
      if (!isViewMode()) return;
      if (e.pointerType === 'mouse') return;
      if (isInteractiveTarget(e.target)) return;
      pStart = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now() };
      try{ e.preventDefault(); }catch(_){ }
    }, { capture:true });

    frame.addEventListener('pointerup', (e) => {
      if (!pStart || e.pointerId !== pStart.id) return;
      const handled = handleGesture(pStart.x, pStart.y, e.clientX, e.clientY, Date.now() - pStart.t);
      pStart = null;
      if (handled) suppressClickUntil = Date.now() + 450;
    }, { capture:true });

    // Touch Events fallback (some iOS builds are flaky with Pointer Events)
    frame.addEventListener('touchstart', (e) => {
      if (!isViewMode()) return;
      if (isInteractiveTarget(e.target)) return;
      const touch = e.changedTouches && e.changedTouches[0];
      if (!touch) return;
      tStart = { x: touch.clientX, y: touch.clientY, t: Date.now() };
      try{ e.preventDefault(); }catch(_){ }
    }, { capture:true, passive:false });

    frame.addEventListener('touchend', (e) => {
      if (!tStart) return;
      const touch = e.changedTouches && e.changedTouches[0];
      if (!touch) { tStart = null; return; }
      const handled = handleGesture(tStart.x, tStart.y, touch.clientX, touch.clientY, Date.now() - tStart.t);
      tStart = null;
      if (handled) suppressClickUntil = Date.now() + 450;
    }, { capture:true });

    // Click fallback on coarse pointers (tap-to-next)
    frame.addEventListener('click', (e) => {
      if (!isViewMode()) return;
      if (Date.now() < suppressClickUntil) return;
      try{
        if (window.matchMedia && !window.matchMedia('(pointer: coarse)').matches) return;
      }catch(_){ }
      if (isInteractiveTarget(e.target)) return;
      goNext();
    }, true);
  })();

  // --- UI events ---
  btnAddImages.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) addFiles(fileInput.files);
    fileInput.value = "";
  });

  btnPrev.addEventListener("click", () => goPrev());
  btnNext.addEventListener("click", () => goNext());

  btnAddNote.addEventListener("click", () => { if (!isViewMode()) addNote(); });

  // Note Panel bindings
  npClear?.addEventListener("click", () => setActiveNote(null));
  npBg?.addEventListener("input", () => {
    const n = getActiveNote();
    if (!n) return;
    n.bg = npBg.value;
    applyNoteStyle(getNoteEl(n.id), n);
    saveNotesSoon();
  });
  npFg?.addEventListener("input", () => {
    const n = getActiveNote();
    if (!n) return;
    n.fg = npFg.value;
    applyNoteStyle(getNoteEl(n.id), n);
    saveNotesSoon();
  });
  npAlpha?.addEventListener("input", () => {
    const n = getActiveNote();
    if (!n) return;
    n.alpha = Math.max(0.2, Math.min(1, parseFloat(npAlpha.value) || 0.85));
    applyNoteStyle(getNoteEl(n.id), n);
    saveNotesSoon();
  });
  npFs?.addEventListener("input", () => {
    const n = getActiveNote();
    if (!n) return;
    n.fs = Math.max(10, Math.min(48, parseInt(npFs.value, 10) || 16));
    if (npFsVal) npFsVal.textContent = String(n.fs);
    applyNoteStyle(getNoteEl(n.id), n);
    saveNotesSoon();
  });
  npBold?.addEventListener("click", () => {
    const n = getActiveNote();
    if (!n) return;
    n.bold = !n.bold;
    applyNoteStyle(getNoteEl(n.id), n);
    updateNotePanel();
    saveNotesSoon();
  });
  npDelete?.addEventListener("click", () => {
    const n = getActiveNote();
    if (!n) return;
    deleteNote(n.id);
  });

  // Click outside notes to deselect
  frame.addEventListener("pointerdown", (e) => {
    if (e.target?.closest?.(".note") || e.target?.closest?.("#notePanel")) return;
    setActiveNote(null);
  }, { capture:true });

  btnToggleMode.addEventListener("click", () => setMode(isViewMode() ? "edit" : "view"));

  btnDeleteAllImages.addEventListener("click", deleteAllImages);

  btnSaveDoc.addEventListener("click", saveDoc);
  btnLoadDoc.addEventListener("click", () => fileDocInput.click());
  fileDocInput.addEventListener("change", async () => {
    const f = fileDocInput.files?.[0];
    fileDocInput.value = "";
    if (!f) return;
    try{
      await loadDocFromFile(f);
    }catch(err){
      alert("Loadに失敗しました: " + err.message);
    }
  });

  // Print/PDF: print exactly what is shown in View mode
  btnPrint?.addEventListener("click", () => {
    _printPrevMode = mode;
    if (mode !== "view") setMode("view");
    // Some browsers don't reliably fire beforeprint. Build explicitly.
    buildPrintRoot();
    setTimeout(() => window.print(), 30);
  });

  window.addEventListener("beforeprint", () => {
    buildPrintRoot();
  });
  window.addEventListener("afterprint", () => {
    clearPrintRoot();
    if (_printPrevMode && _printPrevMode !== mode) setMode(_printPrevMode);
    _printPrevMode = null;
  });

  // Keyboard
  document.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable || e.target.closest?.(".note-editor"))) return;
    if (e.key === " "){ e.preventDefault(); goNext(); }
    if (e.key === "ArrowLeft") goPrev();
    if (e.key === "ArrowRight") goNext();
    if (e.key.toLowerCase() === "n") { if (!isViewMode()) addNote(); }
    if (e.key.toLowerCase() === "v") setMode(isViewMode() ? "edit" : "view");
  });

  // init / restore
  async function restoreImagesFromIDB(){
    const meta = await dbGet("meta");
    if (!meta || !Array.isArray(meta.pages)) {
      pages = [];
      index = 0;
      setMode("edit");
      showPage(0);
      return;
    }
    pages = meta.pages.map(p => ({
      id: p.id,
      name: p.name,
      mime: p.mime,
      blob: null,
      url: null,
      memoHtml: p.memoHtml || "",
      notes: p.notes || []
    }));
    for (const p of pages) {
      p.blob = await dbGet("img:" + p.id);
    }
    index = clamp(meta.index || 0, 0, Math.max(0, pages.length - 1));
    setMode(meta.mode || "edit");
    showPage(index);
  }

  setupThumbPointerSort();
  restoreImagesFromIDB();

})();

  async function blobToDataURL(blob){
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  async function printAllPages(){
    if (!pages || pages.length === 0) return;

    // temporarily switch to view mode for printing
    const prevMode = mode;
    setMode("view");

    // prepare data
    const pack = [];
    for (const p of pages){
      const blob = await dbGet("img:" + p.id) || p.blob;
      const src = blob ? await blobToDataURL(blob) : (p.url || "");
      pack.push({
        name: p.name || "",
        src,
        notes: (p.notes || []).map(n => ({
          nx:n.nx, ny:n.ny, nw:n.nw, nh:n.nh,
          bg:n.bg || "#ffffff",
          fg:n.fg || "#000000",
          alpha: Number(n.alpha ?? 1),
          z: n.z || 10,
          html: (typeof n.html === "string" ? n.html : "")
        }))
      });
    }

    const w = window.open("", "_blank");
    if (!w) { setMode(prevMode); return; }

    const doc = w.document;
    doc.open();
    doc.write(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Print</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  html, body { margin: 0; padding: 0; }
  body { background: #fff; color: #000; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
  .sheet {
    width: calc(210mm - 20mm);
    height: calc(297mm - 20mm);
    page-break-after: always;
    position: relative;
    overflow: hidden;
  }
  .canvas {
    position: absolute;
    inset: 0;
  }
  .pimg {
    position:absolute;
    left:0; top:0;
    transform-origin: top left;
  }
  .note {
    position:absolute;
    border-radius: 10px;
    padding: 10px 12px;
    box-sizing: border-box;
    overflow: hidden;
    word-break: break-word;
    white-space: pre-wrap;
  }
</style>
</head>
<body>
<div id="root"></div>
<script>
  const DATA = ${JSON.stringify(pack)};
  function hexToRgba(hex, a){
    let h = (hex||"#ffffff").replace("#","");
    if (h.length===3) h = h.split("").map(x=>x+x).join("");
    const r=parseInt(h.slice(0,2),16)||255;
    const g=parseInt(h.slice(2,4),16)||255;
    const b=parseInt(h.slice(4,6),16)||255;
    return "rgba("+r+","+g+","+b+","+(a??1)+")";
  }
  const root = document.getElementById("root");
  for (let i=0;i<DATA.length;i++){
    const p = DATA[i];
    const sheet = document.createElement("section");
    sheet.className = "sheet";
    const canvas = document.createElement("div");
    canvas.className = "canvas";
    const img = document.createElement("img");
    img.className = "pimg";
    img.src = p.src;
    canvas.appendChild(img);
    sheet.appendChild(canvas);
    root.appendChild(sheet);

    img.onload = () => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      const s = Math.min(W / nw, H / nh);
      const dw = nw * s;
      const dh = nh * s;
      const ox = (W - dw) / 2;
      const oy = (H - dh) / 2;
      img.style.width = dw + "px";
      img.style.height = dh + "px";
      img.style.left = ox + "px";
      img.style.top = oy + "px";

      for (const n of (p.notes||[])){
        const el = document.createElement("div");
        el.className = "note";
        el.style.left = (ox + n.nx * dw) + "px";
        el.style.top  = (oy + n.ny * dh) + "px";
        el.style.width  = (n.nw * dw) + "px";
        el.style.height = (n.nh * dh) + "px";
        el.style.background = hexToRgba(n.bg, n.alpha);
        el.style.color = n.fg || "#000";
        el.style.zIndex = String(n.z || 10);
        el.innerHTML = n.html || "";
        canvas.appendChild(el);
      }
    };
  }

  // Wait a tick so images/layout settle, then print
  window.addEventListener("load", () => {
    setTimeout(() => { window.print(); }, 300);
  });
</script>
</body>
</html>`);
    doc.close();

    // restore
    w.addEventListener("afterprint", () => {
      try { w.close(); } catch {}
      setMode(prevMode);
      renderNotes();
    });
  }

