/* Clean 4-cart batch (GitHub Pages / LocalStorage) */

const KEY = "cc_clean_batch_v1";

const els = {
  batchList: document.getElementById("batchList"),
  btnPrintAll: document.getElementById("btnPrintAll"),
  btnClear: document.getElementById("btnClear"),
  btnSubmitCart: document.getElementById("btnSubmitCart"),
  btnUnsubmitCart: document.getElementById("btnUnsubmitCart"),

  // inputs
  firstSupply: document.getElementById("firstSupply"),
  date: document.getElementById("date"),
  checkDone: document.getElementById("checkDone"),
  tech: document.getElementById("tech"),

  firstDrugExp: document.getElementById("firstDrugExp"),
  drugName: document.getElementById("drugName"),
  lockNumber: document.getElementById("lockNumber"),
  drugCheckDone: document.getElementById("drugCheckDone"),
  initials: document.getElementById("initials"),
  cartId: document.getElementById("cartId"),

  // sticker
  sFacility: document.getElementById("sFacility"),
  sDept: document.getElementById("sDept"),
  sPhone: document.getElementById("sPhone"),
  sFirstSupply: document.getElementById("sFirstSupply"),
  sDate: document.getElementById("sDate"),
  sCheckDone: document.getElementById("sCheckDone"),
  sTech: document.getElementById("sTech"),

  sFirstDrug: document.getElementById("sFirstDrug"),
  sDrugName: document.getElementById("sDrugName"),
  sLock: document.getElementById("sLock"),
  sDrugCheckDone: document.getElementById("sDrugCheckDone"),
  sInitials: document.getElementById("sInitials"),
};

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
};

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

function blankCart(id){
  return {
    id,
    status: "Draft",          // Draft | Completed
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
  };
}

let state = load() || defaultState();

// -------- INIT --------
renderBatch();
loadCartToForm(getActive());
renderSticker(getActive());

bindLiveInputs();
bindButtons();

// -------- BINDINGS --------
function bindLiveInputs(){
  const map = [
    ["firstSupply","firstSupply"],
    ["date","date"],
    ["checkDone","checkDone"],
    ["tech","tech"],
    ["firstDrugExp","firstDrugExp"],
    ["drugName","drugName"],
    ["lockNumber","lockNumber"],
    ["drugCheckDone","drugCheckDone"],
    ["initials","initials"],
  ];

  map.forEach(([elName, key])=>{
    els[elName].addEventListener("input", (e)=>{
      const c = getActive();
      if (!c) return;
      c[key] = e.target.value;
      // editing flips back to Draft if it was completed (optional but clean)
      if (c.status === "Completed") {
        c.status = "Draft";
        c.completedAt = null;
      }
      save();
      renderSticker(c);
      renderBatch(); // keep bullets accurate
    });
  });
}

function bindButtons(){
  els.btnSubmitCart.addEventListener("click", ()=>{
    const c = getActive();
    if (!c) return;
    c.status = "Completed";
    c.completedAt = new Date().toISOString();
    save();
    renderBatch();
    renderSticker(c);
  });

  els.btnUnsubmitCart.addEventListener("click", ()=>{
    const c = getActive();
    if (!c) return;
    c.status = "Draft";
    c.completedAt = null;
    save();
    renderBatch();
    renderSticker(c);
  });

  els.btnClear.addEventListener("click", ()=>{
    if (!confirm("Clear ALL saved data?")) return;
    localStorage.removeItem(KEY);
    state = defaultState();
    save();
    renderBatch();
    loadCartToForm(getActive());
    renderSticker(getActive());
  });

  els.btnPrintAll.addEventListener("click", ()=>{
    openPrintAll();
  });
}

// -------- RENDER --------
function renderBatch(){
  els.batchList.innerHTML = "";

  ["CC-01","CC-02","CC-03","CC-04"].forEach(id=>{
    const c = state.carts[id];
    const btn = document.createElement("button");
    btn.className = "batchBtn" + (state.active === id ? " active" : "");
    btn.type = "button";

    const dot = document.createElement("span");
    dot.className = "dot" + (c.status === "Completed" ? " on" : "");
    btn.appendChild(dot);

    const meta = document.createElement("span");
    meta.className = "batchMeta";
    meta.innerHTML = `
      <span class="batchName">${id}</span>
      <span class="batchStatus">${c.status}${c.completedAt ? " • done" : ""}</span>
    `;
    btn.appendChild(meta);

    btn.addEventListener("click", ()=>{
      state.active = id;
      save();
      renderBatch();
      loadCartToForm(getActive());
      renderSticker(getActive());
    });

    els.batchList.appendChild(btn);
  });

  // show active cart id in form
  els.cartId.value = state.active;
}

function loadCartToForm(c){
  if (!c) return;
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

function renderSticker(c){
  // header
  els.sFacility.textContent = state.header.facility;
  els.sDept.textContent = state.header.dept;
  els.sPhone.textContent = state.header.phone;

  // green sticker fields
  els.sFirstSupply.textContent = c.firstSupply || "—";
  els.sDate.textContent = c.date ? prettyDate(c.date) : "—";
  els.sCheckDone.textContent = c.checkDone ? prettyDate(c.checkDone) : "—";
  els.sTech.textContent = c.tech || "—";

  // orange sticker fields
  els.sFirstDrug.textContent = c.firstDrugExp ? prettyDate(c.firstDrugExp) : "—";
  els.sDrugName.textContent = c.drugName || "—";
  els.sLock.textContent = c.lockNumber || "—";
  els.sDrugCheckDone.textContent = c.drugCheckDone ? prettyDate(c.drugCheckDone) : "—";
  els.sInitials.textContent = c.initials || "—";
}

// -------- PRINT ALL (4 stickers clean) --------
function openPrintAll(){
  const html = buildPrintHTML();
  const w = window.open("", "_blank");
  if (!w) { alert("Popup blocked. Allow popups to print/export."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function buildPrintHTML(){
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
  const blocks = ids.map(id=>{
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
          <div class="row"><span>Date:</span><span class="fill">${c.date?escapeHtml(prettyDate(c.date)):"—"}</span></div>
          <div class="row"><span>Check Date done:</span><span class="fill">${c.checkDone?escapeHtml(prettyDate(c.checkDone)):"—"}</span></div>
          <div class="row"><span>CS tech:</span><span class="fill">${escapeHtml(c.tech||"—")}</span></div>
        </div>
      </div>

      <div class="sticker orange" style="margin-top:10px">
        <div class="title small">Crash Cart Check</div>
        <div class="lines">
          <div class="row"><span>First Drug to Exp:</span><span class="fill">${c.firstDrugExp?escapeHtml(prettyDate(c.firstDrugExp)):"—"}</span></div>
          <div class="row"><span>Name of Drug:</span><span class="fill">${escapeHtml(c.drugName||"—")}</span></div>
          <div class="row"><span>Lock Number:</span><span class="fill">${escapeHtml(c.lockNumber||"—")}</span></div>
          <div class="row"><span>Check done on:</span><span class="fill">${c.drugCheckDone?escapeHtml(prettyDate(c.drugCheckDone)):"—"}</span></div>
          <div class="row"><span>Initials:</span><span class="fill">${escapeHtml(c.initials||"—")}</span></div>
        </div>
      </div>
    `;
  }).join("<div style='height:14px'></div>");

  return `
  <!doctype html>
  <html><head><meta charset="utf-8"><title>Crash Cart Batch Print</title><style>${css}</style></head>
  <body>
    <button onclick="window.print()">Print / Save as PDF</button>
    <h1>Crash Cart Batch</h1>
    <div class="grid">${blocks}</div>
  </body></html>`;
}

// -------- HELPERS / STORAGE --------
function getActive(){
  return state.carts[state.active];
}

function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
}

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function prettyDate(yyyyMmDd){
  const [y,m,d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"2-digit" });
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
