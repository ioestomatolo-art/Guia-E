
// Obtiene el inventario previamente guardado de un hospital específico
async function cargarInventarioDesdeDB(hospitalClave, categoria) {
  if (!hospitalClave) return [];
  try {
    let url = `${INVENTORY_GET_URL}?hospitalClave=${encodeURIComponent(hospitalClave)}`;
    if (categoria) {
      url += `&categoria=${encodeURIComponent(categoria)}`;
    }
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return []; // Si no hay registros previos para el hospital
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  } catch (error) {
    console.warn("No se pudo obtener el inventario previo del servidor:", error);
    return [];
  }
}

// ---- INVENTORY: cargar y poblar 
async function loadInventoryAndPopulate(hospitalClaveOrName, categoria) {
  if (!hospitalClaveOrName || !categoria) return;

  try {
    const catTarget = cleanCategoryStr(categoria);

    // 1. Obtener el catálogo maestro de productos primero
    const catalogoProductos = await cargarCatalogoProductosDB();
    catalogo[categoria] = catalogoProductos.filter(p =>
      cleanCategoryStr(p.categoria) === catTarget
    );

    // 2. Consultar registros en BD pasando hospital y categoría
    const registrosHospital = await cargarInventarioDesdeDB(hospitalClaveOrName, categoria);

    // 3. Filtrado permisivo: si el ítem de la BD no trae explícitamente el campo 'categoria', 
    // se conserva (asumiendo que la consulta en backend ya los filtró por categoría).
    const registrosCat = registrosHospital.filter(r => {
      if (!r.categoria) return true;
      return cleanCategoryStr(r.categoria) === catTarget;
    });

    limpiarTabla();

    // --- CASO A: Si no hay registros guardados en la BD ---
    if (registrosCat.length === 0) {
      agregarFila();
      return;
    }

    // --- CASO B: Si hay registros en la BD -> Pintar filas con datos ---
    for (const item of registrosCat) {
      agregarFila();
      const tr = tbody.rows[tbody.rows.length - 1];
      if (!tr) continue;

      const selectEl = tr.cells[1].querySelector("select");
      const inputDescEl = tr.cells[2].querySelector("input");
      const inputStockEl = tr.cells[3].querySelector("input");
      const inputMinEl = tr.cells[4].querySelector("input");
      const inputFechaEl = tr.cells[6].querySelector("input");
      const inputDiasEl = tr.cells[7].querySelector("input");
      const textareaObs = tr.cells[tr.cells.length - 2].querySelector("textarea");

      const clave = String(item.clave || "").trim();

      // Mapeo seguro de valores del backend
      inputDescEl.value = item.descripcion || "";
      inputStockEl.value = item.stock ?? "";
      inputMinEl.value = item.minimo ?? item.stock_minimo ?? getMinimoValue(clave) ?? "";
      inputFechaEl.value = item.fecha || item.caducidad || "";
      inputDiasEl.value = item.dias_restantes ?? item.dias ?? "";
      textareaObs.value = item.observaciones ?? "";

      if (item.uid) tr.dataset.uid = item.uid;
      if (item.manual) tr.dataset.manual = "true";

      // Asignar el valor de la clave en el select desplegable
      if (selectEl) {
        let matchedOpt = Array.from(selectEl.options).find(o => {
          const valClave = (o.value || "").split("||")[0].trim();
          return valClave === clave;
        });

        if (matchedOpt) {
          selectEl.value = matchedOpt.value;
        } else if (clave) {
          const opt = document.createElement("option");
          opt.value = `${clave}||${selectEl.options.length}`;
          opt.textContent = clave;
          selectEl.appendChild(opt);
          selectEl.value = opt.value;
        }
      }

      actualizarFila(tr);
    }

    sortRowsByCaducidad();
    refreshDisabledOptions();
  } catch (err) {
    console.error("loadInventoryAndPopulate error:", err);
    limpiarTabla();
    agregarFila();
  }
}




async function cargarCatalogoProductosDB() {
  try {
    const res = await fetch(`${SERVER_BASE}/productos-catalogo`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("No se pudo cargar el catálogo de productos:", err);
    return [];
  }
}

  // ======== Config ========
  let categoriaActiva = null;
  let filaContador = 0;
  let lastAddTime = 0;
  let hospitales = [];
  let selectedHospitalClave = "";
  let rowCreationCounter = 0;



  let catalogo = {
    material: [],
    equipo: [],
    mobiliario: [],
    bienesInformaticos: [],
    instrumental: []
  };




  const SERVER_BASE = "https://servidor-4wu6.onrender.com";
  const HOSPITALES_URL = "https://servidor-4wu6.onrender.com/hospitales";
  const INVENTORY_GET_URL = `${SERVER_BASE}/inventory`;
  const INVENTORY_POST_URL = `${SERVER_BASE}/inventory`;
  const INVENTORY_DELETE_ITEM_URL = `${SERVER_BASE}/inventory/item/delete`;
  const CLIENT_API_TOKEN = "";

  const adquisicionCats = new Set(["equipo", "mobiliario", "bienesInformaticos", "instrumental"]);

  // placeholder de catálogo (mantener o rellenar con tus datos)
 
    // -----------------------------------------------------------------------------------------------
    
    // ------------------ MINIMOS DEFINIDOS (categoria: material) ------------------
    // Lista provista ; mantenida aquí como referencia para rellenar "mínimo" en 'material'.
   
  const fallbackHospitals = [
    { nombre: "Hospital General Boca del Río", clave: "VZIM010212" },
    { nombre: "Hospital General Martínez de la Torre", clave: "VZIM003361" }
  ];

  // ================= DOM =================
  const selCategoria = document.getElementById("categoria");
  const btnSiguiente = document.getElementById("btnSiguiente");
  const btnRegresar = document.getElementById("btnRegresar1");
  const btnAgregar = document.getElementById("btnAgregarFila");
  const tbody = document.querySelector("#tablaInsumos tbody");
  const tituloCategoria = document.getElementById("tituloCategoria");
  const tabla = document.getElementById("tablaInsumos");
  const btnEnviar = document.getElementById("btnEnviarInsumos");
  const inputHospital = document.getElementById("hospitalNombre");
  const datalistHospitales = document.getElementById("listaHospitales");

  let btnAgregarManual = null;
  let btnDescargarPage1 = null;

  function safeEscapeCss(s) { try { return CSS.escape(s); } catch(e) { return String(s).replace(/[[\\\]"']/g,"\\$&"); } }

  function ensureHeaders() {
    if (!tabla) return;
    const thead = tabla.querySelector("thead");
    if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th")).map(t => (t.textContent||"").trim().toLowerCase());
    if (!ths.includes("observaciones")) {
      const th = document.createElement("th"); th.textContent = "Observaciones"; thead.querySelector("tr").appendChild(th);
    }
    
  }
  ensureHeaders();

  function genUid() { return `uid-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

  function updateCaducidadHeader() {
    if (!tabla) return;
    const thead = tabla.querySelector("thead"); if (!thead) return;
    const ths = Array.from(thead.querySelectorAll("th"));
    const idx = ths.findIndex(t => ((t.textContent||"").trim().toLowerCase().includes("caduc")));
    const idxFecha = idx >= 0 ? idx : ths.findIndex(t => ((t.textContent||"").trim().toLowerCase().includes("fecha")));
    const targetIndex = idx >= 0 ? idx : idxFecha;
    if (targetIndex === -1) return;
    const isAdq = adquisicionCats.has(categoriaActiva);
    thead.querySelectorAll("th")[targetIndex].textContent = isAdq ? "Fecha de adquisición" : "Caducidad";
    const diasIdx = targetIndex + 1;
    if (thead.querySelectorAll("th")[diasIdx]) thead.querySelectorAll("th")[diasIdx].textContent = isAdq ? "Días desde adquisición" : "Días restantes";
  }

  function moveButtonsToCardBottom() {
    const page2 = document.getElementById("page2"); if (!page2 || !tabla) return;
    const card = page2.querySelector(".card") || page2;
    let bottom = card.querySelector("#controls-bottom");
    if (!bottom) {
      bottom = document.createElement("div");
      bottom.id = "controls-bottom";
      bottom.style.display = "flex";
      bottom.style.justifyContent = "flex-end";
      bottom.style.gap = "8px";
      bottom.style.marginTop = "12px";
      if (tabla.parentElement && tabla.parentElement === card) card.insertBefore(bottom, tabla.nextSibling);
      else card.appendChild(bottom);
    }

    if (!btnAgregarManual) {
      btnAgregarManual = document.createElement("button");
      btnAgregarManual.id = "btnAgregarManual";
      btnAgregarManual.textContent = "Agregar no listado";
      btnAgregarManual.title = "Agregar producto que no está en la lista (se genera clave automática)";
      btnAgregarManual.addEventListener("click", (ev) => {
        ev && ev.preventDefault();
        if (!categoriaActiva) { alert("Selecciona primero una categoría."); return; }
        const now = Date.now(); if (now - lastAddTime < 250) return; lastAddTime = now;
        btnAgregarManual.disabled = true; setTimeout(()=>btnAgregarManual.disabled=false,300);
        agregarFilaManual();
      });
    }

    let btnEliminarSeleccionados = document.getElementById("btnEliminarSeleccionados");
    if (!btnEliminarSeleccionados) {
      btnEliminarSeleccionados = document.createElement("button");
      btnEliminarSeleccionados.id = "btnEliminarSeleccionados";
      btnEliminarSeleccionados.textContent = "Eliminar seleccionados";
      btnEliminarSeleccionados.title = "Eliminar filas marcadas";
      btnEliminarSeleccionados.style.background = "#fee2e2";
      btnEliminarSeleccionados.style.color = "#7f1d1d";
      btnEliminarSeleccionados.style.border = "none";
      btnEliminarSeleccionados.style.padding = "8px 12px";
      btnEliminarSeleccionados.style.borderRadius = "8px";
      btnEliminarSeleccionados.addEventListener("click", (ev) => { ev&&ev.preventDefault(); deleteSelectedRows(); });
    }

    const btns = [btnRegresar, btnAgregar, btnAgregarManual, btnEnviar, btnEliminarSeleccionados];
    btns.forEach(b => {
      if (!b) return;
      if (b.parentElement !== bottom) bottom.appendChild(b);
      b.style.borderRadius = "8px";
      b.style.padding = "8px 14px";
      b.style.fontSize = "0.95rem";
      b.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
      b.style.border = "none";
      b.style.cursor = "pointer";
      if (b === btnEnviar) { b.style.background = "#b91c6a"; b.style.color = "#fff"; }
      else { b.style.background = "#f3f4f6"; b.style.color = "#0b1220"; }
    });

    try {
      const page1 = document.getElementById("page1");
      const card1 = page1.querySelector(".card");
      let actions = card1.querySelector(".actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "actions";
        actions.style.marginTop = "12px";
        actions.style.display = "flex";
        actions.style.justifyContent = "flex-end";
        card1.appendChild(actions);
      }
      
       

       //================
       const btnAdminAccess = document.getElementById("btnAdminAccess");
if (btnAdminAccess) {
  btnAdminAccess.addEventListener("click", () => {
    window.location.href = "./admin.html";
  });
}
//=======================
    } catch (e) {
      console.warn("No se pudo crear botón de descarga en page1:", e);
    }




// =================== ADMIN PANEL ===================
const ADMIN_LOGIN_URL = `${SERVER_BASE}/admin/login`;
const ADMIN_SUBMISSIONS_URL = `${SERVER_BASE}/submissions`;
const ADMIN_REPORT_URL = `${SERVER_BASE}/report/inventory?format=csv`;

let adminToken = localStorage.getItem("adminToken") || "";

const btnAdminAccess = document.getElementById("btnAdminAccess");
const adminModal = document.getElementById("adminModal");
const adminPass = document.getElementById("adminPass");
const btnAdminLogin = document.getElementById("btnAdminLogin");
const btnAdminClose = document.getElementById("btnAdminClose");
const adminMsg = document.getElementById("adminMsg");

const adminSection = document.getElementById("adminSection");
const adminTableBody = document.querySelector("#adminTable tbody");
const btnAdminReload = document.getElementById("btnAdminReload");
const btnAdminReport = document.getElementById("btnAdminReport");
const btnAdminLogout = document.getElementById("btnAdminLogout");

function openAdminModal() {
  if (!adminModal) return;
  adminMsg.textContent = "";
  adminPass.value = "";
  adminModal.classList.remove("oculto");
  adminModal.setAttribute("aria-hidden", "false");
  setTimeout(() => adminPass.focus(), 50);
}

function closeAdminModal() {
  if (!adminModal) return;
  adminModal.classList.add("oculto");
  adminModal.setAttribute("aria-hidden", "true");
}

function showAdminSection() {
  if (adminSection) {
    adminSection.classList.remove("oculto");
    adminSection.classList.add("activo");
  }
}

function hideAdminSection() {
  if (adminSection) {
    adminSection.classList.add("oculto");
    adminSection.classList.remove("activo");
  }
}

function adminHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-admin-token": adminToken,
    ...extra
  };
}

async function loginAdmin() {
  const password = (adminPass.value || "").trim();
  if (!password) {
    adminMsg.textContent = "Escribe la contraseña.";
    return;
  }

  adminMsg.textContent = "Validando...";
  try {
    const res = await fetch(ADMIN_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.token) {
      adminMsg.textContent = "Contraseña incorrecta.";
      return;
    }

    adminToken = data.token;
    localStorage.setItem("adminToken", adminToken);
    adminMsg.textContent = "";
    closeAdminModal();
    showAdminSection();
    await loadAdminSubmissions();
  } catch (err) {
    console.error("Error login admin:", err);
    adminMsg.textContent = "No fue posible conectar con el servidor.";
  }
}

async function loadAdminInventory() {
  if (!adminTableBody) return;
  adminTableBody.innerHTML = "";

  try {
    const res = await fetch(ADMIN_INVENTORY_URL, {
      method: "GET",
      headers: { "x-admin-token": adminToken }
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const list = Array.isArray(data) ? data : [];

    if (!list.length) {
      adminTableBody.innerHTML = `<tr><td colspan="10">Sin registros</td></tr>`;
      return;
    }

    for (const item of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(item.hospital_clave || item.hospitalClave || "")}</td>
        <td>${escapeHtml(item.hospital_nombre || item.hospitalNombre || "")}</td>
        <td>${escapeHtml(item.categoria || "")}</td>
        <td>${escapeHtml(item.clave || "")}</td>
        <td>${escapeHtml(item.descripcion || "")}</td>
        <td>${escapeHtml(item.stock ?? "")}</td>
        <td>${escapeHtml(item.minimo ?? "")}</td>
        <td>${escapeHtml(item.fecha || "")}</td>
        <td>${escapeHtml(item.dias_restantes ?? item.dias ?? "")}</td>
        <td>${escapeHtml(item.observaciones || "")}</td>
      `;
      adminTableBody.appendChild(tr);
    }
  } catch (err) {
    console.error("Error cargando inventario admin:", err);
    adminTableBody.innerHTML = `<tr><td colspan="10">Error al cargar registros</td></tr>`;
  }
}

async function downloadAdminReport() {
  try {
    const res = await fetch(ADMIN_REPORT_URL, {
      method: "GET",
      headers: { "x-admin-token": adminToken }
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_admin_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Error descargando reporte admin:", err);
    alert("No fue posible descargar el reporte.");
  }
}

btnAdminAccess && btnAdminAccess.addEventListener("click", openAdminModal);
btnAdminClose && btnAdminClose.addEventListener("click", closeAdminModal);
btnAdminLogin && btnAdminLogin.addEventListener("click", loginAdmin);
adminPass && adminPass.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginAdmin();
});

btnAdminReload && btnAdminReload.addEventListener("click", loadAdminSubmissions);
btnAdminReport && btnAdminReport.addEventListener("click", downloadAdminReport);

btnAdminLogout && btnAdminLogout.addEventListener("click", () => {
  localStorage.removeItem("adminToken");
  adminToken = "";
  hideAdminSection();
  openAdminModal();
});

if (adminToken) {
  showAdminSection();
  loadAdminSubmissions();
} else {
  hideAdminSection();
}




  }

  moveButtonsToCardBottom();

  // -------------------------
  // Normalización y búsqueda de hospitales (EXACT MATCH required)
  // -------------------------
  function stripAccents(str) {
    if (str === null || str === undefined) return "";
    return String(str).normalize ? String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : String(str);
  }
  function normalizeStr(s) {
    return stripAccents(String(s || "")).trim().toLowerCase();
  }

  let hospitalesIndex = []; // { nombre, clave, norm }
  function buildHospitalIndex() {
    hospitalesIndex = (hospitales || []).map(h => ({
      nombre: (h.nombre || "").trim(),
      clave: (h.clave || "").trim(),
      norm: normalizeStr(h.nombre || h.clave || "")
    }));
  }

  // Busca coincidencia exacta normalizada (nombre o clave)
  function findExactHospitalMatch(input) {
    if (!input) return null;
    const q = normalizeStr(input);
    if (!q) return null;
    return hospitalesIndex.find(h => (h.norm === q) || (normalizeStr(h.clave) === q)) || null;
  }

  function ensureHospitalStatusEl() {
    if (!inputHospital) return null;
    let el = document.getElementById("hospital-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "hospital-status";
      el.style.marginTop = "6px";
      el.style.fontSize = "0.92rem";
      el.style.minHeight = "1.1rem";
      inputHospital.parentElement && inputHospital.parentElement.appendChild(el);
    }
    return el;
  }
  function showHospitalStatus(msg, ok) {
    const el = ensureHospitalStatusEl();
    if (!el) return;
    el.textContent = msg || "";
    el.style.color = ok ? "#065f46" : "#92400e";
  }
  function updateHospitalValidationUI() {
    const v = (inputHospital.value || "").trim();
  
    if (!v) {
      selectedHospitalClave = "";
      showHospitalStatus("Ingresa o selecciona un hospital de la lista.", false);
      btnSiguiente.disabled = true;
      return;
    }
  
    const match = findExactHospitalMatch(v);
  
    if (match) {
      selectedHospitalClave = match.clave || "";
      showHospitalStatus(`Hospital válido: ${match.nombre} (${selectedHospitalClave})`, true);
      btnSiguiente.disabled = false;
    } else {
      selectedHospitalClave = "";
      showHospitalStatus("Hospital no reconocido. Selecciona exactamente uno de los hospitales del listado.", false);
      btnSiguiente.disabled = true;
    }
  }
  // NAV: ahora Siguiente sólo avanza si selectedHospitalClave está presente (match exacto)
  btnSiguiente.onclick = async (ev) => {
    ev && ev.preventDefault();
  
    const cat = selCategoria.value;
    if (!cat) return alert("Selecciona una categoría.");
  
    updateHospitalValidationUI();
    if (!selectedHospitalClave) {
      inputHospital.focus();
      return alert("Selecciona un hospital válido de la lista antes de continuar.");
    }
  
    const categoriaCambio = categoriaActiva && categoriaActiva !== cat;
    if (categoriaCambio) limpiarTabla();
  
    categoriaActiva = cat;
    tituloCategoria.textContent = `Formulario de ${selCategoria.options[selCategoria.selectedIndex].text}`;
  
    try {
      await loadInventoryAndPopulate(selectedHospitalClave, categoriaActiva);
    } catch (err) {
      console.warn("No se pudo cargar inventory:", err);
    }
  
    document.getElementById("page1").classList.remove("activo");
    document.getElementById("page1").classList.add("oculto");
    document.getElementById("page2").classList.remove("oculto");
    document.getElementById("page2").classList.add("activo");
  
    updateCaducidadHeader();
    if (!tbody.rows.length) agregarFila();
    moveButtonsToCardBottom();
    sortRowsByCaducidad();
  };

  btnRegresar.onclick = (ev) => {
    ev && ev.preventDefault();
    document.getElementById("page2").classList.remove("activo"); document.getElementById("page2").classList.add("oculto");
    document.getElementById("page1").classList.remove("oculto"); document.getElementById("page1").classList.add("activo");
    updateCaducidadHeader();
  };

  function limpiarTabla() { if (tbody) tbody.innerHTML = ""; filaContador = 0; refreshDisabledOptions(); }

  btnAgregar.onclick = (ev) => {
    ev && ev.preventDefault();
    if (!categoriaActiva) { alert("Selecciona primero una categoría."); return; }
    const now = Date.now(); if (now - lastAddTime < 250) return; lastAddTime = now;
    btnAgregar.disabled = true; setTimeout(()=>btnAgregar.disabled=false,300);
    agregarFila();
    sortRowsByCaducidad();
  };

  function getAllSelects() { return Array.from(tbody.querySelectorAll("select")); }

  function refreshDisabledOptions() {
    const selects = getAllSelects();
    const selectedValues = selects.map(s => s.value).filter(v => v && v !== "");
    selects.forEach(s => {
      Array.from(s.options).forEach(opt => {
        if (!opt.value) { opt.disabled = false; return; }
        const chosenElsewhere = selectedValues.includes(opt.value) && s.value !== opt.value;
        opt.disabled = !!chosenElsewhere;
      });
      if (s.value) {
        const selectedOption = s.querySelector(`option[value="${safeEscapeCss(s.value)}"]`);
        if (selectedOption) selectedOption.disabled = false;
      }
    });
  }

  function getMinimoValue(clave) {
    if (!clave) return "";
    if (typeof minimosDefinidos !== "undefined" && minimosDefinidos.hasOwnProperty(clave)) return String(minimosDefinidos[clave]);
    return "";
  }

  function renumerarFilas() {
    filaContador = 0;
    for (const r of tbody.rows) { filaContador++; const noCell = r.cells[0]; if (noCell) noCell.textContent = filaContador; }
  }

  function getRowDateValue(tr) {
    try {
      const inputCad = tr.cells[6].querySelector("input");
      const v = inputCad ? (inputCad.value || "").trim() : "";
      if (!v) return Number.POSITIVE_INFINITY;
      const d = new Date(v);
      if (isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
      return d.setHours(0,0,0,0);
    } catch (e) {
      return Number.POSITIVE_INFINITY;
    }
  }

  function sortRowsByCaducidad() {
    if (!tbody) return;
    const rows = Array.from(tbody.rows);
    if (!rows.length) return;
    rows.sort((a,b) => {
      const da = getRowDateValue(a);
      const db = getRowDateValue(b);
      if (da === db) {
        const oa = parseInt(a.dataset.order || "0", 10);
        const ob = parseInt(b.dataset.order || "0", 10);
        return oa - ob;
      }
      return da - db;
    });
    const fragment = document.createDocumentFragment();
    rows.forEach(r => fragment.appendChild(r));
    tbody.appendChild(fragment);
    renumerarFilas();
    refreshDisabledOptions();
  }

  // Construye fila estándar
  function agregarFila() {
    filaContador++;
    rowCreationCounter++;
    const tr = document.createElement("tr");
    tr.dataset.order = String(rowCreationCounter);

    // No.
    const tdNo = document.createElement("td"); tdNo.textContent = filaContador; tr.appendChild(tdNo);

    // Clave (select)
    const tdClave = document.createElement("td");
    const select = document.createElement("select");
    const optDefault = document.createElement("option"); optDefault.value = ""; optDefault.textContent = "--Seleccione--"; select.appendChild(optDefault);
    if (catalogo[categoriaActiva] && catalogo[categoriaActiva].length > 0) {
      catalogo[categoriaActiva].forEach((p, idx) => {
        const o = document.createElement("option");
        o.value = `${p.clave}||${idx}`;
        o.textContent = p.clave;
        o.dataset.descripcion = p.descripcion || "";
        o.dataset.idx = String(idx);
        select.appendChild(o);
      });
    }
    tdClave.appendChild(select); tr.appendChild(tdClave);

    // Descripción
    const tdDesc = document.createElement("td");
    const inputDesc = document.createElement("input"); inputDesc.type = "text"; inputDesc.placeholder = "Escribe descripción o selecciona sugerencia"; inputDesc.tabIndex = 0;
    const datalistId = `datalist-desc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const dl = document.createElement("datalist"); dl.id = datalistId;
    if (catalogo[categoriaActiva]) catalogo[categoriaActiva].forEach(p => { const opt = document.createElement("option"); opt.value = p.descripcion; dl.appendChild(opt); });
    inputDesc.setAttribute("list", datalistId);
    tdDesc.appendChild(inputDesc); tdDesc.appendChild(dl); tr.appendChild(tdDesc);

    // Stock
    const tdStock = document.createElement("td"); const inputStock = document.createElement("input"); inputStock.type = "number"; inputStock.min = 0; tdStock.appendChild(inputStock); tr.appendChild(tdStock);

    // Min
    const tdMin = document.createElement("td"); const inputMin = document.createElement("input"); inputMin.type = "number"; inputMin.min = 0; inputMin.readOnly = true; inputMin.style.background="#f3f4f6"; inputMin.style.cursor="not-allowed"; tdMin.appendChild(inputMin); tr.appendChild(tdMin);

    // Estado
    const tdEstado = document.createElement("td"); const spanEstado = document.createElement("span"); tdEstado.appendChild(spanEstado); tr.appendChild(tdEstado);

    // Caducidad
    const tdCad = document.createElement("td"); const inputCad = document.createElement("input"); inputCad.type = "date"; inputCad.setAttribute("aria-label", adquisicionCats.has(categoriaActiva) ? "Fecha de adquisición" : "Fecha de caducidad"); tdCad.appendChild(inputCad); tr.appendChild(tdCad);

    // Días
    const tdDias = document.createElement("td"); const inputDias = document.createElement("input"); inputDias.type="text"; inputDias.readOnly=true; inputDias.value=""; tdDias.appendChild(inputDias); tr.appendChild(tdDias);

    // Observaciones
    const tdObs = document.createElement("td"); const textareaObs = document.createElement("textarea"); textareaObs.placeholder="Observaciones"; textareaObs.rows=2; textareaObs.style.resize="vertical"; textareaObs.style.width="100%"; textareaObs.style.boxSizing="border-box"; tdObs.appendChild(textareaObs); tr.appendChild(tdObs);

    // Acciones: checkbox + eliminar
    const tdAcc = document.createElement("td"); tdAcc.style.display="flex"; tdAcc.style.gap="8px"; tdAcc.style.alignItems="center";
    const chk = document.createElement("input"); chk.type="checkbox"; chk.className="row-select"; chk.title="Seleccionar fila para eliminar"; tdAcc.appendChild(chk);

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.textContent = "Eliminar";
    btnDel.title = "Eliminar esta fila";
    btnDel.style.padding = "6px 10px";
    btnDel.style.borderRadius = "6px";
    btnDel.style.border = "none";
    btnDel.style.cursor = "pointer";
    btnDel.style.background = "#fee2e2";
    btnDel.style.color = "#7f1d1d";

    btnDel.addEventListener("click", async (ev) => {
      ev && ev.preventDefault();
      const descripcion = (tr.cells[2].querySelector("input").value || "").trim();
      const stock = (tr.cells[3].querySelector("input").value || "").trim();
      const fecha = (tr.cells[6].querySelector("input").value || "").trim();
      const obs = (tr.cells[tr.cells.length-2].querySelector("textarea") ? tr.cells[tr.cells.length-2].querySelector("textarea").value : "").trim();
      const clave = (tr.cells[1].querySelector("select").value || "").trim();
      const hasData = !!(descripcion || stock || fecha || obs || clave);
      if (hasData && !confirm("La fila contiene datos. ¿Eliminarla de todas formas?")) return;

      const rowUid = tr.dataset.uid;
      const hospitalKey = selectedHospitalClave || (inputHospital ? inputHospital.value.trim() : "");
      if (rowUid && hospitalKey && categoriaActiva) {
        // pedir borrado remoto
        try {
          btnDel.disabled = true;
          const body = { hospitalClave: hospitalKey, categoria: categoriaActiva, uids: [rowUid] };
          const headers = { "Content-Type": "application/json" };
          if (CLIENT_API_TOKEN) headers["Authorization"] = "Bearer " + CLIENT_API_TOKEN;
          const resp = await fetch(INVENTORY_DELETE_ITEM_URL, { method: "POST", headers, body: JSON.stringify(body) });
          if (!resp.ok) {
            const text = await resp.text().catch(()=>"");
            throw new Error(`Error servidor: ${resp.status} ${resp.statusText} ${text}`);
          }
          const data = await resp.json().catch(()=>({ok:true}));
          if (data && data.ok) {
            // eliminar en UI
            tr.remove();
            renumerarFilas();
            refreshDisabledOptions();
            if (!tbody.rows.length) agregarFila();
            return;
          } else {
            throw new Error("Servidor respondió sin ok.");
          }
        } catch (err) {
          console.error("Error borrando item en servidor:", err);
          if (!confirm("No se pudo eliminar item en servidor. ¿Eliminar localmente de todas formas?")) {
            btnDel.disabled = false;
            return;
          }
          // fallback: eliminar localmente
        } finally {
          try { btnDel.disabled = false; } catch(e){}
        }
      }

      // si no hay uid/hospital -> eliminar localmente
      tr.remove(); renumerarFilas(); refreshDisabledOptions(); if (!tbody.rows.length) agregarFila();
    });

    tdAcc.appendChild(btnDel);

    tr.appendChild(tdAcc);
    tbody.appendChild(tr);

    // listeners y helpers 
    function fillProduct(producto) {
      if (!producto) return;
      inputDesc.value = producto.descripcion || inputDesc.value;
      inputStock.value = producto.stock || "";
      if (producto.minimo !== undefined && producto.minimo !== null && String(producto.minimo) !== "") inputMin.value = producto.minimo;
      else inputMin.value = getMinimoValue(producto.clave || "");
      inputCad.value = producto.caducidad || "";
      const lista = catalogo[categoriaActiva] || [];
      const idx = lista.indexOf(producto);
      if (idx >= 0) {
        for (let i=0;i<select.options.length;i++){ const opt = select.options[i]; if (opt.dataset && ('idx' in opt.dataset) && parseInt(opt.dataset.idx,10)===idx) { select.value = opt.value; break; } }
      } else {
        select.value = `${producto.clave}||0`;
      }
      refreshDisabledOptions(); actualizarFila(tr);
      sortRowsByCaducidad();
    }

    inputDesc.addEventListener("input", () => {
      const v = (inputDesc.value||"").trim();
      if (!v) { refreshDisabledOptions(); actualizarFila(tr); return; }
      const lista = catalogo[categoriaActiva] || [];
      const vLower = v.toLowerCase();
      const productoExact = lista.find(p => p.descripcion && p.descripcion.trim().toLowerCase() === vLower);
      if (productoExact) { fillProduct(productoExact); return; }
      refreshDisabledOptions(); actualizarFila(tr);
    });

    inputDesc.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === "Tab") {
        const v = (inputDesc.value||"").trim(); if (!v) return;
        const lista = catalogo[categoriaActiva] || []; const vLower = v.toLowerCase();
        const matchesStarts = lista.filter(p=>p.descripcion && p.descripcion.trim().toLowerCase().startsWith(vLower));
        const matchesContains = lista.filter(p=>p.descripcion && p.descripcion.trim().toLowerCase().includes(vLower));
        let producto = null;
        if (matchesStarts.length >= 1) producto = matchesStarts[0];
        else if (matchesContains.length === 1) producto = matchesContains[0];
        if (producto) { if (ev.key === "Enter") ev.preventDefault(); fillProduct(producto); }
      }
    });

    select.addEventListener("change", () => {
      const selectedOption = select.selectedOptions[0];
      let producto = null;
      if (selectedOption && selectedOption.dataset && ('idx' in selectedOption.dataset)) {
        const idx = parseInt(selectedOption.dataset.idx,10);
        producto = (catalogo[categoriaActiva]||[])[idx] || null;
      }
      if (!producto) {
        const claveSimple = select.value ? select.value.split("||")[0] : "";
        producto = (catalogo[categoriaActiva]||[]).find(p => p.clave === claveSimple) || null;
        if (!producto && claveSimple) {
          const val = getMinimoValue(claveSimple);
          inputMin.value = val;
        }
      }
      if (producto) fillProduct(producto);
      refreshDisabledOptions();
      setTimeout(()=>{ try{ inputDesc.focus(); }catch(e){} }, 0);
      sortRowsByCaducidad();
    });

    inputStock.addEventListener("input", () => { if (inputStock.value === "") return actualizarFila(tr); let v = parseInt(inputStock.value,10); if (isNaN(v)||v<0) v = 0; inputStock.value = v; actualizarFila(tr); });
    inputCad.addEventListener("change", () => { actualizarFila(tr); sortRowsByCaducidad(); });
    [select, inputDesc].forEach(el => { el.addEventListener("change", refreshDisabledOptions); el.addEventListener("input", refreshDisabledOptions); el.addEventListener("blur", refreshDisabledOptions); });
    refreshDisabledOptions();
  } // fin agregarFila

  function agregarFilaManual() {
    agregarFila();
    const tr = tbody.rows[tbody.rows.length-1];
    if (!tr) return;
    const select = tr.cells[1].querySelector("select");
    const inputDesc = tr.cells[2].querySelector("input");
    const btnDel = tr.cells[tr.cells.length-1].querySelector("button");
    const gen = `MAN-${Date.now().toString(36).slice(-6)}`;
    const opt = document.createElement("option");
    opt.value = gen;
    opt.textContent = gen + " (no listado)";
    select.appendChild(opt);
    select.value = gen;
    select.disabled = true;
    tr.dataset.manual = "true";
    inputDesc.required = true;
    inputDesc.placeholder = "Descripción obligatoria (producto no listado)";
    inputDesc.focus();
    if (btnDel) { btnDel.style.background="#fee2e2"; btnDel.style.color="#7f1d1d"; }
    refreshDisabledOptions();
    sortRowsByCaducidad();
  }

  function actualizarFila(tr) {
    const inputStock = tr.cells[3].querySelector("input");
    const inputMin = tr.cells[4].querySelector("input");
    const inputCad = tr.cells[6].querySelector("input");
    const inputDias = tr.cells[7].querySelector("input");
    const estadoSpan = tr.cells[5].querySelector("span");
    const stockVal = inputStock.value === "" ? null : Math.max(0, parseInt(inputStock.value||0,10));
    const minVal = inputMin.value === "" ? 0 : Math.max(0, parseInt(inputMin.value||0,10));
    if (stockVal === null) { estadoSpan.textContent = ""; } else { estadoSpan.textContent = (stockVal < minVal) ? "Bajo stock" : "Stock suficiente"; }
    tr.classList.remove("expired","warning-expiry","valid-expiry");
    inputDias.value = "";
    if (inputCad.value) {
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const fecha = new Date(inputCad.value);
      const msPorDia = 1000*60*60*24;
      const isAdq = adquisicionCats.has(categoriaActiva);
      if (isAdq) {
        const diffMs = hoy - fecha;
        const diasDesde = Math.ceil(diffMs / msPorDia);
        inputDias.value = diasDesde < 0 ? "En futuro" : String(diasDesde);
      } else {
        const diffMs = fecha - hoy;
        const diasRest = Math.ceil(diffMs / msPorDia);
        inputDias.value = diasRest < 0 ? "Caducado" : String(diasRest);
        let meses = (fecha.getFullYear() - hoy.getFullYear()) * 12 + (fecha.getMonth() - hoy.getMonth());
        if (fecha.getDate() < hoy.getDate()) meses -= 1;
        if (meses < 0) tr.classList.add("expired");
        else if (meses < 6) tr.classList.add("expired");
        else if (meses <= 12) tr.classList.add("warning-expiry");
        else tr.classList.add("valid-expiry");
      }
    }
  }

  const semaforoColor = { expired: "#FDE2E5", "warning-expiry": "#FFF7E0", "valid-expiry": "#E8F9F0", default: "#FFFFFF" };

  function escapeHtml(str) { if (str===null||str===undefined) return ""; return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;"); }

  // Ahora devuelve uid por fila y actualiza dataset.uid para que server y cliente compartan ids
  function buildPayloadRows() {
    const filasExport = [];
    const errors = [];
    for (const row of tbody.rows) {
      const select = row.cells[1].querySelector("select");
      const raw = select ? select.value : "";
      const claveReal = raw ? raw.split("||")[0] : "";
      const descripcion = (row.cells[2].querySelector("input").value || "").trim();
      const obsCellIndex = row.cells.length - 2;
      const observacionesEl = row.cells[obsCellIndex].querySelector("textarea");
      const observaciones = (observacionesEl ? (observacionesEl.value || "").trim() : "");
      const isManual = row.dataset && row.dataset.manual === "true";

      // generar/usar uid (asegura existencia)
      const uidExisting = row.dataset && row.dataset.uid ? row.dataset.uid : null;
      const uid = uidExisting || genUid();
      row.dataset.uid = uid; // aseguro que DOM tenga uid

      if (!claveReal && !descripcion && !observaciones) continue;
      if (isManual && !descripcion) { errors.push(`Fila ${row.rowIndex}: Falta descripción para producto no listado`); continue; }
      let color = semaforoColor.default;
      if (!adquisicionCats.has(categoriaActiva)) {
        if (row.classList.contains("expired")) color = semaforoColor.expired;
        else if (row.classList.contains("warning-expiry")) color = semaforoColor["warning-expiry"];
        else if (row.classList.contains("valid-expiry")) color = semaforoColor["valid-expiry"];
      }

      filasExport.push({
        uid,
        clave: claveReal,
        descripcion,
        stock: row.cells[3].querySelector("input").value || "",
        minimo: row.cells[4].querySelector("input").value || "",
        fecha: row.cells[6].querySelector("input").value || "",
        dias: row.cells[7].querySelector("input").value || "",
        observaciones,
        color,
        manual: !!isManual
      });
    }
    return { filasExport, errors };
  }

  async function saveInventoryToServer(hospitalNombre, hospitalClave, categoria, items) {
    if (!INVENTORY_POST_URL) throw new Error("INVENTORY_POST_URL no configurada.");
    const payload = { hospitalNombre: hospitalNombre||"", hospitalClave: hospitalClave||"", categoria: categoria||"", items };
    const headers = { "Content-Type": "application/json" };
    if (CLIENT_API_TOKEN) headers["Authorization"] = "Bearer " + CLIENT_API_TOKEN;
    const resp = await fetch(INVENTORY_POST_URL, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>"");
      throw new Error(`Error guardando inventory: ${resp.status} ${resp.statusText} ${txt}`);
    }
    const data = await resp.json().catch(()=>null);
    return data;
  }

  if (btnEnviar) {
    btnEnviar.onclick = async (ev) => {
      ev && ev.preventDefault();
      const { filasExport, errors } = buildPayloadRows();
      if (errors.length) { alert("Errores:\n\n" + errors.join("\n")); return; }
      if (filasExport.length === 0) { alert("No hay datos para enviar."); return; }
      if (!INVENTORY_POST_URL) { alert("INVENTORY_POST_URL no configurada."); return; }
      const hospitalNombre = inputHospital ? (inputHospital.value || "").trim() : "";
      // Asegurar que el hospital sea válido antes de guardar
      if (!selectedHospitalClave) { alert("Selecciona un hospital válido de la lista antes de enviar."); inputHospital.focus(); return; }
      try {
        btnEnviar.disabled = true; const originalText = btnEnviar.textContent; btnEnviar.textContent = "Guardando...";
        await saveInventoryToServer(hospitalNombre, selectedHospitalClave || hospitalNombre, categoriaActiva, filasExport);
        alert("Inventario guardado correctamente en el servidor.");
        limpiarTabla();
        categoriaActiva = null; selCategoria.value = ""; if (inputHospital) inputHospital.value = ""; selectedHospitalClave = "";
        updateCaducidadHeader();
        document.getElementById("page2").classList.remove("activo"); document.getElementById("page2").classList.add("oculto");
        document.getElementById("page1").classList.remove("oculto"); document.getElementById("page1").classList.add("activo");
        showHospitalStatus("", true);
        btnSiguiente.disabled = true;
      } catch (err) {
        console.error("Error al guardar inventario:", err);
        alert("No fue posible guardar el inventario en el servidor:\n\n" + (err.message || err));
      } finally {
        btnEnviar.disabled = false; btnEnviar.textContent = "Enviar";
      }
    };
  }

  // ---- HOSPITALES ----
  async function tryFetchHospitals(urlToTry) {
    try {
      const resp = await fetch(urlToTry, { method: "GET", cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return Array.isArray(data) ? data.map(d => (typeof d === "string" ? { nombre: d, clave: "" } : { nombre: d.nombre || "", clave: d.clave || "" })) : [];
    } catch (err) { throw err; }
  }

  async function cargarHospitales() {
    if (!datalistHospitales) return;
    datalistHospitales.innerHTML = "";
    try {
      hospitales = await tryFetchHospitals(HOSPITALES_URL);
      console.log("hospitales cargados desde HOSPITALES_URL:", HOSPITALES_URL);
    } catch (err1) {
      console.warn("Intento 1 falló:", err1);
      try {
        const alt = `${location.origin}/hospitales`;
        hospitales = await tryFetchHospitals(alt);
        console.log("hospitales cargados desde origen alterno:", alt);
      } catch (err2) {
        console.warn("Intento 2 falló:", err2);
        hospitales = fallbackHospitals;
        console.warn("Usando fallback local de hospitales.");
      }
    }
    datalistHospitales.innerHTML = "";
    hospitales.forEach(h => {
      const opt = document.createElement("option"); opt.value = h.nombre;
      if (h.clave) opt.dataset.clave = h.clave;
      datalistHospitales.appendChild(opt);
    });

    // Construir índice normalizado para búsqueda robusta
    buildHospitalIndex();

    // Inicialmente deshabilitar avanzar hasta que el usuario seleccione válido
    btnSiguiente.disabled = true;
    if (inputHospital && inputHospital.value) updateHospitalValidationUI();
    else showHospitalStatus("Selecciona un hospital de la lista.", false);
  }
  cargarHospitales().catch(()=>{/* no crítico */});

  // sincronización y validación en tiempo real: solo coincidencia EXACTA es válida
  function syncHospitalClave() {
    const v = (inputHospital.value || "").trim();
    if (!v) { selectedHospitalClave = ""; updateHospitalValidationUI(); return; }
    // buscar coincidencia exacta normalizada
    const match = findExactHospitalMatch(v);
    if (match) selectedHospitalClave = match.clave || "";
    else selectedHospitalClave = "";
    updateHospitalValidationUI();
  }
  inputHospital && inputHospital.addEventListener("change", syncHospitalClave);
  inputHospital && inputHospital.addEventListener("blur", syncHospitalClave);
  inputHospital && inputHospital.addEventListener("input", () => {
    // actualiza UI y mantiene la posibilidad de seguir escribiendo, pero no se habilita Siguiente hasta match exacto
    syncHospitalClave();
  });



  




  // ---- INVENTORY: cargar y poblar 
// Helper para normalizar cadenas comparando categorías sin importar acentos ni espacios
// Helper para normalizar cadenas comparando categorías sin importar acentos ni espacios
function cleanCategoryStr(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // elimina espacios y símbolos (ej: "bienesInformaticos" vs "bienes informáticos" -> "bienesinformaticos")
}

// ---- INVENTORY: cargar y poblar 

async function loadInventoryAndPopulate(hospitalClaveOrName, categoria) {
  if (!hospitalClaveOrName || !categoria) return;

  try {
    const catTarget = cleanCategoryStr(categoria);

    // 1. OBTENER PRIMERO EL CATÁLOGO MAESTRO DE LA DB
    const catalogoProductos = await cargarCatalogoProductosDB();

    // 2. Poblar la variable global "catalogo" con la categoría filtrada
    catalogo[categoria] = catalogoProductos.filter(p =>
      cleanCategoryStr(p.categoria) === catTarget
    );


    // 4. Filtrar registros previos del hospital por la categoría actual
    const registrosCat = registrosHospital.filter(r =>
      cleanCategoryStr(r.categoria) === catTarget
    );

    limpiarTabla();

    // --- CASO A: Si el hospital NO TIENE registros previos ---
    if (registrosCat.length === 0) {
      agregarFila(); // Ahora agregarFila() SÍ tendrá el catalogo[categoria] disponible
      return;
    }

    // --- CASO B: Si el hospital YA TIENE registros guardados ---
    for (const item of registrosCat) {
      agregarFila();
      const tr = tbody.rows[tbody.rows.length - 1];
      if (!tr) continue;

      const selectEl = tr.cells[1].querySelector("select");
      const inputDescEl = tr.cells[2].querySelector("input");
      const inputStockEl = tr.cells[3].querySelector("input");
      const inputMinEl = tr.cells[4].querySelector("input");
      const inputFechaEl = tr.cells[6].querySelector("input");
      const inputDiasEl = tr.cells[7].querySelector("input");
      const textareaObs = tr.cells[tr.cells.length - 2].querySelector("textarea");

      const clave = String(item.clave || "").trim();

      // RE-POBLAR EL SELECT SI ESTABA VACÍO
      if (selectEl && selectEl.options.length <= 1 && catalogo[categoria] && catalogo[categoria].length > 0) {
        catalogo[categoria].forEach((p, idx) => {
          const o = document.createElement("option");
          o.value = `${p.clave}||${idx}`;
          o.textContent = p.clave;
          o.dataset.descripcion = p.descripcion || "";
          o.dataset.idx = String(idx);
          selectEl.appendChild(o);
        });
      }

      inputDescEl.value = item.descripcion || "";
      inputStockEl.value = item.stock ?? "";
      inputMinEl.value = item.minimo ?? item.stock_minimo ?? getMinimoValue(clave) ?? "";
      inputFechaEl.value = item.fecha || item.caducidad || "";
      inputDiasEl.value = item.dias_restantes ?? item.dias ?? "";
      textareaObs.value = item.observaciones ?? "";

      if (item.uid) tr.dataset.uid = item.uid;
      if (item.manual) tr.dataset.manual = "true";

      // Asignar el valor seleccionado al dropdown
      if (selectEl) {
        let matchedOpt = Array.from(selectEl.options).find(o => {
          const valClave = (o.value || "").split("||")[0].trim();
          return valClave === clave;
        });

        if (matchedOpt) {
          selectEl.value = matchedOpt.value;
        } else if (clave) {
          const opt = document.createElement("option");
          opt.value = `${clave}||${selectEl.options.length}`;
          opt.textContent = clave;
          selectEl.appendChild(opt);
          selectEl.value = opt.value;
        }
      }

      actualizarFila(tr);
    }

    sortRowsByCaducidad();
    refreshDisabledOptions();
  } catch (err) {
    console.error("loadInventoryAndPopulate error:", err);
    limpiarTabla();
    agregarFila();
  }
}






  // Eliminar filas seleccionadas -> ahora con llamada al servidor
  async function deleteSelectedRows() {
    const checked = Array.from(tbody.querySelectorAll("input.row-select:checked"));
    if (!checked.length) { alert("No hay filas seleccionadas para eliminar."); return; }
    const detalles = checked.map(chk => {
      const tr = chk.closest("tr");
      const no = tr ? (tr.cells[0].textContent || "").trim() : "(?)";
      const desc = tr ? (tr.cells[2].querySelector("input").value || "").trim() : "";
      return `Fila ${no}: ${desc ? (desc.length>60 ? desc.slice(0,60)+"…" : desc) : "(sin descripción)"}`;
    }).join("\n");
    if (!confirm(`Vas a eliminar ${checked.length} fila(s):\n\n${detalles}\n\n¿Continuar?`)) return;

    const uids = [];
    const rowsToRemove = [];
    for (const ch of checked) {
      const tr = ch.closest("tr");
      if (!tr) continue;
      if (tr.dataset && tr.dataset.uid) uids.push(tr.dataset.uid);
      rowsToRemove.push(tr);
    }

    const hospitalKey = selectedHospitalClave || (inputHospital ? inputHospital.value.trim() : "");
    if (uids.length && hospitalKey && categoriaActiva) {
      try {
        const body = { hospitalClave: hospitalKey, categoria: categoriaActiva, uids };
        const headers = { "Content-Type": "application/json" };
        if (CLIENT_API_TOKEN) headers["Authorization"] = "Bearer " + CLIENT_API_TOKEN;
        const resp = await fetch(INVENTORY_DELETE_ITEM_URL, { method: "POST", headers, body: JSON.stringify(body) });
        if (!resp.ok) {
          const text = await resp.text().catch(()=>"");
          throw new Error(`Error servidor: ${resp.status} ${resp.statusText} ${text}`);
        }
        const data = await resp.json().catch(()=>null);
        // eliminar filas en UI si servidor confirmó (o si no devuelve, asumir ok)
        for (const tr of rowsToRemove) { tr.remove(); }
        renumerarFilas();
        refreshDisabledOptions();
        if (!tbody.rows.length) agregarFila();
        return;
      } catch (err) {
        console.error("Error borrando items en servidor:", err);
        if (!confirm("No se pudo eliminar algunos items en el servidor. ¿Eliminar localmente de todas formas?")) return;
        // el usuario confirmó: eliminar localmente
      }
    }

    // eliminar localmente
    for (const tr of rowsToRemove) { tr.remove(); }
    renumerarFilas();
    refreshDisabledOptions();
    if (!tbody.rows.length) agregarFila();
  }

  // Descarga CSV
  function downloadCSV() {
    const { filasExport, errors } = buildPayloadRows();
    if (errors.length) { alert("Errores:\n\n" + errors.join("\n")); return; }
    if (!filasExport || filasExport.length === 0) { alert("No hay datos para exportar."); return; }

    const cols = ["uid","clave","descripcion","stock","minimo","fecha","dias","observaciones","color","manual"];
    const escapeCell = s => {
      if (s===null||s===undefined) return "";
      const str = String(s);
      return (str.includes('"')||str.includes(',')||str.includes('\n')) ? `"${str.replace(/"/g,'""')}"` : str;
    };
    const lines = [ cols.join(",") ];
    for (const row of filasExport) {
      const vals = cols.map(c => escapeCell(row[c]));
      lines.push(vals.join(","));
    }
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date().toISOString().replace(/[:.]/g,"-");
    a.download = `inventario_${(selectedHospitalClave||inputHospital.value||"no-hospital")}_${categoriaActiva||"no-cat"}_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);


  }

  // reubicar botones si se cambia el tamaño
  window.addEventListener("resize", moveButtonsToCardBottom);