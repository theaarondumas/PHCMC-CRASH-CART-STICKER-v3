/**
 * Crash Cart Batch v3
 * - Clears: firstSupply, cartNumber, drugName, initials by default
 * - Firestore real-time sync (central storage)
 * - LocalStorage + offline-friendly
 *
 * IMPORTANT: Keep PHI out (no patient identifiers).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js"; // CDN modular  [oai_citation:3‡Firebase](https://firebase.google.com/docs/web/alt-setup?utm_source=chatgpt.com)

const LOCAL_KEY = "cc_clean_batch_v3";

document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const debug = $("debug");
  const cloudStatus = $("cloudStatus");

  // ---------- Firebase CONFIG ----------
  // Replace this with your Firebase web app config from Project Settings.
  // (Firebase console → Project Settings → Your apps → SDK setup and config)
  const firebaseConfig = {
    apiKey: "PASTE_ME",
    authDomain: "PASTE_ME",
    projectId: "PASTE_ME",
    storageBucket: "PASTE_ME",
    messagingSenderId: "PASTE_ME",
    appId: "PASTE_ME"
  };

  // If you haven’t pasted config yet, run local-only gracefully
  const firebaseReady = Object.values(firebaseConfig).every(v => typeof v === "string" && v !== "PASTE_ME");

  // Elements
  const els = {
    batchList: $("batchList"),
    btnPrintAll: $("btnPrintAll"),
    btnClear: $("btnClear"),
    btnSubmitCart: $("btnSubmitCart"),
    btnUnsubmitCart: $("btnUnsubmitCart"),

    firstSupply: $("firstSupply"),
    cartNumber: $("cartNumber"),
    date: $("date"),
    checkDone: $("checkDone"),
    tech: $("tech"),

    firstDrugExp: $("firstDrugExp"),
    drugName: $("drugName"),
    lockNumber: $("lockNumber"),
    drugCheckDone: $("drugCheckDone"),
    initials: $("initials"),
    cartId: $("cartId"),

    sFacility: $("sFacility"),
    sDept: $("sDept"),
    sPhone: $("sPhone"),
    sFirstSupply: $("sFirstSupply"),
    sCartNum: $("sCartNum"),
    sDate: $("sDate"),
    sCheckDone: $("sCheckDone"),
    sTech: $("sTech"),

    sFirstDrug: $("sFirstDrug"),
    sDrugName: $("sDrugName"),
    sLock: $("sLock"),
    sDrugCheckDone: $("sDrugCheckDone"),
    sInitials: $("sInitials"),
  };

  // Sanity check
  const required = ["batchList","firstSupply","cartNumber","sCartNum","btnPrintAll","cloudStatus"];
  const missing = required.filter(id => !$(id));
  if (missing.length) {
    if (debug) debug.textContent = `Missing elements: ${missing.join(", ")} (wrong file/cached page).`;
    return;
  }

  // ---------- Helpers ----------
  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Central doc id: facility + date (simple default)
  const batchDocId = () => {
    // If you later want multiple units/facilities, we can expose this as a dropdown.
    const facilitySlug = "phc"; // keep simple; we can compute from header later
    return `${facilitySlug}-${todayISO()}`;
  };

  const blankCart = (id) => ({
    id,
    status: "Draft",
    completedAt: null,

    // CLEARED BY DEFAULT (your request)
    firstSupply: "",
    cartNumber: "",
    drugName: "",
    initials: "",

    // Keep these defaults
    date: todayISO(),
    checkDone: todayISO(),
    tech: "",

    firstDrugExp: "",
    lockNumber: "",
    drugCheckDone: "",
  });

  const defaultState = () => ({
    header: {
      facility: "Providence Holy Cross Hospital",
      dept: "Central Department",
      phone: "818-496-1190",
    },
    active: "CC-01",
    carts: {
      "CC-01": blankCart("CC-01"),
      "CC-02": blankCart("CC-02"),
      "CC-03": blankCart("CC-03"),
      "CC-04": blankCart("CC-04"),
    },
    meta: {
      updatedAtLocal: Date.now(),
      updatedByDevice: getDeviceId()
    }
  });

  function getDeviceId() {
    const key = "cc_device_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
    localStorage.setItem(key, id);
    return id;
  }

  function prettyDate(yyyyMmDd) {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // ---------- State ----------
  let state = loadLocal() || defaultState();

  // ---------- Firestore (real-time) ----------
  let db = null;
  let cloudDocRef = null;
  let suppressNextCloudWrite = false;
  let saveTimer = null;

  if (firebaseReady) {
    try {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      cloudDocRef = doc(db, "crashCartBatches", batchDocId());

      // Offline cache for Firestore (best effort)
      enableIndexedDbPersistence(db).catch(() => { /* ignore */ });

      // Live subscribe
      onSnapshot(cloudDocRef, (snap) => {
        if (!snap.exists()) {
          cloudStatus.textContent = `Cloud: ready • doc will be created (${batchDocId()})`;
          return;
        }
        const cloud = snap.data();

        // Basic last-write-wins using updatedAtLocal
        const cloudUpdated = cloud?.meta?.updatedAtLocal || 0;
        const localUpdated = state?.meta?.updatedAtLocal || 0;

        if (cloudUpdated > localUpdated) {
          suppressNextCloudWrite = true;
          state = cloud;
          saveLocal();            // keep local in sync
          renderAll();
          cloudStatus.textContent = `Cloud: synced • updated`;
        } else {
          cloudStatus.textContent = `Cloud: listening • up to date`;
        }
      });

      cloudStatus.textContent = `Cloud: connected • live sync ON`;
    } catch (e) {
      cloudStatus.textContent = `Cloud: error (running local-only)`;
      if (debug) debug.textContent = `Firebase init error: ${String(e)}`;
    }
  } else {
    cloudStatus.textContent = `Cloud: OFF (paste Firebase config in app.js)`;
  }

  // ---------- Init render + bindings ----------
  renderAll();
  bindLiveInputs();
  bindButtons();

  if (debug) debug.textContent = "App running ✅";

  function bindLiveInputs() {
    const map = [
      ["firstSupply", "firstSupply"],
      ["cartNumber", "cartNumber"],
      ["date", "date"],
      ["checkDone", "checkDone"],
      ["tech", "tech"],
      ["firstDrugExp", "firstDrugExp"],
      ["drugName", "drugName"],
      ["lockNumber", "lockNumber"],
      ["drugCheckDone", "drugCheckDone"],
      ["initials", "initials"],
    ];

    map.forEach(([elKey, stateKey]) => {
      els[elKey].addEventListener("input", (e) => {
        const c = getActive();
        c[stateKey] = e.target.value;

        // Keep dots honest: editing flips back to Draft
        if (c.status === "Completed") {
          c.status = "Draft";
          c.completedAt = null;
        }

        touchMeta();
        saveLocal();
        renderAll();

        // Debounced cloud save
        scheduleCloudSave();
      });
    });
  }

  function bindButtons() {
    els.btnSubmitCart.addEventListener("click", () => {
      const c = getActive();
      c.status = "Completed";
      c.completedAt = new Date().toISOString();
      touchMeta();
      saveLocal();
      renderAll();
      scheduleCloudSave();
    });

    els.btnUnsubmitCart.addEventListener("click", () => {
      const c = getActive();
      c.status = "Draft";
      c.completedAt = null;
      touchMeta();
      saveLocal();
      renderAll();
      scheduleCloudSave();
    });

    els.btnClear.addEventListener("click", () => {
      if (!confirm("Clear ALL saved data (local + cloud doc)?")) return;
      state = defaultState();
      touchMeta();
      saveLocal();
      renderAll();
      scheduleCloudSave(true);
    });

    els.btnPrintAll.addEventListener("click", () => {
      openPrintAll();
    });
  }

  function touchMeta() {
    state.meta = state.meta || {};
    state.meta.updatedAtLocal = Date.now();
    state.meta.updatedByDevice = getDeviceId();
  }

  function scheduleCloudSave(immediate = false) {
    if (!firebaseReady || !cloudDocRef) return;

    if (suppressNextCloudWrite) {
      suppressNextCloudWrite = false;
      return;
    }

    if (saveTimer) clearTimeout(saveTimer);
    const delay = immediate ? 0 : 450;

    saveTimer = setTimeout(async () => {
      try {
        cloudStatus.textContent = "Cloud: saving…";
        // store a server timestamp too (nice for audit)
        const payload = {
          ...state,
          meta: {
            ...state.meta,
            updatedAtServer: serverTimestamp()
          }
        };
        await setDoc(cloudDocRef, payload, { merge: true });
        cloudStatus.textContent = "Cloud: saved ✅";
      } catch (e) {
        cloudStatus.textContent = "Cloud: save failed (local ok)";
        if (debug) debug.textContent = `Cloud save error: ${String(e)}`;
      }
    }, delay);
  }

  // ---------- Rendering ----------
  function renderAll() {
    renderBatch();
    loadCartToForm(getActive());
    renderSticker(getActive());
  }

  function renderBatch() {
    els.batchList.innerHTML = "";
    ["CC-01","CC-02","CC-03","CC-04"].forEach((id) => {
      const c = state.carts[id];

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "batchBtn" + (state.active === id ? " active" : "");

      const dot = document.createElement("span");
      dot.className = "dot" + (c.status === "Completed" ? " on" : "");
      btn.appendChild(dot);

      const meta = document.createElement("span");
      meta.className = "batchMeta";
      meta.innerHTML = `
        <span class="batchName">${id}</span>
        <span class="batchStatus">${c.status}</span>
      `;
      btn.appendChild(meta);

      btn.addEventListener("click", () => {
        state.active = id;
        touchMeta();
        saveLocal();
        renderAll();
        scheduleCloudSave();
      });

      els.batchList.appendChild(btn);
    });

    els.cartId.value = state.active;
  }

  function loadCartToForm(c) {
    els.cartId.value = c.id;

    els.firstSupply.value = c.firstSupply || "";
    els.cartNumber.value = c.cartNumber || "";      // stays blank unless you type
    els.date.value = c.date || todayISO();
    els.checkDone.value = c.checkDone || todayISO();
    els.tech.value = c.tech || "";

    els.firstDrugExp.value = c.firstDrugExp || "";
    els.drugName.value = c.drugName || "";          // stays blank unless you type
    els.lockNumber.value = c.lockNumber || "";
    els.drugCheckDone.value = c.drugCheckDone || "";
    els.initials.value = c.initials || "";          // stays blank unless you type
  }

  function renderSticker(c) {
    els.sFacility.textContent = state.header.facility;
    els.sDept.textContent = state.header.dept;
    els.sPhone.textContent = state.header.phone;

    els.sFirstSupply.textContent = c.firstSupply || "—";
    els.sCartNum.textContent = c.cartNumber || "—";
    els.sDate.textContent = c.date ? prettyDate(c.date) : "—";
    els.sCheckDone.textContent = c.checkDone ? prettyDate(c.checkDone) : "—";
    els.sTech.textContent = c.tech || "—";

    els.sFirstDrug.textContent = c.firstDrugExp ? prettyDate(c.firstDrugExp) : "—";
    els.sDrugName.textContent = c.drugName || "—";
    els.sLock.textContent = c.lockNumber || "—";
    els.sDrugCheckDone.textContent = c.drugCheckDone ? prettyDate(c.drugCheckDone) : "—";
    els.sInitials.textContent = c.initials || "—";
  }

  // ---------- Print ----------
  function openPrintAll() {
    const html = buildPrintHTML();
    const w = window.open("", "_blank");
    if (!w) { alert("Popup blocked. Allow popups to print/export."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function buildPrintHTML() {
    const css = `
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:18px;color:#111}
      h1{margin:0 0 10px}
      .grid{display:grid;grid-template-columns:1fr;gap:14px}
      .sticker{border-radius:14px;overflow:hidden;border:1px solid rgba(0,0,0,.15)}
      .green{background:rgba(163,230,53,.92)}
      .orange{background:rgba(251,146,60,.92)}
      .header{padding:14px 14px 6px;line-height:1.15}
      .facility{font-weight:900;font-size:18px}
      .dept{font-weight:800;margin-top:4px}
      .phone{font-weight:800;text-decoration:underline;margin-top:4px}
      .title{text-align:center;font-weight:1000;letter-spacing:.8px;padding:10px 14px;border-top:1px solid rgba(0,0,0,.15);border-bottom:1px solid rgba(0,0,0,.15);font-size:26px}
      .title.small{font-size:24px;border-top:none}
      .lines{padding:10px 14px 14px}
      .row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.12);font-weight:850}
      .row:last-child{border-bottom:none}
      .fill{font-weight:950;min-width:160px;text-align:right}
      .badge{display:inline-block;margin:10px 0 0;padding:4px 10px;border-radius:999px;background:#fff;border:1px solid rgba(0,0,0,.12);font-weight:900}
      @media print{button{display:none} body{margin:0}}
    `;

    const ids = ["CC-01","CC-02","CC-03","CC-04"];
    const blocks = ids.map(id => {
      const c = state.carts[id];
      const status = c.status === "Completed" ? "COMPLETED" : "DRAFT";

      return `
        <div class="badge">${id} • ${status}</div>

        <div class="sticker green">
          <div class="header">
            <div class="facility">${escapeHtml(state.header.facility)}</div>
            <div class="dept">${escapeHtml(state.header.dept)}</div>
            <div class="phone">${escapeHtml(state.header.phone)}</div>
          </div>
          <div class="title">CRASH CART CHECK</div>
          <div class="lines">
            <div class="row"><span>First supply to expire:</span><span class="fill">${escapeHtml(c.firstSupply||"—")}</span></div>
            <div class="row"><span>Cart #:</span><span class="fill">${escapeHtml(c.cartNumber||"—")}</span></div>
            <div class="row"><span>Date:</span><span class="fill">${c.date ? escapeHtml(prettyDate(c.date)) : "—"}</span></div>
            <div class="row"><span>Check Date done:</span><span class="fill">${c.checkDone ? escapeHtml(prettyDate(c.checkDone)) : "—"}</span></div>
            <div class="row"><span>CS tech:</span><span class="fill">${escapeHtml(c.tech||"—")}</span></div>
          </div>
        </div>

        <div class="sticker orange" style="margin-top:10px">
          <div class="title small">Crash Cart Check</div>
          <div class="lines">
            <div class="row"><span>First Drug to Exp:</span><span class="fill">${c.firstDrugExp ? escapeHtml(prettyDate(c.firstDrugExp)) : "—"}</span></div>
            <div class="row"><span>Name of Drug:</span><span class="fill">${escapeHtml(c.drugName||"—")}</span></div>
            <div class="row"><span>Lock Number:</span><span class="fill">${escapeHtml(c.lockNumber||"—")}</span></div>
            <div class="row"><span>Check done on:</span><span class="fill">${c.drugCheckDone ? escapeHtml(prettyDate(c.drugCheckDone)) : "—"}</span></div>
            <div class="row"><span>Initials:</span><span class="fill">${escapeHtml(c.initials||"—")}</span></div>
          </div>
        </div>
      `;
    }).join("<div style='height:14px'></div>");

    return `
      <!doctype html>
      <html>
      <head><meta charset="utf-8"><title>Crash Cart Batch Print</title><style>${css}</style></head>
      <body>
        <button onclick="window.print()">Print / Save as PDF</button>
        <h1>Crash Cart Batch</h1>
        <div class="grid">${blocks}</div>
      </body>
      </html>
    `;
  }

  // ---------- Local storage ----------
  function saveLocal() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getActive() {
    return state.carts[state.active];
  }
});
