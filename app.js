import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const LOCAL_KEY = "cc_clean_batch_option3_dept_v1";
const LOCAL_CODE_KEY = "cc_batch_code_dept_v1";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const els = {
    // topbar dept dropdown
    deptSelect: $("deptSelect"),

    // batch code UI
    batchCode: $("batchCode"),
    btnJoin: $("btnJoin"),
    btnCopyCode: $("btnCopyCode"),
    btnRotateCode: $("btnRotateCode"),
    cloudStatus: $("cloudStatus"),
    footerBatch: $("footerBatch"),
    debug: $("debug"),

    // batch UI
    batchList: $("batchList"),
    btnPrintAll: $("btnPrintAll"),
    btnClear: $("btnClear"),
    btnSubmitCart: $("btnSubmitCart"),
    btnUnsubmitCart: $("btnUnsubmitCart"),

    // inputs
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

    // sticker fields
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

  // ---------- Firebase CONFIG ----------
  // Paste your real Firebase config here:
  const firebaseConfig = {
    apiKey: "PASTE_ME",
    authDomain: "PASTE_ME",
    projectId: "PASTE_ME",
    storageBucket: "PASTE_ME",
    messagingSenderId: "PASTE_ME",
    appId: "PASTE_ME"
  };

  const firebaseReady = Object.values(firebaseConfig).every(
    v => typeof v === "string" && v !== "PASTE_ME"
  );

  // ---------- Helpers ----------
  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const prettyDate = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
  };

  const escapeHtml = (str) => String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  const normalizeCode = (code) =>
    String(code || "").trim().replace(/\s+/g, "-").toUpperCase();

  const deptSlug = (name) => {
    return String(name || "")
      .toUpperCase()
      .replaceAll("&", "AND")
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  function getDeviceId() {
    const key = "cc_device_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = "dev_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
    localStorage.setItem(key, id);
    return id;
  }

  // ---------- State ----------
  const blankCart = (id) => ({
    id,
    status: "Draft",
    completedAt: null,

    // CLEARED by default
    firstSupply: "",
    cartNumber: "",
    drugName: "",
    initials: "",

    // keep defaults
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
      updatedByDevice: getDeviceId(),
    }
  });

  let state = loadLocal() || defaultState();

  // ---------- Firestore ----------
  let db = null;
  let unsubscribe = null;
  let currentDocRef = null;
  let suppressNextCloudWrite = false;
  let saveTimer = null;

  if (firebaseReady) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    enableIndexedDbPersistence(db).catch(() => {});
  }

  // ---------- Department dropdown init ----------
  if (els.deptSelect) {
    els.deptSelect.value = state.header.dept || "Central Department";
  }

  // default batch code includes department + date
  const defaultCode = () => {
    const dept = state?.header?.dept || "Central Department";
    return `PHC-${todayISO().replaceAll("-","")}-${deptSlug(dept)}-DAY`;
  };

  els.batchCode.value = localStorage.getItem(LOCAL_CODE_KEY) || defaultCode();
  updateFooter();

  // ---------- Department change behavior ----------
  els.deptSelect.addEventListener("change", () => {
    const newDept = els.deptSelect.value;

    // update header + sticker
    state.header.dept = newDept;

    // set batch code to match dept + date
    const base = `PHC-${todayISO().replaceAll("-","")}-${deptSlug(newDept)}-DAY`;
    els.batchCode.value = base;
    localStorage.setItem(LOCAL_CODE_KEY, base);
    updateFooter();

    touchMeta();
    saveLocal();
    renderAll();

    // join/sync the new room
    joinBatch(base);
  });

  // ---------- Batch code actions ----------
  els.btnJoin.addEventListener("click", () => joinBatch(els.batchCode.value));

  els.btnCopyCode.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(normalizeCode(els.batchCode.value));
      els.cloudStatus.textContent = "Batch Code copied ✅";
    } catch {
      els.cloudStatus.textContent = "Copy blocked — select + copy manually.";
    }
  });

  els.btnRotateCode.addEventListener("click", () => {
    const rotated = rotateCode();
    els.batchCode.value = rotated;
    joinBatch(rotated);
  });

  // auto-join on load
  joinBatch(els.batchCode.value);

  // ---------- Bind UI ----------
  bindLiveInputs();
  bindButtons();
  renderAll();
  els.debug.textContent = "App running ✅";

  function rotateCode() {
    const dept = state?.header?.dept || "Central Department";
    const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
    return `PHC-${todayISO().replaceAll("-","")}-${deptSlug(dept)}-DAY-${rand}`;
  }

  function updateFooter() {
    els.footerBatch.textContent = `Batch Code: ${normalizeCode(els.batchCode.value) || "—"}`;
  }

  function touchMeta() {
    state.meta = state.meta || {};
    state.meta.updatedAtLocal = Date.now();
    state.meta.updatedByDevice = getDeviceId();
  }

  function joinBatch(rawCode) {
    const code = normalizeCode(rawCode);
    if (!code) {
      els.cloudStatus.textContent = "Enter a Batch Code.";
      return;
    }

    localStorage.setItem(LOCAL_CODE_KEY, code);
    els.batchCode.value = code;
    updateFooter();

    if (!firebaseReady || !db) {
      els.cloudStatus.textContent = "Cloud: OFF (paste Firebase config in app.js)";
      return;
    }

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    currentDocRef = doc(db, "crashCartBatches", code);
    els.cloudStatus.textContent = `Cloud: connecting… (${code})`;

    unsubscribe = onSnapshot(currentDocRef, (snap) => {
      if (!snap.exists()) {
        els.cloudStatus.textContent = `Cloud: ready • doc will be created (${code})`;
        return;
      }

      const cloud = snap.data();
      const cloudUpdated = cloud?.meta?.updatedAtLocal || 0;
      const localUpdated = state?.meta?.updatedAtLocal || 0;

      if (cloudUpdated > localUpdated) {
        suppressNextCloudWrite = true;
        state = cloud;

        // keep dept dropdown in sync with cloud
        if (els.deptSelect && state?.header?.dept) {
          els.deptSelect.value = state.header.dept;
        }

        saveLocal();
        renderAll();
        els.cloudStatus.textContent = `Cloud: synced • ${code}`;
      } else {
        els.cloudStatus.textContent = `Cloud: listening • ${code}`;
      }
    });

    // create doc if needed
    scheduleCloudSave(true);
  }

  function scheduleCloudSave(immediate = false) {
    if (!firebaseReady || !currentDocRef) return;

    if (suppressNextCloudWrite) {
      suppressNextCloudWrite = false;
      return;
    }

    if (saveTimer) clearTimeout(saveTimer);
    const delay = immediate ? 0 : 450;

    saveTimer = setTimeout(async () => {
      try {
        els.cloudStatus.textContent = `Cloud: saving… (${normalizeCode(els.batchCode.value)})`;
        const payload = {
          ...state,
          meta: {
            ...state.meta,
            updatedAtServer: serverTimestamp(),
          }
        };
        await setDoc(currentDocRef, payload, { merge: true });
        els.cloudStatus.textContent = `Cloud: saved ✅ (${normalizeCode(els.batchCode.value)})`;
      } catch (e) {
        els.cloudStatus.textContent = "Cloud: save failed (local ok)";
        els.debug.textContent = `Cloud save error: ${String(e)}`;
      }
    }, delay);
  }

  // ---------- Live inputs ----------
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

        if (c.status === "Completed") {
          c.status = "Draft";
          c.completedAt = null;
        }

        touchMeta();
        saveLocal();
        renderAll();
        scheduleCloudSave(false);
      });
    });
  }

  // ---------- Buttons ----------
  function bindButtons() {
    els.btnSubmitCart.addEventListener("click", () => {
      const c = getActive();
      c.status = "Completed";
      c.completedAt = new Date().toISOString();
      touchMeta();
      saveLocal();
      renderAll();
      scheduleCloudSave(false);
    });

    els.btnUnsubmitCart.addEventListener("click", () => {
      const c = getActive();
      c.status = "Draft";
      c.completedAt = null;
      touchMeta();
      saveLocal();
      renderAll();
      scheduleCloudSave(false);
    });

    els.btnClear.addEventListener("click", () => {
      if (!confirm("Clear ALL saved data (local + this batch doc)?")) return;
      state = defaultState();

      // keep dept dropdown value in sync with reset
      if (els.deptSelect) els.deptSelect.value = state.header.dept;

      // reset batch code to dept/date default
      const base = defaultCode();
      els.batchCode.value = base;
      localStorage.setItem(LOCAL_CODE_KEY, base);
      updateFooter();

      touchMeta();
      saveLocal();
      renderAll();
      joinBatch(base);
    });

    els.btnPrintAll.addEventListener("click", () => openPrintAll());
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
        scheduleCloudSave(false);
      });

      els.batchList.appendChild(btn);
    });

    els.cartId.value = state.active;
  }

  function loadCartToForm(c) {
    els.cartId.value = c.id;

    els.firstSupply.value = c.firstSupply || "";
    els.cartNumber.value = c.cartNumber || "";
    els.date.value = c.date || todayISO();
    els.checkDone.value = c.checkDone || todayISO();
    els.tech.value = c.tech || "";

    els.firstDrugExp.value = c.firstDrugExp || "";
    els.drugName.value = c.drugName || "";
    els.lockNumber.value = c.lockNumber || "";
    els.drugCheckDone.value = c.drugCheckDone || "";
    els.initials.value = c.initials || "";
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
    const code = escapeHtml(normalizeCode(els.batchCode.value));

    const blocks = ids.map(id => {
      const c = state.carts[id];
      const status = c.status === "Completed" ? "COMPLETED" : "DRAFT";

      return `
        <div class="badge">${id} • ${status} • ${code}</div>

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
        <h1>Crash Cart Batch • ${code}</h1>
        <div class="grid">${blocks}</div>
      </body>
      </html>
    `;
  }

  function getActive() {
    return state.carts[state.active];
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
});
