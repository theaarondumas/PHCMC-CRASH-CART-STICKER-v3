/* =========================================================
   UnitFlow — Department + Cart Type Checklists
   ✅ Local autosave
   ✅ CSV export
   ✅ Firestore realtime sync (optional)
   ✅ Offline persistence (IndexedDB)
   ✅ Conflict handling (cloud vs local)
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// -------------------- Firebase Config --------------------
// Use YOUR real config (apiKey etc. is OK for client apps; rules must protect data)
const firebaseConfig = {
  apiKey: "AIzaSyB-3bjNKIf-00cRu3HtxdsjnM",
  authDomain: "phcmc-crash-cart.firebaseapp.com",
  projectId: "phcmc-crash-cart",
  storageBucket: "phcmc-crash-cart.appspot.com",
  messagingSenderId: "478233106614",
  appId: "1:478233106614:web:441f55c8f401"
};

const firebaseReady =
  firebaseConfig &&
  typeof firebaseConfig.projectId === "string" &&
  firebaseConfig.projectId.length > 0;

// -------------------- DOM --------------------
const departmentSelect = document.getElementById("departmentSelect");
const cartTypeSelect = document.getElementById("cartTypeSelect");
const checklistContainer = document.getElementById("checklistContainer");
const statusLine = document.getElementById("statusLine");
const btnClear = document.getElementById("btnClear");
const btnExport = document.getElementById("btnExport");

// Optional elements (only used if you add them later)
const batchCodeEl = document.getElementById("batchCode");     // optional input
const btnJoinEl   = document.getElementById("btnJoin");       // optional button
const cloudStatusEl = document.getElementById("cloudStatus"); // optional label/span

// -------------------- Local Keys --------------------
function storageKey(dept, type) {
  return `unitflow_checklist_${dept || "NONE"}_${type || "NONE"}`;
}
const DEVICE_KEY = "unitflow_device_id";
const CLOUD_CODE_KEY = "unitflow_cloud_code_v1";

// -------------------- Helpers --------------------
function setStatus(msg) {
  if (statusLine) statusLine.textContent = msg;
}
function setCloudStatus(msg) {
  if (cloudStatusEl) cloudStatusEl.textContent = msg;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function yyyymmdd() {
  return todayISO().replaceAll("-", "");
}
function normalizeCode(code) {
  return String(code || "").trim().replace(/\s+/g, "-").toUpperCase();
}
function deptSlug(name) {
  return String(name || "")
    .toUpperCase()
    .replaceAll("&", "AND")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function escapeCSV(val) {
  const s = String(val ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// -------------------- Cart Definitions (edit anytime) --------------------
const CART_DEFS = {
  adult: {
    title: "Adult Crash Cart",
    columns: ["Area", "Cart #", "Central Exp", "Med Box Exp", "Checked By", "Notes"],
    sections: [
      { name: "ER Area", rows: ["Cardiology", "EDX1", "EDX2", "ER Triage", "ER Rm 2"] },
      { name: "X-Ray Dept", rows: ["CT1", "CT2/MRI", "X-Ray", "Specials Rm 5", "Specials Rm 6", "Cath Lab", "CT Trailer"] },
      { name: "Mother/Baby", rows: ["L/D Triage", "L/D nurse stn", "Maternity"] },
      { name: "Surgery", rows: ["OR", "Recovery"] },
      { name: "North Building", rows: ["Physical therapy"] },
      { name: "Basement", rows: ["GI Lab"] },
      { name: "Central Backup Carts", rows: ["Backup #1", "Backup #2", "Backup #3", "Backup #4"] }
    ]
  },
  neonatal: {
    title: "Neonatal Crash Cart",
    columns: ["Location", "Cart #", "Central Exp", "Med Box Exp", "Checked By", "Notes"],
    sections: [
      { name: "Labor and Delivery", rows: ["OR Hallway", "L/D Hallway"] },
      { name: "Mother/Baby", rows: ["NICU", "Nursery", "Maternity", "PAV C NICU"] },
      { name: "2nd Floor", rows: ["2A", "Overflow"] },
      { name: "Central Backup Carts", rows: ["Backup #1", "Backup #2", "Backup #3", "Backup #4", "Backup #5"] }
    ]
  },
  broselow: {
    title: "Broselow Cart",
    columns: ["Area", "Cart #", "Central Exp", "Med Box Exp", "Checked By", "Notes"],
    sections: [
      { name: "2nd Floor", rows: ["2C", "ER", "EDX1", "EDX2", "ER Main"] },
      { name: "Surgery", rows: ["Recovery"] },
      { name: "North Bldg", rows: ["Physical Therapy"] },
      { name: "Central Backup Carts", rows: ["Backup #3", "Backup #6"] }
    ]
  }
};

// -------------------- State --------------------
function defaultState() {
  return {
    rows: {}, // keyed by rowId
    meta: {
      updatedAtLocal: Date.now(),
      updatedByDevice: getDeviceId(),
      dept: "",
      cartType: ""
    }
  };
}

function loadLocal(dept, type) {
  try {
    const raw = localStorage.getItem(storageKey(dept, type));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function saveLocal(dept, type, state) {
  try {
    localStorage.setItem(storageKey(dept, type), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function touchMeta(state, dept, type) {
  state.meta = state.meta || {};
  state.meta.updatedAtLocal = Date.now();
  state.meta.updatedByDevice = getDeviceId();
  state.meta.dept = dept;
  state.meta.cartType = type;
}

// -------------------- Firestore Sync --------------------
let db = null;
let currentDocRef = null;
let unsubscribe = null;
let suppressNextCloudWrite = false;
let saveTimer = null;

function buildDefaultBatchCode(dept) {
  // Auto code: UF-YYYYMMDD-DEPT-DAY
  return `UF-${yyyymmdd()}-${deptSlug(dept || "DEPT")}-DAY`;
}

function getBatchCode(dept) {
  // Priority:
  // 1) UI input if present
  // 2) stored last code
  // 3) auto generated
  const ui = batchCodeEl ? normalizeCode(batchCodeEl.value) : "";
  if (ui) return ui;

  const saved = localStorage.getItem(CLOUD_CODE_KEY);
  if (saved) return normalizeCode(saved);

  const auto = buildDefaultBatchCode(dept);
  return normalizeCode(auto);
}

function setBatchCode(code) {
  const norm = normalizeCode(code);
  localStorage.setItem(CLOUD_CODE_KEY, norm);
  if (batchCodeEl) batchCodeEl.value = norm;
}

function cloudDocId(batchCode, dept, type) {
  // One document per (batch + department + cart type)
  // Keeps data separated cleanly
  return `${normalizeCode(batchCode)}__${deptSlug(dept)}__${String(type).toUpperCase()}`;
}

function connectFirestore() {
  if (!firebaseReady) return;

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  // Offline cache (good for hospital wifi)
  enableIndexedDbPersistence(db).catch(() => {});
}

function joinCloudRoom(dept, type) {
  if (!db) {
    setCloudStatus("Cloud: OFF");
    return;
  }

  const batchCode = getBatchCode(dept);
  setBatchCode(batchCode);

  // Cleanly switch listeners
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  const id = cloudDocId(batchCode, dept, type);
  currentDocRef = doc(db, "unitflowChecklists", id);
  setCloudStatus(`Cloud: connecting… (${batchCode})`);

  unsubscribe = onSnapshot(currentDocRef, (snap) => {
    if (!snap.exists()) {
      setCloudStatus(`Cloud: ready • doc will be created (${batchCode})`);
      // Create doc from local
      scheduleCloudSave(true);
      return;
    }

    const cloud = snap.data();
    const cloudUpdated = cloud?.meta?.updatedAtLocal || 0;

    const localState = loadLocal(dept, type) || defaultState();
    const localUpdated = localState?.meta?.updatedAtLocal || 0;

    if (cloudUpdated > localUpdated) {
      suppressNextCloudWrite = true;
      saveLocal(dept, type, cloud);
      renderChecklist(dept, type);
      setCloudStatus(`Cloud: synced • ${batchCode}`);
    } else {
      setCloudStatus(`Cloud: listening • ${batchCode}`);
    }
  });

  // Also ensure doc exists soon
  scheduleCloudSave(true);
}

function scheduleCloudSave(immediate = false) {
  if (!db || !currentDocRef) return;

  if (suppressNextCloudWrite) {
    suppressNextCloudWrite = false;
    return;
  }

  if (saveTimer) clearTimeout(saveTimer);
  const delay = immediate ? 0 : 450;

  saveTimer = setTimeout(async () => {
    try {
      const dept = departmentSelect?.value || "";
      const type = cartTypeSelect?.value || "";
      if (!dept || !type) return;

      const batchCode = getBatchCode(dept);
      const state = loadLocal(dept, type) || defaultState();

      // add server timestamp
      const payload = {
        ...state,
        meta: {
          ...(state.meta || {}),
          updatedAtServer: serverTimestamp()
        }
      };

      setCloudStatus(`Cloud: saving… (${batchCode})`);
      await setDoc(currentDocRef, payload, { merge: true });
      setCloudStatus(`Cloud: saved ✅ (${batchCode})`);
    } catch (e) {
      setCloudStatus("Cloud: save failed (local ok)");
      // keep UI clean; don’t spam
      console.warn("Cloud save error:", e);
    }
  }, delay);
}

// -------------------- UI Rendering --------------------
function renderChecklist(dept, type) {
  const def = CART_DEFS[type];
  if (!def) return;

  const state = loadLocal(dept, type) || (() => {
    const s = defaultState();
    touchMeta(s, dept, type);
    saveLocal(dept, type, s);
    return s;
  })();

  setStatus(`Department: ${dept} — ${def.title}`);

  const head = `
    <div class="hrow">
      <div class="title">${def.title}</div>
      <div class="badge">${dept} • ${String(type).toUpperCase()}</div>
    </div>
  `;

  const tableHead = `
    <thead>
      <tr>${def.columns.map(c => `<th>${c}</th>`).join("")}</tr>
    </thead>
  `;

  let bodyHTML = `<tbody>`;

  def.sections.forEach((sec, sIdx) => {
    bodyHTML += `
      <tr class="section-row">
        <td colspan="${def.columns.length}">${sec.name}</td>
      </tr>
    `;

    sec.rows.forEach((label, rIdx) => {
      const rowId = `${type}__${sIdx}__${rIdx}`;
      const row = state.rows[rowId] || {};

      bodyHTML += `
        <tr data-rowid="${rowId}">
          <td class="cell-label">${label}</td>
          <td><input class="cell" data-field="cart" placeholder="#" value="${row.cart || ""}"></td>
          <td><input class="cell" data-field="central" placeholder="MM-DD-YY" value="${row.central || ""}"></td>
          <td><input class="cell" data-field="medbox" placeholder="MM-DD-YY" value="${row.medbox || ""}"></td>
          <td><input class="cell" data-field="checked" placeholder="Initials" value="${row.checked || ""}"></td>
          <td><input class="cell" data-field="notes" placeholder="Note" value="${row.notes || ""}"></td>
        </tr>
      `;
    });
  });

  bodyHTML += `</tbody>`;

  checklistContainer.innerHTML = `
    ${head}
    <div class="table-wrap">
      <table>
        ${tableHead}
        ${bodyHTML}
      </table>
    </div>
  `;

  attachAutosave(dept, type);
}

function attachAutosave(dept, type) {
  const table = checklistContainer.querySelector("table");
  if (!table) return;

  table.addEventListener("input", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;

    const tr = input.closest("tr[data-rowid]");
    if (!tr) return;

    const rowId = tr.getAttribute("data-rowid");
    const field = input.getAttribute("data-field");
    if (!rowId || !field) return;

    const state = loadLocal(dept, type) || defaultState();
    state.rows = state.rows || {};
    state.rows[rowId] = state.rows[rowId] || {};
    state.rows[rowId][field] = input.value;

    touchMeta(state, dept, type);
    saveLocal(dept, type, state);

    scheduleCloudSave(false);
  });
}

// -------------------- CSV Export --------------------
function exportCSV(dept, type) {
  const def = CART_DEFS[type];
  const state = loadLocal(dept, type) || defaultState();

  const lines = [];
  lines.push(["Department", "Cart Type", ...def.columns].map(escapeCSV).join(","));

  def.sections.forEach((sec, sIdx) => {
    lines.push([dept, type, sec.name, "", "", "", "", ""].map(escapeCSV).join(","));

    sec.rows.forEach((label, rIdx) => {
      const rowId = `${type}__${sIdx}__${rIdx}`;
      const row = state.rows[rowId] || {};

      lines.push([
        dept,
        type,
        label,
        row.cart || "",
        row.central || "",
        row.medbox || "",
        row.checked || "",
        row.notes || ""
      ].map(escapeCSV).join(","));
    });
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().slice(0, 10);
  const filename = `unitflow_${dept}_${type}_${ts}.csv`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -------------------- Wiring --------------------
function hideControls() {
  cartTypeSelect.classList.add("hidden");
  btnClear.classList.add("hidden");
  btnExport.classList.add("hidden");
  checklistContainer.innerHTML = "";
  setStatus("Select a Department, then choose Cart Type.");
  setCloudStatus("Cloud: —");
}

function showControls() {
  cartTypeSelect.classList.remove("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  connectFirestore();

  // Initial UI state
  hideControls();

  departmentSelect.addEventListener("change", () => {
    const dept = departmentSelect.value;

    if (!dept) {
      cartTypeSelect.value = "";
      hideControls();
      return;
    }

    showControls();
    setStatus(`Department: ${dept} — choose Cart Type.`);
  });

  cartTypeSelect.addEventListener("change", () => {
    const dept = departmentSelect.value;
    const type = cartTypeSelect.value;

    if (!dept || !type) return;

    btnClear.classList.remove("hidden");
    btnExport.classList.remove("hidden");

    // Render from local immediately
    renderChecklist(dept, type);

    // Join cloud room for this (dept + type)
    joinCloudRoom(dept, type);
  });

  btnClear.addEventListener("click", () => {
    const dept = departmentSelect.value;
    const type = cartTypeSelect.value;
    if (!dept || !type) return;

    const ok = confirm("Clear all entries for this Department + Cart Type on this device?");
    if (!ok) return;

    localStorage.removeItem(storageKey(dept, type));
    renderChecklist(dept, type);
    scheduleCloudSave(false);
  });

  btnExport.addEventListener("click", () => {
    const dept = departmentSelect.value;
    const type = cartTypeSelect.value;
    if (!dept || !type) return;
    exportCSV(dept, type);
  });

  // Optional “Join” button support (if you add batchCode + btnJoin later)
  if (btnJoinEl) {
    btnJoinEl.addEventListener("click", () => {
      const dept = departmentSelect.value;
      const type = cartTypeSelect.value;
      if (!dept || !type) return;

      const code = batchCodeEl ? batchCodeEl.value : "";
      if (code) setBatchCode(code);

      joinCloudRoom(dept, type);
    });
  }
});
