'use strict';
/* Tama Beauty · Facturación (módulo aparte)
   Reutiliza lo que ya define app.js: db, save, $, esc, cop, uid, iso, prod, download.
   Las facturas viven en db.invoices, así que entran solas en el respaldo JSON del perfil.
   Todo está dentro de una función para no chocar con los nombres de app.js. */
(() => {
db.invoices = db.invoices || [];

const METHODS = ['Efectivo', 'Nequi', 'Daviplata', 'Bancolombia', 'Transferencia', 'Otro'];
const num4 = n => String(n).padStart(4, '0');
const fdate = s => (s ? s.split('-').reverse().join('/') : '');
const money = n => Math.max(0, +n || 0);
const nextNum = () => db.invoices.reduce((m, i) => Math.max(m, i.num || 0), 0) + 1;
const clone = o => JSON.parse(JSON.stringify(o));
const blank = () => ({
  id: null, num: nextNum(), date: iso(new Date()), client: '', phone: '', method: METHODS[0],
  items: [{ name: '', qty: 1, price: 0 }], discType: '%', disc: 0, ship: 0, paid: 0, notes: '', orderId: null
});

/* ---------- Cálculos (una sola fuente de verdad) ---------- */
function calc(f) {
  const sub = f.items.reduce((s, l) => s + money(l.qty) * money(l.price), 0);
  const disc = Math.round(f.discType === '%' ? sub * Math.min(100, money(f.disc)) / 100 : Math.min(sub, money(f.disc)));
  const total = sub - disc + money(f.ship);
  const paid = Math.min(money(f.paid), total);
  const bal = total - paid;
  const status = total > 0 && paid >= total ? 'Pagada' : paid > 0 ? 'Abonada' : 'Pendiente';
  return { sub, disc, total, paid, bal, status };
}

/* ---------- La factura (se usa en vista previa e impresión) ---------- */
function sheet(f) {
  const c = calc(f), p = db.profile || {};
  const rows = f.items.map(l => `<tr><td>${esc(l.name)}</td><td class="n">${l.qty}</td><td class="n">${cop(l.price)}</td><td class="n">${cop(l.qty * l.price)}</td></tr>`).join('');
  const dLabel = f.discType === '%' ? `Descuento (${money(f.disc)}%)` : 'Descuento';
  return `<article class="paper">
    <div class="p-top">
      <img src="assets/logo.png" class="p-logo" alt="">
      <div class="p-biz"><h2>${esc(p.business)}</h2><p>${[p.phone ? '☎ ' + esc(p.phone) : '', esc(p.city)].filter(Boolean).join(' · ')}</p></div>
      <div class="p-no"><small>FACTURA</small><b>N° ${num4(f.num)}</b><span>${fdate(f.date)}</span></div>
    </div>
    <div class="p-meta">
      <div><small>Facturado a</small><b>${esc(f.client)}</b>${f.phone ? `<span>${esc(f.phone)}</span>` : ''}</div>
      <div><small>Método de pago</small><b>${esc(f.method)}</b></div>
      <div><small>Estado</small><b class="chip st-${c.status}">${c.status}</b></div>
    </div>
    <table class="p-tbl">
      <thead><tr><th>Producto</th><th class="n">Cant.</th><th class="n">Precio</th><th class="n">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="p-foot">
      <div class="p-notes">${f.notes ? `<small>Notas</small><p>${esc(f.notes).replace(/\n/g, '<br>')}</p>` : ''}${c.status === 'Pagada' ? '<div class="stamp">PAGADA</div>' : ''}</div>
      <div class="p-tot">
        <div><span>Subtotal</span><b>${cop(c.sub)}</b></div>
        ${c.disc ? `<div><span>${dLabel}</span><b>− ${cop(c.disc)}</b></div>` : ''}
        ${money(f.ship) ? `<div><span>Domicilio</span><b>${cop(f.ship)}</b></div>` : ''}
        <div class="grand"><span>TOTAL</span><b>${cop(c.total)}</b></div>
        ${c.paid ? `<div><span>Abonado</span><b>${cop(c.paid)}</b></div>` : ''}
        ${c.bal && c.paid ? `<div class="due"><span>Saldo pendiente</span><b>${cop(c.bal)}</b></div>` : ''}
      </div>
    </div>
    <p class="p-thanks">♡ ¡Gracias por tu compra! ♡</p>
  </article>`;
}

/* ---------- Lista, resumen y filtros ---------- */
const monthName = m => new Date(m + '-01T00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

function renderInvoices() {
  // Tarjetas de resumen
  const ym = iso(new Date()).slice(0, 7), mine = db.invoices.filter(i => i.date.slice(0, 7) == ym);
  const sum = (arr, k) => arr.reduce((s, i) => s + calc(i)[k], 0);
  $('#iCards').innerHTML = [
    ['Facturado este mes', cop(sum(mine, 'total'))],
    ['Cobrado este mes', cop(sum(mine, 'paid'))],
    ['Por cobrar (total)', cop(sum(db.invoices, 'bal'))],
    ['Facturas emitidas', db.invoices.length]
  ].map(([t, v]) => `<div class="sc"><small>${t}</small><b>${v}</b></div>`).join('');

  // Selector de meses (conserva la selección)
  const keep = $('#iMonth').value;
  const months = [...new Set(db.invoices.map(i => i.date.slice(0, 7)))].sort().reverse();
  $('#iMonth').innerHTML = '<option value="">Todos los meses</option>' +
    months.map(m => `<option value="${m}"${m == keep ? ' selected' : ''}>${monthName(m)}</option>`).join('');

  // Filtrado
  const q = $('#iSearch').value.toLowerCase().trim(), fs = $('#iStatus').value, fm = $('#iMonth').value;
  const list = db.invoices
    .filter(i => (!fs || calc(i).status == fs) && (!fm || i.date.slice(0, 7) == fm) &&
      (!q || i.client.toLowerCase().includes(q) || num4(i.num).includes(q) || String(i.num) == q))
    .sort((a, b) => b.num - a.num);

  $('#iList').innerHTML = list.map(i => {
    const c = calc(i), n = i.items.length;
    return `<div class="inv-card st-${c.status}" data-id="${i.id}">
      <div class="ic-main"><b>N° ${num4(i.num)} · ${esc(i.client)}</b>
        <small>${fdate(i.date)} · ${n} producto${n == 1 ? '' : 's'} · ${esc(i.method)}</small></div>
      <div class="ic-amt"><b>${cop(c.total)}</b><span class="chip st-${c.status}">${c.status}</span>
        ${c.status == 'Abonada' ? `<small>Debe ${cop(c.bal)}</small>` : ''}</div>
      <div class="ic-act">
        <button class="btn sm" data-act="view">Ver / Imprimir</button>
        <button class="btn ghost sm" data-act="edit">Editar</button>
        <button class="btn ghost sm" data-act="dup">Duplicar</button>
        ${c.status != 'Pagada' ? '<button class="btn ghost sm" data-act="pay">Marcar pagada</button>' : ''}
        <button class="btn ghost sm" data-act="del" title="Eliminar">🗑</button>
      </div></div>`;
  }).join('') || `<p class="sum">${db.invoices.length ? 'No hay facturas con esos filtros.' : 'Aún no has creado facturas. ¡Crea la primera con “+ Nueva factura”! 🌸'}</p>`;
}

['#iSearch', '#iStatus', '#iMonth'].forEach(s => $(s).addEventListener('input', renderInvoices));
$('#iNew').onclick = () => openInvoice(blank());

$('#iList').onclick = e => {
  const b = e.target.closest('[data-act]'), card = e.target.closest('.inv-card');
  if (!b || !card) return;
  const f = db.invoices.find(x => x.id == card.dataset.id);
  if (!f) return;
  const act = b.dataset.act;
  if (act == 'view') viewInvoice(f.id);
  if (act == 'edit') openInvoice(f);
  if (act == 'dup') openInvoice({ ...clone(f), id: null, num: nextNum(), date: iso(new Date()), paid: 0, orderId: null });
  if (act == 'pay') { f.paid = calc(f).total; save(); renderInvoices(); }
  if (act == 'del' && confirm(`¿Eliminar la factura N° ${num4(f.num)} de ${f.client}?`)) {
    db.invoices = db.invoices.filter(x => x != f); save(); renderInvoices();
  }
};

$('#iCsv').onclick = () => {
  // Evita que Excel interprete textos que empiezan por = + - @ como fórmulas
  const q = v => { v = String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const head = 'Numero,Fecha,Cliente,Telefono,Metodo,Estado,Subtotal,Descuento,Domicilio,Total,Abonado,Saldo,Productos\n';
  const body = db.invoices.slice().sort((a, b) => a.num - b.num).map(i => {
    const c = calc(i);
    return [num4(i.num), i.date, i.client, i.phone, i.method, c.status, c.sub, c.disc, money(i.ship), c.total, c.paid, c.bal,
      i.items.map(l => `${l.qty}x ${l.name}`).join(' | ')].map(q).join(',');
  }).join('\n');
  download('facturas.csv', '\ufeff' + head + body, 'text/csv');
};

/* ---------- Editor de factura ---------- */
let inv = null; // copia de trabajo (no se guarda hasta pulsar Guardar)

function openInvoice(src) {
  inv = clone(src);
  if (!inv.items.length) inv.items = [{ name: '', qty: 1, price: 0 }];
  const p = db.profile || {};
  $('#edBiz').textContent = p.business || '';
  $('#edSub').textContent = [p.phone, p.city].filter(Boolean).join(' · ');
  $('#iNum').value = inv.num; $('#iDate').value = inv.date;
  $('#iClient').value = inv.client; $('#iPhone').value = inv.phone;
  $('#iMethod').innerHTML = METHODS.map(m => `<option${m == inv.method ? ' selected' : ''}>${m}</option>`).join('');
  $('#iNotes').value = inv.notes; $('#iDiscT').value = inv.discType;
  $('#iDisc').value = inv.disc || ''; $('#iShip').value = inv.ship || ''; $('#iPaid').value = inv.paid || '';
  // Sugerencias: productos del catálogo y clientes anteriores
  $('#prodList').innerHTML = db.products.map(x => `<option value="${esc(x.name)}">${cop(x.price)}</option>`).join('');
  $('#clientList').innerHTML = [...new Set([...db.invoices.map(i => i.client), ...db.orders.map(o => o.client)].filter(Boolean))]
    .map(c => `<option value="${esc(c)}">`).join('');
  $('#iMsg').textContent = '';
  drawLines();
  $('#invDlg').showModal();
}

function drawLines(focusLast) {
  $('#iLines').innerHTML = inv.items.map((l, i) => `<div class="il" data-i="${i}">
    <input data-k="name" list="prodList" placeholder="Nombre del producto" value="${esc(l.name)}" maxlength="80" autocomplete="off">
    <input data-k="qty" type="number" min="1" step="1" inputmode="numeric" value="${l.qty}" aria-label="Cantidad">
    <input data-k="price" type="number" min="0" step="100" inputmode="numeric" value="${l.price || ''}" placeholder="Precio" aria-label="Precio unitario">
    <output class="lt"></output>
    <button type="button" class="x" data-rm title="Quitar línea">✕</button></div>`).join('');
  if (focusLast) { const n = document.querySelectorAll('#iLines [data-k=name]'); n[n.length - 1].focus(); }
  paint();
}

// Lee los campos fijos del formulario hacia la copia de trabajo
function sync() {
  Object.assign(inv, {
    num: Math.floor(+$('#iNum').value) || 0, date: $('#iDate').value, client: $('#iClient').value,
    phone: $('#iPhone').value, method: $('#iMethod').value, notes: $('#iNotes').value,
    disc: money($('#iDisc').value), discType: $('#iDiscT').value, ship: money($('#iShip').value), paid: money($('#iPaid').value)
  });
}

// Recalcula totales en pantalla sin redibujar las filas (así no se pierde el cursor)
function paint() {
  const c = calc(inv);
  document.querySelectorAll('#iLines .il').forEach((r, i) => { r.querySelector('.lt').textContent = cop(money(inv.items[i].qty) * money(inv.items[i].price)); });
  $('#tSub').textContent = cop(c.sub);
  $('#tDisc').textContent = c.disc ? '− ' + cop(c.disc) : '';
  $('#tTotal').textContent = cop(c.total);
  $('#tBal').textContent = cop(c.bal);
  $('#tState').className = 'chip st-' + c.status; $('#tState').textContent = c.status;
}

$('#invForm').addEventListener('input', e => {
  const t = e.target, row = t.closest('.il');
  if (row) {
    const l = inv.items[+row.dataset.i], k = t.dataset.k;
    l[k] = k == 'name' ? t.value : money(t.value);
    if (k == 'price') l.auto = false; // el usuario escribió el precio a mano
  }
  sync(); paint();
});

$('#invForm').addEventListener('change', e => {
  const t = e.target, row = t.closest('.il');
  // Al elegir un producto del catálogo, se rellena su precio
  if (row && t.dataset.k == 'name') {
    const l = inv.items[+row.dataset.i], name = t.value.trim().toLowerCase();
    const p = db.products.find(x => x.name.toLowerCase() == name);
    if (p && (!l.price || l.auto)) {
      l.price = p.price; l.auto = true;
      row.querySelector('[data-k=price]').value = p.price || ''; paint();
    }
  }
  // Cliente conocido: recuerda su teléfono
  if (t.id == 'iClient' && !$('#iPhone').value.trim()) {
    const name = t.value.trim().toLowerCase();
    const prev = db.invoices.slice().sort((a, b) => b.num - a.num).find(i => i.client.toLowerCase() == name && i.phone);
    if (prev) { $('#iPhone').value = prev.phone; sync(); }
  }
});

$('#invForm').addEventListener('click', e => {
  if (e.target.dataset.rm !== undefined) {
    const i = +e.target.closest('.il').dataset.i;
    inv.items.splice(i, 1);
    if (!inv.items.length) inv.items.push({ name: '', qty: 1, price: 0 });
    drawLines();
  }
});
$('#iAddLine').onclick = () => { inv.items.push({ name: '', qty: 1, price: 0 }); drawLines(true); };
$('#iFull').onclick = () => { sync(); inv.paid = calc(inv).total; $('#iPaid').value = inv.paid || ''; paint(); };
$('#iCancel').onclick = () => $('#invDlg').close();

$('#invForm').onsubmit = e => {
  e.preventDefault(); sync();
  const items = inv.items.filter(l => l.name.trim() || l.price)
    .map(l => ({ name: l.name.trim(), qty: Math.max(1, Math.round(l.qty) || 1), price: money(l.price) }));
  const msg = $('#iMsg');
  if (!items.length || items.some(l => !l.name)) return (msg.textContent = 'Agrega al menos un producto y ponle nombre a cada línea con precio.');
  if (inv.num < 1) return (msg.textContent = 'El número de factura debe ser 1 o mayor.');
  if (db.invoices.some(i => i.num == inv.num && i.id != inv.id)) return (msg.textContent = `Ya existe la factura N° ${num4(inv.num)}. Usa otro número.`);
  const saved = {
    id: inv.id || uid(), num: inv.num, date: inv.date, client: inv.client.trim(), phone: inv.phone.trim(),
    method: inv.method, items, discType: inv.discType, disc: inv.disc, ship: inv.ship, paid: inv.paid,
    notes: inv.notes.trim(), orderId: inv.orderId || null
  };
  const at = db.invoices.findIndex(i => i.id == saved.id);
  at >= 0 ? db.invoices[at] = saved : db.invoices.push(saved);
  save(); $('#invDlg').close(); renderInvoices();
  if (e.submitter?.dataset.view) viewInvoice(saved.id);
};

/* ---------- Vista previa, imprimir/PDF y WhatsApp ---------- */
let viewId = null;
const current = () => db.invoices.find(i => i.id == viewId);

function viewInvoice(id) {
  viewId = id;
  $('#vSheet').innerHTML = sheet(current());
  $('#vDlg').showModal();
}

// Imprime solo la factura (el CSS oculta todo lo demás). En el diálogo de impresión elige "Guardar como PDF".
function printInvoice(f) { $('#invPrint').innerHTML = sheet(f); window.print(); }

function waLink(f) {
  const c = calc(f), p = db.profile || {};
  const L = [`🌸 *${p.business}*`, `Factura N° ${num4(f.num)} · ${fdate(f.date)}`, `Cliente: ${f.client}`, '',
    ...f.items.map(l => `• ${l.qty}× ${l.name} — ${cop(l.qty * l.price)}`), ''];
  if (c.disc) L.push(`Descuento: -${cop(c.disc)}`);
  if (money(f.ship)) L.push(`Domicilio: ${cop(f.ship)}`);
  L.push(`*Total: ${cop(c.total)}*`);
  if (c.paid) L.push(`Abonado: ${cop(c.paid)}`);
  if (c.bal) L.push(`*Saldo pendiente: ${cop(c.bal)}*`); else if (c.total > 0) L.push('✅ Pagada');
  if (f.notes) L.push('', f.notes);
  L.push('', '¡Gracias por tu compra! 💕');
  let ph = (f.phone || '').replace(/\D/g, '');
  if (ph.length == 10 && ph[0] == '3') ph = '57' + ph; // celular colombiano sin indicativo
  return 'https://wa.me/' + ph + '?text=' + encodeURIComponent(L.join('\n'));
}

$('#vPrint').onclick = () => printInvoice(current());
$('#vWa').onclick = () => window.open(waLink(current()), '_blank', 'noopener');
$('#vEdit').onclick = () => { const f = current(); $('#vDlg').close(); openInvoice(f); };
$('#vClose').onclick = () => $('#vDlg').close();

/* ---------- Facturar desde una entrega (botón 🧾 en la pestaña Entregas) ---------- */
window.invoiceFromOrder = id => {
  const o = db.orders.find(x => x.id == id);
  if (!o) return;
  const ex = db.invoices.find(i => i.orderId == id);
  if (ex && !confirm(`Esta entrega ya tiene la factura N° ${num4(ex.num)}. ¿Crear otra?`)) return;
  const items = o.items.map(i => { const p = prod(i.pid); return p ? { name: p.name, qty: i.qty, price: p.price } : null; }).filter(Boolean);
  openInvoice({ ...blank(), client: o.client, notes: o.notes || '', orderId: id, items });
};

renderInvoices();
})();
