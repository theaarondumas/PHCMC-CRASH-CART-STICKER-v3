const KEY = "cc_clean_batch_v1";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const debug = $("debug");

  // Elements
  const els = {
    batchList: $("batchList"),
    btnPrintAll: $("btnPrintAll"),
    btnClear: $("btnClear"),
    btnSubmitCart: $("btnSubmitCart"),
    btnUnsubmitCart: $("btnUnsubmitCart"),

    firstSupply: $("firstSupply"),
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
    sDate: $("sDate"),
    sCheckDone: $("sCheckDone"),
    sTech: $("sTech"),

    sFirstDrug: $("sFirstDrug"),
    sDrugName: $("sDrugName"),
    sLock: $("sLock"),
    sDrugCheckDone: $("sDrugCheckDone"),
    sInitials: $("sInitials"),
  };

  // Safety: if ANY required element is missing, show it
  const requiredIds = ["batchList","firstSupply","sFirstSupply","btnPrintAll"];
  const missing = requiredIds.filter(id => !$(id));
  if (missing.length) {
    if (debug) debug.textContent = `JS loaded but missing elements: ${missing.join(", ")} (check file version/cache).`;
    return;
  }

  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const blankCart = (id) => ({
    id,
    status: "Draft",
    completedAt: null,

    firstSupply: "",
    date: todayISO(),
    checkDone: todayISO(),
    tech: "",

    firstDrugExp: "",
    drugName: "",
    lockNumber: "",
    drugCheckDone: "",
    initials: ""
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
    }
  });

  let state = load() || defaultState();

  // INIT
  renderBatch();
  loadCartToForm(getActive());
  renderSticker(getActive());
  bindLiveInputs();
  bindButtons();

  if (debug) debug.textContent = "JS running ✅ (if you see this, the bindings are live)";

  // -------- bindings --------
  function bindLiveInputs() {
    const map = [
      ["firstSupply", "firstSupply"],
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

        // If edited, revert to draft (keeps dot honest)
        if (c.status === "Completed") {
          c.status = "Draft";
          c.completedAt = null;
        }

        save();
        renderSticker(c);
        renderBatch();
      });
    });
  }

  function bindButtons() {
    els.btnSubmitCart.addEventListener("click", () => {
      const c = getActive();
      c.status = "Completed";
      c.completedAt = new Date().toISOString();
      save();
      renderBatch();
      renderSticker(c);
    });

    els.btnUnsubmitCart.addEventListener("click", () => {
      const c = getActive();
      c.status = "Draft";
      c.completedAt = null;
      save();
      renderBatch();
      renderSticker(c);
    });

    els.btnClear.addEventListener("click", () => {
      if (!confirm("Clear ALL saved data?")) return;
      localStorage.removeItem(KEY);
      state = defaultState();
      save();
      renderBatch();
      loadCartToForm(getActive());
      renderSticker(getActive());
    });

    els.btnPrintAll.addEventListener("click", () => {
      openPrintAll();
    });
  }

  // -------- render --------
  function renderBatch() {
    els.batchList.innerHTML = "";
    ["CC-01", "CC-02", "CC-03", "CC-04"].forEach((id) => {
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
        save();
        renderBatch();
        loadCartToForm(getActive());
        renderSticker(getActive());
      });

      els.batchList.appendChild(btn);
    });

    els.cartId.value = state.active;
  }

  function loadCartToForm(c) {
    els.cartId.value = c.id;
    els.firstSupply.value = c.firstSupply || "";
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
    els.sDate.textContent = c.date ? prettyDate(c.date) : "—";
    els.sCheckDone.textContent = c.checkDone ? prettyDate(c.checkDone) : "—";
    els.sTech.textContent = c.tech || "—";

    els.sFirstDrug.textContent = c.firstDrugExp ? prettyDate(c.firstDrugExp) : "—";
    els.sDrugName.textContent = c.drugName || "—";
    els.sLock.textContent = c.lockNumber || "—";
    els.sDrugCheckDone.textContent = c.drugCheckDone ? prettyDate(c.drugCheckDone) : "—";
    els.sInitials.textContent = c.initials || "—";
  }

  // -------- print --------
  function openPrintAll() {
    const html = `<html><head><meta charset="utf-8"><title>Print</title></head>
      <body><h2>Use your browser Print → Save as PDF</h2></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Popup blocked. Allow popups."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // -------- helpers --------
  function getActive() { return state.carts[state.active]; }

  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || ""); }
    catch { return null; }
  }

  function prettyDate(yyyyMmDd) {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
  }
});
