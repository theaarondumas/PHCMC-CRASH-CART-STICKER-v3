// app.js — DROP IN (UnitFlow UI + 2 Adult Lists + Batch + Firestore + CSV)

// ===== Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/**
 * PASTE YOUR FIREBASE CONFIG HERE
 * (Firebase Console -> Project Settings -> Your Apps -> Config)
 */
const firebaseConfig = FIREBASE_CONFIG_HERE; // <-- replace this line

let db = null;
let firebaseReady = false;

try {
  const fbApp = initializeApp(firebaseConfig);
  db = getFirestore(fbApp);
  firebaseReady = true;
} catch (err) {
  console.warn("Firebase not initialized. App will run local-only until config is added.", err);
}

// ===== Templates (2 Adult Crash Cart Lists) =====
const TEMPLATES = [
  {
    id: "tower_icu",
    name: "Adult Crash Cart — Tower / ICU",
    locations: [
      "4 South (Tower)",
      "4 East (Tower)",
      "Extra Cart (4th Floor Tower)",
      "3 South (Tower)",
      "3 East (Tower)",
      "Extra Cart (3rd Floor Tower)",
      "2 South (Tower)",
      "2 East (Tower)",
      "Extra Cart (2nd Floor Tower)",
      "2A (2nd Floor North)",
      "2B (2nd Floor North)",
      "2C (2nd Floor North)",
      "2D (2nd Floor North)",
      "Extra Cart (2nd Floor North)",
      "3A (3rd Floor North)",
      "3B (3rd Floor North)",
      "3C (3rd Floor North)",
      "3D (3rd Floor North)",
      "Extra Cart (3rd Floor North)",
      "ICU Pavilion A (1st Floor)",
      "ICU Pavilion B (1st Floor)",
      "ICU Pavilion C (1st Floor)"
    ]
  },
  {
    id: "er_imaging",
    name: "Adult Crash Cart — ER / Imaging / Surgery",
    locations: [
      "Cardiology (ER Area)",
      "EDX1",
      "EDX2",
      "ER Triage",
      "ER Room 2",
      "CT1 (X-Ray Dept)",
      "CT2/MRI (X-Ray Dept)",
      "X-Ray",
      "Specials Room 5",
      "Specials Room 6",
      "Cath Lab",
      "CT Trailer",
      "L/D Triage (Mother/Baby)",
      "L/D Nurse Station (Mother/Baby)",
      "Maternity (Mother/Baby)",
      "OR (Surgery)",
      "Recovery (Surgery)",
      "North Building (Physical Therapy)",
      "Basement (GI Lab)",
      "Central Backup Carts"
    ]
  }
];

// ===== Local Storage =====
const LOCAL_KEY = "unitflow_crashcart_v4";

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

// ===== DOM (MUST match index.html IDs) =====
const deptSelect = document.getElementById("deptSelect");
const templateSelect = document.getElementById("templateSelect");
const clearEntryBtn = document.getElementById("clearEntryBtn");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const savePill = document.getElementById("savePill");

const deptLine = document.getElementById("deptLine");
const stickerDept = document.getElementById("stickerDept");
const typeValue = document.getElementById("typeValue");

const locationSelect = document.getElementById("locationSelect");
const cartNumInput = document.getElementById("cartNumInput");
const centralExpInput = document.getElementById("centralExpInput");
const medBoxExpInput = document.getElementById("medBoxExpInput");

const dateInput = document.getElementById("dateInput");
const checkedByInput = document.getElementById("checkedByInput");
const noteInput = document.getElementById("noteInput");

const addToBatchBtn = document.getElementById("addToBatchBtn");
const submitBatchBtn = document.getElementById("submitBatchBtn");
const clearBatchBtn = document.getElementById("clearBatchBtn");

const batchCount = document.getElementById("batchCount");
const batchTbody = document.getElementById("batchTbody");
const statusEl = document.getElementById("status");

// ===== State =====
let state = {
  department: "ER",
  templateId: "er_imaging",
  date: new Date().toISOString().slice(0, 10),
  checkedBy: "",
  entry: {
    location: "",
    cartNum: "",
    centralExp: "",
    medBoxExp: "",
    note: ""
  },
  batch: []
};

// ===== Helpers =====
function getTemplate() {
  return TEMPLATES.find(t => t.id === state.templateId) || TEMPLATES[0];
}

function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setSavePill(text, mode = "warn") {
  savePill.textContent = text;

  // inline styles so this works even if CSS changes
  if (mode === "ok") {
    savePill.style.borderColor = "rgba(0,0,0,0.20)";
    savePill.style.background = "rgba(70, 211, 122, 0.20)";
    savePill.style.color = "#b8ffd2";
  } else if (mode === "bad") {
    savePill.style.borderColor = "rgba(255,0,0,0.25)";
    savePill.style.background = "rgba(255, 77, 77, 0.18)";
    savePill.style.color = "#ffb4b4";
  } else {
    savePill.style.borderColor = "rgba(255,180,180,0.20)";
    savePill.style.background = "rgba(60, 40, 40, 0.70)";
    savePill.style.color = "#ffb4b4";
  }
}

function markDirty() {
  saveLocal();
  setSavePill("Not saved", "warn");
}

function updateHeaderLine() {
  const templateName = getTemplate().name;
  deptLine.textContent = `Department: ${state.department} — ${templateName}`;
  stickerDept.textContent = state.department;
  typeValue.textContent = "ADULT";
}

// ===== UI Hydration =====
function hydrateTemplates() {
  templateSelect.innerHTML = "";
  for (const t of TEMPLATES) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    templateSelect.appendChild(opt);
  }
  templateSelect.value = state.templateId;
}

function hydrateLocations() {
  const t = getTemplate();
  const list = [...t.locations];

  // Keep custom location if it exists (for handwritten add-ons later)
  if (state.entry.location && !list.includes(state.entry.location)) {
    list.unshift(state.entry.location);
  }

  locationSelect.innerHTML = "";

  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Select…";
  locationSelect.appendChild(ph);

  for (const loc of list) {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  }

  locationSelect.value = state.entry.location || "";
}

function applyStateToInputs() {
  deptSelect.value = state.department || "ER";
  templateSelect.value = state.templateId || TEMPLATES[0].id;

  dateInput.value = state.date || new Date().toISOString().slice(0, 10);
  checkedByInput.value = state.checkedBy || "";

  hydrateLocations();

  cartNumInput.value = state.entry.cartNum || "";
  centralExpInput.value = state.entry.centralExp || "";
  medBoxExpInput.value = state.entry.medBoxExp || "";
  noteInput.value = state.entry.note || "";

  updateHeaderLine();
}

// ===== Batch Rendering =====
function renderBatch() {
  batchCount.textContent = String(state.batch.length);
  batchTbody.innerHTML = "";

  for (const item of state.batch) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.location)}</td>
      <td>${escapeHtml(item.cartNum)}</td>
      <td>${escapeHtml(item.centralExp)}</td>
      <td>${escapeHtml(item.medBoxExp)}</td>
      <td>${escapeHtml(item.checkedBy)}</td>
      <td>${escapeHtml(item.note || "")}</td>
      <td>
        <button class="btn ghost" data-remove="${item.id}" style="padding:8px 10px;border-radius:10px">
          ✕
        </button>
      </td>
    `;
    batchTbody.appendChild(tr);
  }

  batchTbody.querySelectorAll("[data-remove]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove");
      state.batch = state.batch.filter(x => x.id !== id);
      renderBatch();
      markDirty();
      setStatus("Removed item.");
    });
  });
}

// ===== Validation =====
function validateEntry() {
  if (!state.entry.location) return "Pick Location.";
  if (!state.entry.cartNum) return "Enter Cart #.";
  if (!state.entry.centralExp) return "Enter Central Exp.";
  if (!state.entry.medBoxExp) return "Enter Med Box Exp.";
  if (!state.checkedBy) return "Enter Checked By initials.";
  return "";
}

// ===== Events =====
deptSelect.addEventListener("change", () => {
  state.department = deptSelect.value;
  updateHeaderLine();
  markDirty();
});

templateSelect.addEventListener("change", () => {
  state.templateId = templateSelect.value;
  state.entry.location = ""; // reset for new template
  hydrateLocations();
  updateHeaderLine();
  markDirty();
});

dateInput.addEventListener("change", () => {
  state.date = dateInput.value;
  markDirty();
});

checkedByInput.addEventListener("input", () => {
  state.checkedBy = checkedByInput.value.trim();
  markDirty();
});

locationSelect.addEventListener("change", () => {
  state.entry.location = locationSelect.value;
  markDirty();
});

cartNumInput.addEventListener("input", () => {
  state.entry.cartNum = cartNumInput.value.trim();
  markDirty();
});

centralExpInput.addEventListener("change", () => {
  state.entry.centralExp = centralExpInput.value;
  markDirty();
});

medBoxExpInput.addEventListener("change", () => {
  state.entry.medBoxExp = medBoxExpInput.value;
  markDirty();
});

noteInput.addEventListener("input", () => {
  state.entry.note = noteInput.value.trim();
  markDirty();
});

clearEntryBtn.addEventListener("click", () => {
  state.entry = { location: "", cartNum: "", centralExp: "", medBoxExp: "", note: "" };
  hydrateLocations();
  cartNumInput.value = "";
  centralExpInput.value = "";
  medBoxExpInput.value = "";
  noteInput.value = "";
  markDirty();
  setStatus("Cleared entry.");
});

addToBatchBtn.addEventListener("click", () => {
  const err = validateEntry();
  if (err) {
    setStatus(err);
    setSavePill("Save failed", "bad");
    return;
  }

  const item = {
    id: uid(),
    department: state.department,
    templateId: state.templateId,
    templateName: getTemplate().name,
    date: state.date,
    location: state.entry.location,
    cartNum: state.entry.cartNum,
    centralExp: state.entry.centralExp,
    medBoxExp: state.entry.medBoxExp,
    checkedBy: state.checkedBy,
    note: state.entry.note || ""
  };

  state.batch.unshift(item);

  // Keep location selected (location-first). Clear cart-specific fields.
  state.entry.cartNum = "";
  state.entry.centralExp = "";
  state.entry.medBoxExp = "";
  state.entry.note = "";

  cartNumInput.value = "";
  centralExpInput.value = "";
  medBoxExpInput.value = "";
  noteInput.value = "";

  renderBatch();
  markDirty();
  setStatus("Added to batch.");
});

clearBatchBtn.addEventListener("click", () => {
  state.batch = [];
  renderBatch();
  markDirty();
  setStatus("Cleared batch.");
});

// ===== Export CSV =====
exportCsvBtn.addEventListener("click", () => {
  const rows = [
    ["date","department","template","location","cartNum","centralExp","medBoxExp","checkedBy","note"],
    ...state.batch.map(i => [
      i.date,
      i.department,
      i.templateName,
      i.location,
      i.cartNum,
      i.centralExp,
      i.medBoxExp,
      i.checkedBy,
      i.note
    ])
  ];

  const csv = rows
    .map(r => r.map(x => `"${String(x ?? "").replaceAll('"','""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `crash_cart_batch_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
  setStatus("Exported CSV.");
});

// ===== Submit Batch to Firestore =====
submitBatchBtn.addEventListener("click", async () => {
  if (state.batch.length === 0) {
    setStatus("Batch is empty.");
    return;
  }

  if (!firebaseReady || !db) {
    setStatus("Firebase not set up. Paste firebaseConfig in app.js.");
    setSavePill("Save failed", "bad");
    return;
  }

  try {
    setStatus("Submitting batch…");

    const batchId = `batch_${new Date().toISOString()}_${Math.random().toString(16).slice(2,8)}`;
    const ref = doc(collection(db, "crash_cart_batches"), batchId);

    await setDoc(ref, {
      batchId,
      department: state.department,
      templateId: state.templateId,
      templateName: getTemplate().name,
      date: state.date,
      checkedBy: state.checkedBy,
      itemCount: state.batch.length,
      items: state.batch,
      createdAt: serverTimestamp()
    });

    state.batch = [];
    renderBatch();
    saveLocal();

    setStatus("Batch submitted ✅");
    setSavePill("Saved", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Submit failed. Check Firestore rules / config / internet.");
    setSavePill("Save failed", "bad");
  }
});

// ===== Init =====
(function init() {
  const saved = loadLocal();
  state = { ...state, ...saved };

  if (!state.date) state.date = new Date().toISOString().slice(0, 10);
  if (!state.department) state.department = "ER";
  if (!state.templateId) state.templateId = "er_imaging";
  if (!state.entry) state.entry = { location: "", cartNum: "", centralExp: "", medBoxExp: "", note: "" };
  if (!Array.isArray(state.batch)) state.batch = [];

  hydrateTemplates();
  applyStateToInputs();
  renderBatch();

  setStatus(firebaseReady ? "Ready." : "Ready (local only — add Firebase config for cloud).");
  setSavePill("Not saved", "warn");
})();
