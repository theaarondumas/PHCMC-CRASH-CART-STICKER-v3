/* Crash Cart Batch v1 (PHI-free) */

const STORAGE_KEY = "cc_batch_v1";

const $ = (id) => document.getElementById(id);

const state = loadState() || {
  settings: {
    defaultFacility: "Providence Holy Cross",
    defaultUnit: ""
  },
  carts: [
    makeNewCart("CC-01"),
  ],
  activeCartId: null
};

if (!state.activeCartId && state.carts.length) state.activeCartId = state.carts[0].id;

const ui = {
  // tabs
  tabs: Array.from(document.querySelectorAll(".tab")),
  panels: {
    builder: $("tab-builder"),
    batch: $("tab-batch"),
    settings: $("tab-settings")
  },

  // builder controls
  cartSelect: $("cartSelect"),
  statusBadge: $("statusBadge"),
  facility: $("facility"),
  unit: $("unit"),
  cartId: $("cartId"),
  seal: $("seal"),
  checkDate: $("checkDate"),
  checkedBy: $("checkedBy"),
  notes: $("notes"),

  // sticker preview
  sFacility: $("sFacility"),
  sUnit: $("sUnit"),
  sCartId: $("sCartId"),
  sSeal: $("sSeal"),
  sDate: $("sDate"),
  sBy: $("sBy"),
  sStatus: $("sStatus"),
  sNotes: $("sNotes"),
  summary: $("summary"),

  // supply items
  itemsBody: $("itemsBody"),

  // batch
  batchBody: $("batchBody"),

  // settings
  defaultFacility: $("defaultFacility"),
  defaultUnit: $("defaultUnit")
};

// ------------------ INIT ------------------
bindTabs();
bindButtons();
bindInputs();
renderAll();

// ------------------ TABS ------------------
function bindTabs(){
  ui.tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      ui.tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      Object.values(ui.panels).forEach(p=>p.classList.remove("active"));
      ui.panels[tab].classList.add("active");

      ui.tabs.forEach(b=>b.setAttribute("aria-selected", b === btn ? "true":"false"));
      if (tab === "batch") renderBatch();
      if (tab === "settings") renderSettings();
    });
  });
}

// ------------------ BUTTONS ------------------
function bindButtons(){
  $("btnNewCart").addEventListener("click", ()=>{
    const nextName = suggestNextCartName();
    const c = makeNewCart(nextName);
    state.carts.push(c);
    state.activeCartId = c.id;
    saveAndRender();
  });

  $("btnDupCart").addEventListener("click", ()=>{
    const a = getActiveCart();
    if (!a) return;
    const dup = structuredClone(a);
    dup.id = uid();
    dup.cartId = suggestNextCartName();
    dup.status = "Draft";
    dup.submittedAt = null;
    state.carts.push(dup);
    state.activeCartId = dup.id;
    saveAndRender();
  });

  $("btnSaveCart").addEventListener("click", ()=>{
    // already live-bound; just force save + status
    const a = getActiveCart();
    if (!a) return;
    if (a.status !== "Submitted") a.status = "Draft";
    saveAndRender();
    flashPill("Saved");
  });

  $("btnAddItem").addEventListener("click", ()=>{
    const a = getActiveCart();
    if (!a) return;
    a.items.push({ id: uid(), name:"", par:"", qty:"", status:"OK" });
    saveAndRender();
  });

  $("btnClearItems").addEventListener("click", ()=>{
    const a = getActiveCart();
    if (!a) return;
    a.items = [];
    saveAndRender();
  });

  $("btnOpenPrint").addEventListener("click", ()=>{
    const a = getActiveCart();
    if (!a) return;
    openPrintableForCarts([a], { title: "Crash Cart Sticker" });
  });

  $("btnExportCSV").addEventListener("click", ()=>{
    const a = getActiveCart();
    if (!a) return;
    downloadCSVForCarts([a], "crash_cart_single.csv");
  });

  $("btnSubmitBatch").addEventListener("click", ()=>{
    const now = new Date().toISOString();
    state.carts.forEach(c=>{
      if (c.status !== "Submitted") {
        c.status = "Submitted";
        c.submittedAt = now;
      }
    });
    saveAndRender();
    flashPill("Batch Submitted");
    // jump to batch tab visually updated
    renderBatch();
  });

  $("btnOpenBatchPrint").addEventListener("click", ()=>{
    openPrintableForCarts(state.carts, { title: "Crash Cart Batch (Printable)" });
  });

  $("btnBatchCSV").addEventListener("click", ()=>{
    downloadCSVForCarts(state.carts, "crash_cart_batch.csv");
  });

  $("btnSeedFour").addEventListener("click", ()=>{
    // Create CC-01..CC-04 if not present
    const existing = new Set(state.carts.map(c=>c.cartId));
    ["CC-01","CC-02","CC-03","CC-04"].forEach(name=>{
      if (!existing.has(name)) state.carts.push(makeNewCart(name));
    });
    if (!state.activeCartId && state.carts.length) state.activeCartId = state.carts[0].id;
    saveAndRender();
  });

  $("btnClearAll").addEventListener("click", ()=>{
    if (!confirm("Clear ALL local data? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  ui.cartSelect.addEventListener("change", ()=>{
    state.activeCartId = ui.cartSelect.value;
    saveAndRender();
  });
}

// ------------------ INPUTS (LIVE WRITE TO STICKER FIX) ------------------
function bindInputs(){
  const handlers = [
    ["facility", "facility"],
    ["unit", "unit"],
    ["cartId", "cartId"],
    ["seal", "seal"],
    ["checkDate", "checkDate"],
    ["checkedBy", "checkedBy"],
    ["notes", "notes"]
  ];

  handlers.forEach(([inputId, key])=>{
    $(inputId).addEventListener("input", (e)=>{
      const a = getActiveCart();
      if (!a) return;
      if (a.status === "Submitted") return; // lock submitted carts
      a[key] = e.target.value;
      if (a.status !== "Submitted") a.status = "Draft";
      saveAndRender(false); // avoid full redraw loops
      renderSticker(a);     // ensure sticker updates instantly
      renderSummary(a);
    });
  });

  // settings
  ui.defaultFacility.addEventListener("input", (e)=>{
    state.settings.defaultFacility = e.target.value;
    saveState();
  });
  ui.defaultUnit.addEventListener("input", (e)=>{
    state.settings.defaultUnit = e.target.value;
    saveState();
  });
}

// ------------------ RENDER ------------------
function renderAll(){
  renderCartSelect();
  const a = getActiveCart();
  renderForm(a);
  renderSticker(a);
  renderItemsTable(a);
  renderSummary(a);
  renderBatch();
  renderSettings();
}

function saveAndRender(full=true){
  saveState();
  if (full) renderAll();
}

function renderCartSelect(){
  ui.cartSelect.innerHTML = "";
  state.carts.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.cartId || "Unnamed"} • ${c.unit || "—"} • ${c.status}`;
    ui.cartSelect.appendChild(opt);
  });
  ui.cartSelect.value = state.activeCartId;
}

function renderForm(cart){
  if (!cart) return;

  ui.statusBadge.value = cart.status || "Draft";

  // lock if submitted
  const locked = cart.status === "Submitted";
  [ui.facility, ui.unit, ui.cartId, ui.seal, ui.checkDate, ui.checkedBy, ui.notes].forEach(el=>{
    el.disabled = locked;
  });

  ui.facility.value  = cart.facility ?? "";
  ui.unit.value      = cart.unit ?? "";
  ui.cartId.value    = cart.cartId ?? "";
  ui.seal.value      = cart.seal ?? "";
  ui.checkDate.value = cart.checkDate ?? "";
  ui.checkedBy.value = cart.checkedBy ?? "";
  ui.notes.value     = cart.notes ?? "";
}

function renderSticker(cart){
  if (!cart) return;

  ui.sFacility.textContent = cart.facility || state.settings.defaultFacility || "—";
  ui.sUnit.textContent = cart.unit || "—";
  ui.sCartId.textContent = cart.cartId || "—";
  ui.sSeal.textContent = cart.seal || "—";

  ui.sDate.textContent = cart.checkDate ? formatDate(cart.checkDate) : "—";
  ui.sBy.textContent = cart.checkedBy || "—";

  ui.sStatus.textContent = cart.status || "Draft";
  ui.sNotes.textContent = cart.notes || "—";

  // status badge styling
  ui.statusBadge.value = cart.status || "Draft";
}

function renderItemsTable(cart){
  ui.itemsBody.innerHTML = "";
  if (!cart) return;

  cart.items.forEach(item=>{
    const tr = document.createElement("tr");

    tr.appendChild(tdInput(item, "name", "Item name"));
    tr.appendChild(tdInput(item, "par", "Par"));
    tr.appendChild(tdInput(item, "qty", "Qty"));
    tr.appendChild(tdSelect(item, "status", ["OK","LOW","OUT","NEEDS REPLENISH"]));

    const td = document.createElement("td");
    const btn = document.createElement("button");
    btn.className = "btn ghost";
    btn.textContent = "Remove";
    btn.addEventListener("click", ()=>{
      if (cart.status === "Submitted") return;
      cart.items = cart.items.filter(x=>x.id !== item.id);
      saveAndRender();
    });
    td.appendChild(btn);
    tr.appendChild(td);

    ui.itemsBody.appendChild(tr);
  });
}

function renderSummary(cart){
  if (!cart) { ui.summary.textContent = ""; return; }

  const items = cart.items || [];
  const low = items.filter(i=>String(i.status||"").includes("LOW") || String(i.status||"").includes("OUT") || String(i.status||"").includes("NEEDS")).length;

  ui.summary.innerHTML = `
    <div><span class="muted">Facility:</span> ${escapeHtml(cart.facility || state.settings.defaultFacility || "—")}</div>
    <div><span class="muted">Unit:</span> ${escapeHtml(cart.unit || "—")}</div>
    <div><span class="muted">Cart:</span> ${escapeHtml(cart.cartId || "—")}</div>
    <div><span class="muted">Seal:</span> ${escapeHtml(cart.seal || "—")}</div>
    <div><span class="muted">Checked:</span> ${cart.checkDate ? formatDate(cart.checkDate) : "—"} <span class="muted">by</span> ${escapeHtml(cart.checkedBy || "—")}</div>
    <div><span class="muted">Items:</span> ${items.length} total • ${low} flagged</div>
    <div><span class="muted">Status:</span> ${escapeHtml(cart.status || "Draft")} ${cart.submittedAt ? `• <span class="muted">Submitted</span> ${new Date(cart.submittedAt).toLocaleString()}` : ""}</div>
  `;
}

function renderBatch(){
  ui.batchBody.innerHTML = "";
  state.carts.forEach(c=>{
    const tr = document.createElement("tr");

    tr.appendChild(tdText(c.cartId || "—"));
    tr.appendChild(tdText(c.unit || "—"));
    tr.appendChild(tdText(c.seal || "—"));
    tr.appendChild(tdText(c.checkedBy || "—"));
    tr.appendChild(tdText(c.checkDate ? formatDate(c.checkDate) : "—"));
    tr.appendChild(tdText(c.status || "Draft"));
    tr.appendChild(tdText(c.submittedAt ? new Date(c.submittedAt).toLocaleString() : "—"));

    const td = document.createElement("td");
    const openBtn = document.createElement("button");
    openBtn.className = "btn";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", ()=>{
      state.activeCartId = c.id;
      saveAndRender();
      // switch to builder tab
      document.querySelector('.tab[data-tab="builder"]').click();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.textContent = "Delete";
    delBtn.style.marginLeft = "8px";
    delBtn.addEventListener("click", ()=>{
      if (!confirm(`Delete ${c.cartId || "this cart"}?`)) return;
      state.carts = state.carts.filter(x=>x.id !== c.id);
      if (!state.carts.length) state.carts.push(makeNewCart("CC-01"));
      state.activeCartId = state.carts[0].id;
      saveAndRender();
    });

    td.appendChild(openBtn);
    td.appendChild(delBtn);
    tr.appendChild(td);

    ui.batchBody.appendChild(tr);
  });
}

function renderSettings(){
  ui.defaultFacility.value = state.settings.defaultFacility || "";
  ui.defaultUnit.value = state.settings.defaultUnit || "";
}

// ------------------ TABLE CELL HELPERS ------------------
function tdInput(item, key, placeholder){
  const td = document.createElement("td");
  const input = document.createElement("input");
  input.value = item[key] ?? "";
  input.placeholder = placeholder;
  input.addEventListener("input", (e)=>{
    const cart = getActiveCart();
    if (!cart || cart.status === "Submitted") return;
    item[key] = e.target.value;
    cart.status = "Draft";
    saveAndRender(false);
    renderSummary(cart);
  });
  td.appendChild(input);
  return td;
}

function tdSelect(item, key, options){
  const td = document.createElement("td");
  const sel = document.createElement("select");
  options.forEach(opt=>{
    const o = document.createElement("option");
    o.value = opt; o.textContent = opt;
    sel.appendChild(o);
  });
  sel.value = item[key] ?? options[0];
  sel.addEventListener("change", (e)=>{
    const cart = getActiveCart();
    if (!cart || cart.status === "Submitted") return;
    item[key] = e.target.value;
    cart.status = "Draft";
    saveAndRender(false);
    renderSummary(cart);
  });
  td.appendChild(sel);
  return td;
}

function tdText(text){
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

// ------------------ EXPORTS ------------------
function openPrintableForCarts(carts, { title } = {}){
  const html = buildPrintableHTML(carts, title || "Crash Cart Printable");
  const w = window.open("", "_blank");
  if (!w) { alert("Popup blocked. Allow popups to open printable view."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function downloadCSVForCarts(carts, filename){
  const rows = [];
  rows.push([
    "facility","unit","cartId","seal","checkDate","checkedBy","notes","status","submittedAt",
    "itemName","par","qty","itemStatus"
  ]);

  carts.forEach(c=>{
    if (!c.items || !c.items.length) {
      rows.push([
        c.facility||"", c.unit||"", c.cartId||"", c.seal||"", c.checkDate||"", c.checkedBy||"",
        c.notes||"", c.status||"", c.submittedAt||"", "", "", "", ""
      ]);
      return;
    }
    c.items.forEach(it=>{
      rows.push([
        c.facility||"", c.unit||"", c.cartId||"", c.seal||"", c.checkDate||"", c.checkedBy||"",
        c.notes||"", c.status||"", c.submittedAt||"",
        it.name||"", it.par||"", it.qty||"", it.status||""
      ]);
    });
  });

  const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
  downloadText(csv, filename, "text/csv;charset=utf-8;");
}

function buildPrintableHTML(carts, title){
  const css = `
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:24px;color:#111}
    h1{margin:0 0 12px}
    .meta{color:#444;margin:0 0 18px}
    table{width:100%;border-collapse:collapse;margin:14px 0 22px}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    th{background:#f6f6f6;text-transform:uppercase;font-size:12px;letter-spacing:.4px}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#eee;font-weight:700}
    .ok{background:#dcfce7}
    .draft{background:#fef3c7}
    .sub{background:#dbeafe}
    @media print{button{display:none}}
  `;

  const now = new Date().toLocaleString();

  const cartRows = carts.map(c=>{
    const cls = (c.status === "Submitted") ? "sub" : "draft";
    const submitted = c.submittedAt ? new Date(c.submittedAt).toLocaleString() : "—";
    return `
      <tr>
        <td>${escapeHtml(c.facility || "")}</td>
        <td>${escapeHtml(c.unit || "")}</td>
        <td>${escapeHtml(c.cartId || "")}</td>
        <td>${escapeHtml(c.seal || "")}</td>
        <td>${c.checkDate ? escapeHtml(formatDate(c.checkDate)) : "—"}</td>
        <td>${escapeHtml(c.checkedBy || "")}</td>
        <td><span class="badge ${cls}">${escapeHtml(c.status || "Draft")}</span></td>
        <td>${escapeHtml(submitted)}</td>
        <td>${escapeHtml(c.notes || "")}</td>
      </tr>
    `;
  }).join("");

  const itemRows = carts.flatMap(c=>{
    const items = c.items || [];
    if (!items.length) {
      return [`
        <tr>
          <td>${escapeHtml(c.cartId || "")}</td>
          <td colspan="4" style="color:#666">No supply items logged</td>
        </tr>
      `];
    }
    return items.map(it=>`
      <tr>
        <td>${escapeHtml(c.cartId || "")}</td>
        <td>${escapeHtml(it.name || "")}</td>
        <td>${escapeHtml(it.par || "")}</td>
        <td>${escapeHtml(it.qty || "")}</td>
        <td>${escapeHtml(it.status || "")}</td>
      </tr>
    `);
  }).join("");

  return `
  <!doctype html>
  <html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style></head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">Generated: ${escapeHtml(now)} • PHI-free</p>
    <button onclick="window.print()">Print / Save as PDF</button>

    <h2>Carts</h2>
    <table>
      <thead>
        <tr>
          <th>Facility</th><th>Unit</th><th>Cart</th><th>Seal</th><th>Check Date</th><th>Checked By</th>
          <th>Status</th><th>Submitted</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>${cartRows}</tbody>
    </table>

    <h2>Supply Items</h2>
    <table>
      <thead>
        <tr><th>Cart</th><th>Item</th><th>Par</th><th>Qty</th><th>Status</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </body></html>
  `;
}

// ------------------ STATE ------------------
function getActiveCart(){
  return state.carts.find(c=>c.id === state.activeCartId) || state.carts[0] || null;
}

function makeNewCart(cartId){
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,"0");
  const dd = String(today.getDate()).padStart(2,"0");

  return {
    id: uid(),
    facility: state.settings?.defaultFacility || "Providence Holy Cross",
    unit: state.settings?.defaultUnit || "",
    cartId: cartId || "",
    seal: "",
    checkDate: `${yyyy}-${mm}-${dd}`,
    checkedBy: "",
    notes: "",
    status: "Draft",
    submittedAt: null,
    items: []
  };
}

function suggestNextCartName(){
  // tries CC-01..CC-99
  const existing = new Set(state.carts.map(c=>c.cartId).filter(Boolean));
  for (let i=1; i<=99; i++){
    const name = `CC-${String(i).padStart(2,"0")}`;
    if (!existing.has(name)) return name;
  }
  return `CC-${Date.now()}`;
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

// ------------------ UTIL ------------------
function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function formatDate(yyyyMmDd){
  // yyyy-mm-dd -> MMM d, yyyy
  const [y,m,d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, (m-1), d);
  return dt.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}

function flashPill(text){
  const prev = ui.statusBadge.value;
  ui.statusBadge.value = text;
  setTimeout(()=>{ ui.statusBadge.value = prev; }, 700);
}

function csvEscape(v){
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"','""')}"`;
  return s;
}

function downloadText(text, filename, mime){
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
