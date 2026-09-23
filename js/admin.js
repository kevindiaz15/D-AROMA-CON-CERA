/* =============================================================== */
/* D'AROMA CON CERA · Panel administrador (Supabase Auth + RLS)    */
/* =============================================================== */

let sb = null;
let admProductos = [];
let editandoId = null;
let fotoPendiente = null;   /* File a subir (o null) */
let quitarFoto = false;

const CATS = [
  ['aromaticas','Aromáticas'],['decorativas','Decorativas'],['personalizadas','Personalizadas'],
  ['regalos','Regalos'],['eventos','Eventos'],['combos','Combos']
];

const $ = id => document.getElementById(id);

function uid(){
  try{ if(crypto && crypto.randomUUID) return crypto.randomUUID(); }catch(e){}
  return 'f' + Date.now() + Math.floor(Math.random()*1e6);
}
const fmtCOP = n => (n==null||n==='') ? 'Consultar' : '$' + Number(n).toLocaleString('es-CO');

/* Atributo de evento seguro: delimitado con comilla simple, JSON con dobles */
function attrEvt(evt, call){
  return evt+'=\'' + String(call).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\'';
}
function attrClick(call){ return attrEvt('onclick', call); }

/* ---------- Promos ---------- */
function fechaVigente(ini, fin){
  if(!ini || !fin) return false;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return hoy >= new Date(ini + 'T00:00:00') && hoy <= new Date(fin + 'T23:59:59');
}
function precioInfo(p){
  const base = (p.precio == null || p.precio === '') ? null : Number(p.precio);
  const pct = Number(p.descuento_porcentaje) || 0;
  const vigente = pct > 0 && fechaVigente(p.promo_inicio, p.promo_fin);
  const final = (base != null && vigente) ? Math.round(base * (1 - pct/100)) : base;
  return { base, pct, vigente, final, etiqueta: vigente ? (p.etiqueta_promo || 'Oferta') : '' };
}

/* ---------- Supabase ---------- */
function clienteSupabase(){
  return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(m => m.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key));
}

function toast(msg, tipo){
  const cont = $('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + (tipo || '');
  t.innerHTML = '<i class="fa-solid '+(tipo==='error'?'fa-circle-xmark':'fa-circle-check')+'"></i><span>'+msg+'</span>';
  cont.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 500); }, 2600);
}

/* ---------- Vistas ---------- */
function mostrarLogin(){
  $('loginView').classList.remove('hidden');
  $('dashView').classList.add('hidden');
  $('loginMsg').textContent = '';
}
function mostrarDash(){
  $('loginView').classList.add('hidden');
  $('dashView').classList.remove('hidden');
  cargarProductos();
}

/* ---------- Carga y pintado ---------- */
async function cargarProductos(){
  const { data, error } = await sb.from('products').select('*').order('orden',{ascending:true}).order('created_at',{ascending:true});
  if(error){ toast('Error al cargar productos','error'); return; }
  admProductos = data || [];
  renderStats();
  renderFiltroCat();
  renderLista();
}

function renderStats(){
  const total = admProductos.length;
  const activos = admProductos.filter(p=>p.activo).length;
  const enPromo = admProductos.filter(p=>p.activo && precioInfo(p).vigente).length;
  $('stats').innerHTML =
    '<div class="stat"><div class="ic blue"><i class="fa-solid fa-candles"></i></div><div><b>'+total+'</b><small>Productos totales</small></div></div>'+
    '<div class="stat"><div class="ic green"><i class="fa-solid fa-circle-check"></i></div><div><b>'+activos+'</b><small>Activos en tienda</small></div></div>'+
    '<div class="stat"><div class="ic gold"><i class="fa-solid fa-tags"></i></div><div><b>'+enPromo+'</b><small>Con promo vigente</small></div></div>';
}

function renderFiltroCat(){
  const sel = $('admFiltroCat');
  if(sel.options.length > 1) return;
  sel.innerHTML = '<option value="">Todas las categorías</option>' + CATS.map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
}

function listaFiltrada(){
  const q = $('admSearch').value.trim().toLowerCase();
  const c = $('admFiltroCat').value;
  return admProductos.filter(p=>{
    if(c && p.categoria !== c) return false;
    if(q && !((p.nombre||'')+(p.aroma||'')+(p.descripcion||'')).toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderLista(){
  const list = listaFiltrada();
  $('admEmpty').classList.toggle('hidden', list.length>0);
  $('admList').innerHTML = list.map(p=>{
    const info = precioInfo(p);
    let precios = '<span class="precio">'+fmtCOP(p.precio);
    if(info.vigente) precios += ' <span class="p-old">'+fmtCOP(info.final)+'</span> <span class="adm-promo">-'+info.pct+'% '+(info.etiqueta||'').toUpperCase()+'</span>';
    precios += '</span>';
    const thumb = p.foto_url
      ? '<img src="'+p.foto_url+'" alt="">'
      : '<i class="fa-solid fa-candles"></i>';
    const badge = p.activo ? '' : '<span class="adm-off">Oculta</span>';
    return '<div class="adm-item">'+
      '<div class="thumb">'+thumb+'</div>'+
      '<div class="info">'+
        '<div class="nm">'+p.nombre+' <span class="adm-cat">'+catNombre(p.categoria)+'</span> '+(p.etiqueta?'<span class="adm-promo">'+p.etiqueta+'</span>':'')+' '+badge+'</div>'+
        '<div class="aroma">'+(p.aroma||'')+(p.tamano?' · '+p.tamano:'')+'</div>'+
        precios+
      '</div>'+
      '<div class="acc">'+
        '<label class="switch'+(p.activo?' live':'')+'" title="'+(p.activo?'Activo en tienda':'Oculto de la tienda')+'"><input type="checkbox" '+(p.activo?'checked':'')+' '+attrEvt('onchange','toggleActivo('+JSON.stringify(String(p.id))+',this)')+'><i class="fa-solid '+(p.activo?'fa-eye':'fa-eye-slash')+'"></i></label>'+
        '<button title="Editar" '+attrClick('abrirForm('+JSON.stringify(String(p.id))+')')+'><i class="fa-solid fa-pen"></i></button>'+
        '<button title="Eliminar" class="del" '+attrClick('eliminarProducto('+JSON.stringify(String(p.id))+')')+'><i class="fa-solid fa-trash-can"></i></button>'+
      '</div>'+
    '</div>';
  }).join('');
}
function catNombre(k){
  const f = CATS.find(c=>c[0]===k);
  return f ? f[1] : k;
}

/* ---------- Acciones ---------- */
async function toggleActivo(id, chk){
  const ok = chk.checked;
  const { error } = await sb.from('products').update({ activo: ok }).eq('id', id);
  if(error){ toast('No se pudo actualizar','error'); cargarProductos(); return; }
  toast(ok ? 'Producto visible en la tienda' : 'Producto oculto de la tienda');
  cargarProductos();
}

async function eliminarProducto(id){
  const p = admProductos.find(x=>String(x.id)===String(id));
  if(!p) return;
  if(!confirm('¿Eliminar "'+(p.nombre||'este producto')+'" definitivamente?')) return;
  if(p.foto_url) await quitarFotoDeUrl(p.foto_url);
  const { error } = await sb.from('products').delete().eq('id', id);
  if(error){ toast('No se pudo eliminar','error'); return; }
  toast('Producto eliminado');
  cargarProductos();
}

/* ---------- Storage ---------- */
async function subirArchivo(file){
  const path = 'productos/' + uid() + '_' + file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const { error } = await sb.storage.from('productos').upload(path, file, { upsert: true });
  if(error) throw error;
  return sb.storage.from('productos').getPublicUrl(path).data.publicUrl;
}
async function quitarFotoDeUrl(url){
  try{
    const marca = '/productos/';
    const idx = url.indexOf(marca);
    if(idx < 0) return;
    const path = decodeURIComponent(url.slice(idx + marca.length).split('?')[0]);
    await sb.storage.from('productos').remove([path]);
  }catch(e){}
}

/* ---------- Formulario ---------- */
function abrirForm(id){
  editandoId = id ? String(id) : null;
  fotoPendiente = null;
  quitarFoto = false;

  $('formMsg').textContent = '';
  $('modTitle').textContent = editandoId ? 'Editar producto' : 'Nuevo producto';

  if(editandoId){
    const p = admProductos.find(x=>String(x.id)===editandoId) || {};
    $('fNombre').value = p.nombre || '';
    $('fCategoria').value = p.categoria || CATS[0][0];
    $('fAroma').value = p.aroma || '';
    $('fTamano').value = p.tamano || '';
    $('fDescripcion').value = p.descripcion || '';
    $('fPrecio').value = (p.precio == null || p.precio === '') ? '' : String(p.precio);
    $('fEtiqueta').value = p.etiqueta || '';
    $('fDescuento').value = p.descuento_porcentaje ? String(p.descuento_porcentaje) : '';
    $('fEtiquetaPromo').value = p.etiqueta_promo || '';
    $('fInicio').value = p.promo_inicio || '';
    $('fFin').value = p.promo_fin || '';
    $('fActivo').checked = p.activo !== false;

    if(p.foto_url){
      $('fotoPreview').src = p.foto_url;
      $('fotoPreviewWrap').classList.remove('hidden');
      $('fotoDrop').classList.add('hidden');
    }else{
      $('fotoPreviewWrap').classList.add('hidden');
      $('fotoDrop').classList.remove('hidden');
    }
  }else{
    $('productForm').reset();
    $('fActivo').checked = true;
    $('fotoPreviewWrap').classList.add('hidden');
    $('fotoDrop').classList.remove('hidden');
  }

  $('formModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function cerrarForm(){
  $('formModal').classList.remove('open');
  document.body.style.overflow = '';
}

function prepararFoto(file){
  if(!file) return;
  if(!file.type.startsWith('image/')){
    toast('El archivo debe ser una imagen','error');
    return;
  }
  if(file.size > 5 * 1024 * 1024){
    toast('La imagen supera los 5 MB','error');
    return;
  }
  fotoPendiente = file;
  quitarFoto = false;
  $('fotoPreview').src = URL.createObjectURL(file);
  $('fotoPreviewWrap').classList.remove('hidden');
  $('fotoDrop').classList.add('hidden');
}

async function guardarProducto(e){
  e.preventDefault();
  const btn = $('btnGuardar');
  btn.disabled = true;

  try{
    const nombre = $('fNombre').value.trim();
    if(!nombre){ $('formMsg').textContent = 'El nombre es obligatorio.'; btn.disabled = false; return; }

    const precioVal = $('fPrecio').value.trim();
    const descuentoVal = $('fDescuento').value.trim();
    const payload = {
      nombre,
      categoria: $('fCategoria').value,
      aroma: $('fAroma').value.trim(),
      tamano: $('fTamano').value.trim(),
      descripcion: $('fDescripcion').value.trim(),
      precio: precioVal === '' ? null : parseInt(precioVal, 10),
      etiqueta: $('fEtiqueta').value.trim(),
      descuento_porcentaje: descuentoVal === '' ? 0 : Math.max(0, Math.min(100, parseInt(descuentoVal, 10))),
      etiqueta_promo: $('fEtiquetaPromo').value.trim(),
      promo_inicio: $('fInicio').value || null,
      promo_fin: $('fFin').value || null,
      activo: $('fActivo').checked
    };

    /* Foto */
    let fotoUrl = editandoId ? ((admProductos.find(x=>String(x.id)===editandoId)||{}).foto_url || '') : '';
    if(fotoPendiente){
      const urlNueva = await subirArchivo(fotoPendiente);
      if(fotoUrl) await quitarFotoDeUrl(fotoUrl);
      fotoUrl = urlNueva;
    }else if(editandoId && quitarFoto){
      if(fotoUrl) await quitarFotoDeUrl(fotoUrl);
      fotoUrl = '';
    }
    payload.foto_url = fotoUrl;

    let error = null;
    if(editandoId){
      ({ error } = await sb.from('products').update(payload).eq('id', editandoId));
    }else{
      ({ error } = await sb.from('products').insert([payload]));
    }
    if(error) throw error;

    toast(editandoId ? 'Producto actualizado' : 'Producto creado');
    cerrarForm();
    cargarProductos();
  }catch(err){
    console.error(err);
    $('formMsg').textContent = (err && err.message) ? err.message : 'Ocurrió un error al guardar.';
  }finally{
    btn.disabled = false;
  }
}

/* ---------- Inicialización ---------- */
document.getElementById('loginForm').addEventListener('submit', async e=>{
  e.preventDefault();
  $('loginMsg').textContent = '';
  const email = $('admEmail').value.trim();
  const pass = $('admPass').value;
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error){
    $('loginMsg').textContent = 'Usuario o contraseña incorrectos.';
    toast('No se pudo iniciar sesión','error');
  }else{
    toast('¡Bienvenida! Sesión iniciada');
    mostrarDash();
  }
});

$('btnLogout').addEventListener('click', ()=> sb.auth.signOut());

$('btnNuevo').addEventListener('click', ()=> abrirForm());
$('productForm').addEventListener('submit', guardarProducto);
$('admSearch').addEventListener('input', renderLista);
$('admFiltroCat').addEventListener('change', renderLista);

/* Foto: clic y arrastrar */
$('fotoDrop').addEventListener('click', ()=> $('fFoto').click());
$('fFoto').addEventListener('change', e=> prepararFoto(e.target.files[0]));
['dragover','dragenter'].forEach(evt=>{
  $('fotoDrop').addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); $('fotoDrop').classList.add('over'); });
});
['dragleave','drop'].forEach(evt=>{
  $('fotoDrop').addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); $('fotoDrop').classList.remove('over'); });
});
$('fotoDrop').addEventListener('drop', e=> prepararFoto(e.dataTransfer.files[0]));
$('btnQuitarFoto').addEventListener('click', ()=>{
  fotoPendiente = null;
  if(!editandoId){ quitarFoto = false; $('fotoPreviewWrap').classList.add('hidden'); $('fotoDrop').classList.remove('hidden'); return; }
  quitarFoto = true;
  $('fotoPreviewWrap').classList.add('hidden');
  $('fotoDrop').classList.remove('hidden');
});

/* Cerrar modal con tecla Escape */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') cerrarForm();
});

/* Arranque */
async function initAdmin(){
  try{
    sb = await clienteSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if(session) mostrarDash(); else mostrarLogin();

    sb.auth.onAuthStateChange((evt, ses)=>{
      if(ses) mostrarDash(); else mostrarLogin();
    });
  }catch(err){
    console.error(err);
    $('loginMsg').textContent = 'No se pudo conectar con Supabase. Revisa js/config.js';
  }
}
initAdmin();