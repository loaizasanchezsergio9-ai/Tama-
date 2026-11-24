'use strict';
/* Tama Beauty · app personal. Datos en localStorage del navegador (sin servidor). */
const KEY='tama_db_v1', SESS='tama_session';
const BRANDS=['Bioaqua','Bloomshell','Anika','MyK Cosmetics','Engol','Prosa','Purpure','Otra'];
const STATES=['Por preparar','En preparación','Listo','Entregado'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cop=n=>'$'+Math.round(n||0).toLocaleString('es-CO');
const uid=()=>Math.random().toString(36).slice(2,10);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const prod=id=>db.products.find(p=>p.id==id);
const total=items=>items.reduce((s,l)=>s+(prod(l.pid)?.price||0)*l.qty,0);

let db=JSON.parse(localStorage.getItem(KEY)||'null')||{profile:null,products:[],orders:[]};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){alert('Sin espacio: descarga un respaldo y quita imágenes pesadas.')}};

/* ---------- Acceso ---------- */
// La clave se guarda como hash SHA-256 + sal (nunca en texto plano). Es una barrera local, no seguridad de servidor.
async function hash(pw,salt){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+pw));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function showAuth(first){$('#auth').hidden=false;$('#app').hidden=true;$('#authTitle').textContent=first?'Crea tu acceso':'Iniciar sesión';$('#authBtn').dataset.first=first?1:'';$('#bizRow').hidden=!first}
$('#authForm').onsubmit=async e=>{
  e.preventDefault();const u=$('#u').value.trim(),pw=$('#pw').value;
  if($('#authBtn').dataset.first){
    if(pw.length<6)return $('#authMsg').textContent='La clave debe tener mínimo 6 caracteres';
    const salt=uid()+uid();db.profile={user:u,salt,hash:await hash(pw,salt),business:$('#biz').value||'Tama Beauty',phone:'',city:'Pereira'};save();
  }else if(u!==db.profile.user||await hash(pw,db.profile.salt)!==db.profile.hash)return $('#authMsg').textContent='Usuario o clave incorrectos';
  ($('#remember').checked?localStorage:sessionStorage).setItem(SESS,'1');start();
};
$('#logout').onclick=()=>{localStorage.removeItem(SESS);sessionStorage.removeItem(SESS);location.reload()};
function start(){$('#auth').hidden=true;$('#app').hidden=false;$('#bizName').textContent=db.profile.business;renderProducts();renderCal();renderOrders();fillProfile()}

/* ---------- Pestañas ---------- */
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x==b));
  ['products','orders','invoices','profile'].forEach(t=>$('#tab-'+t).hidden=t!=b.dataset.tab);
});

/* ---------- Productos ---------- */
// Reduce la imagen a ~320px para no llenar el almacenamiento del navegador
const shrink=(file,max=320)=>new Promise(r=>{const i=new Image();i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);r(c.toDataURL('image/jpeg',.7))};i.src=URL.createObjectURL(file)});
function renderProducts(){
  const q=$('#search').value.toLowerCase();
  $('#ptbody').innerHTML=db.products.filter(p=>(p.name+p.brand).toLowerCase().includes(q)).map(p=>`<tr data-id="${p.id}">
   <td data-l="Imagen"><label class="thumb">${p.img?`<img src="${p.img}" alt="">`:'📷'}<input type="file" accept="image/*" hidden data-f="img"></label>${p.img?'<button class="x" data-delimg title="Quitar imagen">✕</button>':''}</td>
   <td data-l="Producto"><input data-f="name" value="${esc(p.name)}"></td>
   <td data-l="Marca"><select data-f="brand">${BRANDS.map(b=>`<option${b==p.brand?' selected':''}>${b}</option>`).join('')}</select></td>
   <td data-l="Precio"><input data-f="price" type="number" min="0" step="100" value="${p.price}"></td>
   <td data-l="Stock"><input data-f="stock" type="number" min="0" value="${p.stock}"></td>
   <td data-l="Notas"><input data-f="notes" value="${esc(p.notes)}"></td>
   <td><button class="x" data-del title="Eliminar">🗑</button></td></tr>`).join('');
  const units=db.products.reduce((s,p)=>s+p.stock,0),val=db.products.reduce((s,p)=>s+p.stock*p.price,0);
  $('#pSummary').textContent=`${db.products.length} productos · ${units} unidades · inventario a precio de venta: ${cop(val)}`;
}
$('#search').oninput=renderProducts;
$('#addProd').onclick=()=>{db.products.unshift({id:uid(),name:'Nuevo producto',brand:BRANDS[0],price:0,stock:0,notes:'',img:''});save();renderProducts()};
$('#ptbody').onchange=async e=>{
  const f=e.target.dataset.f;if(!f)return;const p=prod(e.target.closest('tr').dataset.id);
  p[f]=f=='img'?await shrink(e.target.files[0]):['price','stock'].includes(f)?Math.max(0,+e.target.value||0):e.target.value;
  save();renderProducts();
};
$('#ptbody').onclick=e=>{
  const tr=e.target.closest('tr');if(!tr)return;const p=prod(tr.dataset.id);
  if(e.target.dataset.delimg!==undefined){p.img='';save();renderProducts()}
  if(e.target.dataset.del!==undefined&&confirm('¿Eliminar "'+p.name+'"?')){db.products=db.products.filter(x=>x!=p);save();renderProducts()}
};
const download=(name,text,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click()};
$('#csvBtn').onclick=()=>{
  const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  download('productos.csv','\ufeffProducto,Marca,Precio,Stock,Notas\n'+db.products.map(p=>[p.name,p.brand,p.price,p.stock,p.notes].map(q).join(',')).join('\n'),'text/csv');
};

/* ---------- Calendario y entregas ---------- */
let cur=new Date(),sel=null,draft=[],editing=null;
function renderCal(){
  const y=cur.getFullYear(),m=cur.getMonth(),off=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  $('#calTitle').textContent=cur.toLocaleDateString('es-CO',{month:'long',year:'numeric'});
  let h=['L','M','M','J','V','S','D'].map(d=>`<b>${d}</b>`).join('')+'<i></i>'.repeat(off);
  for(let d=1;d<=days;d++){const k=iso(new Date(y,m,d)),n=db.orders.filter(o=>o.date==k).length;
    h+=`<button data-d="${k}" class="${k==iso(new Date())?'today ':''}${k==sel?'sel':''}">${d}${n?`<span>${n}</span>`:''}</button>`}
  $('#cal').innerHTML=h;
}
$('#cal').onclick=e=>{if(e.target.closest('[data-d]')){sel=e.target.closest('[data-d]').dataset.d;$('#range').value='day';renderCal();renderOrders()}};
$('#prev').onclick=()=>{cur=new Date(cur.getFullYear(),cur.getMonth()-1,1);renderCal();renderOrders()};
$('#next').onclick=()=>{cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);renderCal();renderOrders()};
$('#range').onchange=renderOrders;
function renderOrders(){
  const f=$('#range').value,today=iso(new Date()),base=sel||today,end=new Date(base+'T00:00');end.setDate(end.getDate()+7);
  let l=db.orders.filter(o=>f=='day'?o.date==base:f=='week'?o.date>=base&&o.date<iso(end):f=='month'?o.date.slice(0,7)==iso(cur).slice(0,7):o.date>=today&&o.status!='Entregado');
  l.sort((a,b)=>a.date.localeCompare(b.date));
  $('#olist').innerHTML=l.map(o=>`<div class="order s-${o.status.replace(/ /g,'')}" data-id="${o.id}">
    <b>${o.date} · ${esc(o.client)}</b>
    <small>${o.items.map(i=>`${i.qty}× ${esc(prod(i.pid)?.name||'(eliminado)')}`).join(', ')||'Sin productos'} — <b>${cop(total(o.items))}</b></small>
    ${o.notes?`<small>📝 ${esc(o.notes)}</small>`:''}
    <div><select data-st>${STATES.map(s=>`<option${s==o.status?' selected':''}>${s}</option>`).join('')}</select>
    <button class="x" data-inv title="Crear factura">🧾</button><button class="x" data-edit>✏️</button><button class="x" data-delo>🗑</button></div></div>`).join('')||'<p class="sum">No hay entregas en este filtro.</p>';
}
$('#olist').onchange=e=>{if(e.target.dataset.st!==undefined){db.orders.find(o=>o.id==e.target.closest('.order').dataset.id).status=e.target.value;save();renderOrders()}};
$('#olist').onclick=e=>{
  const el=e.target.closest('.order');if(!el)return;
  if(e.target.dataset.inv!==undefined)invoiceFromOrder(el.dataset.id);
  if(e.target.dataset.edit!==undefined)openOrder(el.dataset.id);
  if(e.target.dataset.delo!==undefined&&confirm('¿Eliminar esta entrega?')){db.orders=db.orders.filter(o=>o.id!=el.dataset.id);save();renderCal();renderOrders()}
};
function openOrder(id){
  editing=id;const o=db.orders.find(x=>x.id==id)||{date:sel||iso(new Date()),client:'',status:STATES[0],notes:'',items:[]};
  $('#oDate').value=o.date;$('#oClient').value=o.client;$('#oNotes').value=o.notes;
  $('#oState').innerHTML=STATES.map(s=>`<option${s==o.status?' selected':''}>${s}</option>`).join('');
  $('#oProd').innerHTML=db.products.map(p=>`<option value="${p.id}">${esc(p.name)} (${cop(p.price)})</option>`).join('');
  draft=o.items.map(i=>({...i}));drawDraft();$('#dlg').showModal();
}
function drawDraft(){
  $('#lines').innerHTML=draft.map((l,i)=>{const p=prod(l.pid);return `<li>${esc(p?p.name:'(eliminado)')} × ${l.qty} = ${cop((p?.price||0)*l.qty)} <button type="button" class="x" data-rm="${i}">✕</button></li>`}).join('');
  $('#oTotal').textContent=cop(total(draft));
}
$('#addOrder').onclick=()=>openOrder(null);
$('#oAdd').onclick=()=>{if($('#oProd').value){draft.push({pid:$('#oProd').value,qty:Math.max(1,+$('#oQty').value||1)});drawDraft()}};
$('#lines').onclick=e=>{if(e.target.dataset.rm!==undefined){draft.splice(+e.target.dataset.rm,1);drawDraft()}};
$('#oCancel').onclick=()=>$('#dlg').close();
$('#oForm').onsubmit=e=>{
  e.preventDefault();
  const o={id:editing||uid(),date:$('#oDate').value,client:$('#oClient').value.trim(),status:$('#oState').value,notes:$('#oNotes').value,items:draft};
  editing?db.orders[db.orders.findIndex(x=>x.id==editing)]=o:db.orders.push(o);
  save();$('#dlg').close();renderCal();renderOrders();
};

/* ---------- Perfil y respaldo ---------- */
function fillProfile(){const p=db.profile;$('#pBiz').value=p.business;$('#pPhone').value=p.phone||'';$('#pCity').value=p.city||'';$('#pUser').value=p.user}
$('#profForm').onsubmit=async e=>{
  e.preventDefault();const p=db.profile;
  Object.assign(p,{business:$('#pBiz').value,phone:$('#pPhone').value,city:$('#pCity').value,user:$('#pUser').value.trim()});
  if($('#pPw').value.length>=6){p.salt=uid()+uid();p.hash=await hash($('#pPw').value,p.salt);$('#pPw').value=''}
  save();$('#bizName').textContent=p.business;alert('Perfil guardado');
};
$('#expBtn').onclick=()=>download('respaldo-tama-'+iso(new Date())+'.json',JSON.stringify(db),'application/json');
$('#impFile').onchange=async e=>{
  try{const d=JSON.parse(await e.target.files[0].text());if(!d.profile||!Array.isArray(d.products)||!Array.isArray(d.orders))throw 0;
    if(confirm('Esto reemplaza todos tus datos actuales. ¿Continuar?')){db=d;save();location.reload()}}
  catch{alert('Archivo de respaldo no válido')}
};

/* ---------- Inicio ---------- */
if(!db.profile)showAuth(true);
else if(localStorage.getItem(SESS)||sessionStorage.getItem(SESS))start();
else showAuth(false);
