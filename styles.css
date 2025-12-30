// app.js (ES module)

// ====== Firebase (reuse your config from yesterday) ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// PASTE YOUR CONFIG HERE (from Firebase Console)
const firebaseConfig = FIREBASE_CONFIG_HERE;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ====== Templates (2 Adult Lists) ======
const TEMPLATES = [
  {
    id: "tower_icu",
    name: "Adult List — Tower / ICU",
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
    name: "Adult List — ER / Imaging / Surgery",
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

// ====== Local persistence ======
const LOCAL_KEY = "phc_crashcart_batch_v2";

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); }
  catch { return {}; }
}
function saveLocal(state) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
}

// ====== DOM ======
const templateSelect = document.getElementById("templateSelect");
const locationSelect = document.getElementById("locationSelect");

const dateInput = document.getElementById("dateInput");
const checkedByInput = document.getElementById("checkedByInput");

const cartNumInput = document.getElementById("cartNumInput");
const centralExpInput = document.getElementById("centralExpInput");
const medBoxExpInput = document.getElementById("medBoxExpInput");
const noteInput = document.getElementById("noteInput");

const addToBatchBtn = document.getElementById("addToBatchBtn");
const clearEntryBtn = document.getElementById("clearEntryBtn");

const submitBatchBtn = document.getElementById("submitBatchBtn");
const clearBatchBtn = document.getElementById("clearBatchBtn");

const batchTbody = document.getElementById("batchTbody");
const batchCount = document.getElementById("batchCount");
const statusEl = document.getElementById("status");

// Preview fields
const pvDate = document.getElementById("pvDate");
const pvCheckedBy = document.getElementById("pvCheckedBy");
const pvTemplate = document.getElementById("pvTemplate");
const pvLocation = document.getElementById("pvLocation");
const pvCart = document.getElementById("pvCart");
const pvCentral = document.getElementById("pvCentral");
const pvMedBox = document.getElementById("pvMedBox");
const pvNote = document.getElementById("pvNote");

// ====== State ======
let state = {
  templateId: TEMPLATES[0].id,
  date: "",
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

(function init() {
  const saved = loadLocal();
  state = { ...state, ...saved };
  if (!state.templateId) state.templateId = TEMPLATES[0].id;

  // Defaults
  if (!state.date) state.date = new Date().toISOString().slice(0, 10);

  // Fill template dropdown
  templateSelect.innerHTML = "";
  for (const t of TEMPLATES) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    templateSelect.appendChild(opt);
  }

  // Apply state to UI
  templateSelect.value = state.templateId;
  dateInput.value = state.date;
  checkedByInput.value = state.checkedBy || "";

  hydrateLocations();
  applyEntryToUI();
  renderBatch();
  renderPreview();
  setStatus("Ready.");
})();

function getTemplate() {
  return TEMPLATES.find(t => t.id === state.templateId) || TEMPLATES[0];
}

function hydrateLocations() {
  const t = getTemplate();
  locationSelect.innerHTML = "";

  // Optional "Custom" support:
  // We'll put the saved location (if it isn't in list) at top.
  const locations = [...t.locations];
  if (state.entry.location && !locations.includes(state.entry.location)) {
    locations.unshift(state.entry.location);
  }

  // Add a placeholder
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Select a location…";
  locationSelect.appendChild(ph);

  for (const loc of locations) {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  }

  locationSelect.value = state.entry.location || "";
}

function applyEntryToUI() {
  locationSelect.value = state.entry.location || "";
  cartNumInput.value = state.entry.cartNum || "";
  centralExpInput.value = state.entry.centralExp || "";
  medBoxExpInput.value = state.entry.medBoxExp || "";
  noteInput.value = state.entry.note || "";
}

function setStatus(msg, type = "") {
  statusEl.className = "status" + (type ? " " + type : "");
  statusEl.textContent = msg;
}

// ====== Live updates ======
function onAnyChange() {
  saveLocal(state);
  renderPreview();
}

templateSelect.addEventListener("change", () => {
  state.templateId = templateSelect.value;
  // Reset location when template switches
  state.entry.location = "";
  hydrateLocations();
  onAnyChange();
});

dateInput.addEventListener("change", () => {
  state.date = dateInput.value;
  onAnyChange();
});

checkedByInput.addEventListener("input", () => {
  state.checkedBy = checkedByInput.value.trim();
  onAnyChange();
});

locationSelect.addEventListener("change", () => {
  state.entry.location = locationSelect.value;
  onAnyChange();
});

cartNumInput.addEventListener("input", () => {
  state.entry.cartNum = cartNumInput.value.trim();
  onAnyChange();
});

centralExpInput.addEventListener("change", () => {
  state.entry.centralExp = centralExpInput.value;
  onAnyChange();
});

medBoxExpInput.addEventListener("change", () => {
  state.entry.medBoxExp = medBoxExpInput.value;
  onAnyChange();
});

noteInput.addEventListener("input", () => {
  state.entry.note = noteInput.value.trim();
  onAnyChange();
});

// ====== Preview rendering ======
function fmtDate(d) {
  if (!d) return "—";
  // keep yyyy-mm-dd readable
  return d;
}

function renderPreview() {
  pvDate.textContent = fmtDate(state.date);
  pvCheckedBy.textContent = state.checkedBy || "—";
  pvTemplate.textContent = getTemplate().name || "—";
  pvLocation.textContent = state.entry.location || "—";
  pvCart.textContent = state.entry.cartNum || "—";
  pvCentral.textContent = fmtDate(state.entry.centralExp);
  pvMedBox.textContent = fmtDate(state.entry.medBoxExp);
  pvNote.textContent = state.entry.note || "—";
}

// ====== Batch handling ======
function validateEntry() {
  if (!state.entry.location) return "Pick a location.";
  if (!state.entry.cartNum) return "Enter Cart #.";
  if (!state.entry.centralExp) return "Enter Central Exp.";
  if (!state.entry.medBoxExp) return "Enter Med Box Exp.";
  if (!state.checkedBy) return "Enter your initials in Checked By.";
  return "";
}

addToBatchBtn.addEventListener("click", () => {
  const err = validateEntry();
  if (err) {
    setStatus(err, "bad");
    return;
  }

  const item = {
    id: crypto.randomUUID(),
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

  // Clear entry fields (keep template/date/checkedBy)
  state.entry.cartNum = "";
  state.entry.centralExp = "";
  state.entry.medBoxExp = "";
  state.entry.note = "";

  applyEntryToUI();
  renderBatch();
  renderPreview();
  saveLocal(state);
  setStatus("Added to batch.", "good");
});

clearEntryBtn.addEventListener("click", () => {
  state.entry.location = "";
  state.entry.cartNum = "";
  state.entry.centralExp = "";
  state.entry.medBoxExp = "";
  state.entry.note = "";
  hydrateLocations();
  applyEntryToUI();
  renderPreview();
  saveLocal(state);
  setStatus("Entry cleared.");
});

function removeFromBatch(id) {
  state.batch = state.batch.filter(x => x.id !== id);
  renderBatch();
  saveLocal(state);
  setStatus("Removed item.");
}

function renderBatch() {
  batchTbody.innerHTML = "";
  batchCount.textContent = String(state.batch.length);

  for (const item of state.batch) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(item.location)}</td>
      <td>${escapeHtml(item.cartNum)}</td>
      <td>${escapeHtml(item.centralExp)}</td>
      <td>${escapeHtml(item.medBoxExp)}</td>
      <td>${escapeHtml(item.checkedBy)}</td>
      <td>${escapeHtml(item.note || "")}</td>
      <td><button class="icon-btn" data-id="${item.id}">✕</button></td>
    `;

    batchTbody.appendChild(tr);
  }

  // bind remove buttons
  batchTbody.querySelectorAll("button[data-id]").forEach(btn => {
    btn.addEventListener("click", () => removeFromBatch(btn.dataset.id));
  });
}

clearBatchBtn.addEventListener("click", () => {
  state.batch = [];
  renderBatch();
  saveLocal(state);
  setStatus("Batch cleared.");
});

// ====== Submit to Firestore ======
submitBatchBtn.addEventListener("click", async () => {
  if (state.batch.length === 0) {
    setStatus("Batch is empty.", "bad");
    return;
  }

  try {
    setStatus("Submitting batch…");

    const batchId = `batch_${new Date().toISOString()}`;
    const ref = doc(collection(db, "crash_cart_batches"), batchId);

    await setDoc(ref, {
      batchId,
      date: state.date,
      checkedBy: state.checkedBy,
      templateId: state.templateId,
      templateName: getTemplate().name,
      itemCount: state.batch.length,
      items: state.batch,
      createdAt: serverTimestamp()
    });

    // Clear batch after successful submit
    state.batch = [];
    renderBatch();
    saveLocal(state);

    setStatus("Batch submitted to Firestore ✅", "good");
  } catch (e) {
    console.error(e);
    setStatus("Submit failed. Check Firebase config / rules / internet.", "bad");
  }
});

// ====== Helpers ======
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
