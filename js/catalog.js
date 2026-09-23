/* =============================================================== */
/* D'AROMA CON CERA · Catálogo dinámico (Supabase)                 */
/* Carga productos, precios, promociones y fotos desde la BD.      */
/* =============================================================== */

let sb = null;
let productosDB = [];
let productosById = new Map();

const WHATSAPP_LINK = 'https://wa.me/message/MROPOBN2VSRBG1';
const PREFIJO_WA = WHATSAPP_LINK;

let carrito = cargarCarrito();
let filtroActivo = 'todos';
let busqueda = '';
let productoAbierto = null;

const ETIQUETAS_CAT = {
  aromaticas:'Aromáticas', decorativas:'Decorativas', personalizadas:'Personalizadas',
  regalos:'Regalos', eventos:'Eventos', combos:'Combos'
};
const CAT_ICONOS = {
  aromaticas:'fa-spa', decorativas:'fa-candles', personalizadas:'fa-pen-ruler',
  regalos:'fa-gift', eventos:'fa-champagne-glasses', combos:'fa-layer-group'
};

const formatCOP = n => n == null || n === '' ? 'Consultar' : '$' + Number(n).toLocaleString('es-CO');

/* Atributo onclick seguro: delimitado con comilla simple, JSON con dobles */
function attrClick(call){
  return 'onclick=\'' + String(call).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\'';
}

/* =============================================================== */
/* PROMOCIONES                                                     */
/* =============================================================== */
function fechaVigente(ini, fin){
  if(!ini || !fin) return false;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return hoy >= new Date(ini + 'T00:00:00') && hoy <= new Date(fin + 'T23:59:59');
}
function precioInfo(p){
  const base = (p.precio == null || p.precio === '') ? null : Number(p.precio);
  const pct = Number(p.descuento_porcentaje) || 0;
  const vigente = pct > 0 && fechaVigente(p.promo_inicio, p.promo_fin);
  const final = (base != null && vigente) ? Math.round(base * (1 - pct / 100)) : base;
  const etiqueta = vigente ? (p.etiqueta_promo || 'Oferta') : (p.etiqueta || '');
  return { base, pct, vigente, final, etiqueta };
}

/* =============================================================== */
/* SUPABASE                                                        */
/* =============================================================== */
function clienteSupabase(){
  return import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')
    .then(m => m.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key));
}
async function cargarProductos(){
  const { data, error } = await sb
    .from('products')
    .select('*')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  if(error) throw error;
  return data || [];
}

/* =============================================================== */
/* CATEGORÍAS                                                      */
/* =============================================================== */
function renderCategorias(){
  const cats = [['aromaticas','Velas aromáticas'],['decorativas','Velas decorativas'],['personalizadas','Velas personalizadas'],['regalos','Velas para regalo'],['eventos','Velas para eventos'],['combos','Combos']];
  const grid = document.getElementById('catGrid');
  grid.innerHTML = cats.map(([clave,label])=>{
    const n = productosDB.filter(p=>p.activo && p.categoria===clave).length;
    return '<div class="cat-card" data-cat="'+clave+'" onclick="filtrarPorCategoria(\''+clave+'\')">'+
      '<div class="ico"><i class="fa-solid '+CAT_ICONOS[clave]+'"></i></div>'+
      '<h3>'+label+'</h3><small><b>'+n+'</b> producto'+(n===1?'':'s')+'</small></div>';
  }).join('');
}

/* =============================================================== */
/* CATÁLOGO                                                        */
/* =============================================================== */
function renderChips(){
  const chips = document.getElementById('chips');
  const opciones = [{k:'todos',v:'Todos'},...Object.entries(ETIQUETAS_CAT).map(([k,v])=>({k,v}))];
  chips.innerHTML = opciones.map(o=>
    '<button class="chip'+(filtroActivo===o.k?' active':'')+'" data-f="'+o.k+'" onclick="setFiltro(\''+o.k+'\')">'+o.v+'</button>'
  ).join('');
}

function productosFiltrados(){
  let lista = productosDB.filter(p=>p.activo);
  if(filtroActivo!=='todos') lista = lista.filter(p=>p.categoria===filtroActivo);
  if(busqueda){
    const q = busqueda.toLowerCase();
    lista = lista.filter(p=>
      (p.nombre||'').toLowerCase().includes(q) ||
      (p.aroma||'').toLowerCase().includes(q) ||
      (p.descripcion||'').toLowerCase().includes(q) ||
      (ETIQUETAS_CAT[p.categoria]||'').toLowerCase().includes(q)
    );
  }
  return lista;
}

function infoTags(p){
  const info = precioInfo(p);
  let tags = '';
  if(info.vigente) tags += '<span class="tag promo">'+info.etiqueta+'</span>';
  else if(info.etiqueta) tags += '<span class="tag">'+info.etiqueta+'</span>';
  else if(p.categoria==='personalizadas') tags += '<span class="tag">A medida</span>';
  return tags;
}
function precioPillHTML(p){
  const info = precioInfo(p);
  if(info.base == null) return '<span class="price-pill"><span style="color:var(--dorado)">Consultar</span></span>';
  if(info.vigente) return '<span class="price-pill promo"><span class="p-old">'+formatCOP(info.base)+'</span>'+formatCOP(info.final)+'</span>';
  return '<span class="price-pill">'+formatCOP(info.base)+'</span>';
}
function arteProducto(p){
  let interior = '<div class="art-placeholder"><i class="fa-solid fa-candles"></i></div>';
  if(p.foto_url) interior = '<img class="art-img" src="'+p.foto_url+'" alt="'+(p.nombre||'')+'" loading="lazy" onerror="this.remove()">';
  return '<div class="art">'+interior+infoTags(p)+precioPillHTML(p)+'</div>';
}

function renderCatalogo(){
  const grid = document.getElementById('productGrid');
  const vacio = document.getElementById('emptyState');
  const lista = productosFiltrados();

  if(!lista.length){
    grid.innerHTML = '';
    if(!productosDB.length){
      vacio.querySelector('h3').textContent = 'Próximamente';
      vacio.querySelector('p').textContent = 'Estamos preparando nuestro catálogo con mucho cariño.';
    }else{
      vacio.querySelector('h3').textContent = 'No encontramos velas';
      vacio.querySelector('p').textContent = 'Intenta con otra palabra o pulsa el botón para ver todo el catálogo.';
    }
    vacio.classList.add('show');
    return;
  }
  vacio.classList.remove('show');
  grid.innerHTML = lista.map(p=>
    '<article class="product-card reveal visible" data-id="'+String(p.id)+'">'+
      arteProducto(p) +
      '<div class="product-body">'+
        '<h3>'+p.nombre+'</h3>'+
        '<div class="aroma"><i class="fa-solid fa-spa"></i>'+(p.aroma||'')+'</div>'+
        '<p>'+(p.descripcion||'')+'</p>'+
        '<div class="meta"><i class="fa-solid fa-fire-flame-curved"></i>'+(p.tamano||'')+' · '+(ETIQUETAS_CAT[p.categoria]||'')+'</div>'+
        '<div class="product-actions">'+
          '<button class="btn-sm btn-details" '+attrClick('abrirProducto('+JSON.stringify(String(p.id))+')')+'><i class="fa-solid fa-eye"></i> Detalles</button>'+
          '<button class="btn-sm btn-add" '+attrClick('agregarRapido('+JSON.stringify(String(p.id))+',this)')+'><i class="fa-solid fa-plus"></i> Agregar</button>'+
        '</div>'+
      '</div>'+
    '</article>'
  ).join('');
}

function setFiltro(k){
  filtroActivo = k;
  renderChips(); renderCatalogo();
  document.querySelectorAll('.cat-card').forEach(c=>c.classList.toggle('active', c.dataset.cat===k));
}
function filtrarPorCategoria(clave){
  setFiltro(clave);
  document.getElementById('catalogo').scrollIntoView({behavior:'smooth'});
}
function resetFilters(){
  filtroActivo = 'todos'; busqueda = '';
  document.getElementById('searchInput').value = '';
  renderChips(); renderCatalogo(); renderCategorias();
}

/* Búsqueda */
document.getElementById('searchInput').addEventListener('input', e=>{
  busqueda = e.target.value.trim();
  renderCatalogo();
});

/* =============================================================== */
/* MODAL DETALLE DE PRODUCTO                                       */
/* =============================================================== */
function abrirProducto(id){
  const p = productosById.get(id);
  if(!p) return;
  productoAbierto = p;
  document.getElementById('pmHead').innerHTML = p.foto_url
    ? '<img src="'+p.foto_url+'" alt="'+p.nombre+'">'
    : '<div class="pm-placeholder"><i class="fa-solid fa-candles"></i></div>';

  const presentes = {
    aromaticas:['Vela en tarro','Vela pillar con tapa','Vela en vaso de vidrio'],
    decorativas:['Tarro con flores','Pillar decorativo','Vela tallada'],
    personalizadas:['Con nombre','Con frase','Con fecha','Personalización total'],
    regalos:['Caja de regalo','Caja con flores','Solo vela'],
    eventos:['Vela individual','Set x2','Set x4 + flores'],
    combos:['Combo estándar','Combo con flores','Combo con tarros grabados']
  };
  const ops = (presentes[p.categoria]||presentes.aromaticas).map(o=>'<option>'+o+'</option>').join('');
  const info = precioInfo(p);
  const prec = info.base == null
    ? '<span style="color:var(--magenta)">Consultar</span>'
    : (info.vigente ? '<span class="p-old">'+formatCOP(info.base)+'</span>'+formatCOP(info.final) : formatCOP(info.base));

  document.getElementById('pmBody').innerHTML =
    '<h3>'+p.nombre+'</h3>'+
    '<div class="pm-aroma"><i class="fa-solid fa-spa"></i>Aroma: '+(p.aroma||'')+'</div>'+
    '<div class="pm-price">'+prec+'</div>'+
    '<p class="pm-desc">'+(p.descripcion||'')+'</p>'+
    '<div class="pm-meta">'+
      '<span class="pill"><i class="fa-solid fa-fire-flame-curved"></i>'+(p.tamano||'')+'</span>'+
      '<span class="pill"><i class="fa-solid fa-tag"></i>'+(ETIQUETAS_CAT[p.categoria]||'')+'</span>'+
    '</div>'+
    '<div class="modal-field"><label>Presentación</label>'+
    '<select id="pmPresent">'+ops+'</select></div>'+
    '<div class="qty-row"><span style="font-weight:600;font-size:.9rem;">Cantidad</span>'+
      '<div class="stepper">'+
        '<button class="step" onclick="cambiarCantModal(-1)"><i class="fa-solid fa-minus"></i></button>'+
        '<span class="n" id="pmQty">1</span>'+
        '<button class="step" onclick="cambiarCantModal(1)"><i class="fa-solid fa-plus"></i></button>'+
      '</div></div>'+
    '<div class="pm-total"><div><small>Subtotal</small><br><b id="pmSubtotal"></b></div>'+
    '<i class="fa-solid fa-fire-flame-curved" style="color:var(--dorado);font-size:1.4rem;"></i></div>'+
    '<button class="btn btn-primary btn-block" onclick="agregarDesdeModal()"><i class="fa-solid fa-bag-shopping"></i> Agregar al pedido</button>';

  actualizarSubtotalModal();
  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow='hidden';
}

function subtotalFinalDeProducto(){
  const p = productoAbierto;
  const c = parseInt(document.getElementById('pmQty').textContent)||1;
  const info = precioInfo(p);
  return { c, info };
}
function actualizarSubtotalModal(){
  const { c, info } = subtotalFinalDeProducto();
  document.getElementById('pmSubtotal').textContent = info.base == null ? 'Consultar' : formatCOP(info.final * c);
  return c;
}
function cambiarCantModal(d){
  const el = document.getElementById('pmQty');
  let n = parseInt(el.textContent)+d;
  if(n<1) n=1;
  el.textContent = n;
  actualizarSubtotalModal();
}
function agregarDesdeModal(){
  const p = productoAbierto;
  const c = actualizarSubtotalModal();
  const present = document.getElementById('pmPresent').value;
  agregarProducto(p.id, c, present);
  toast('<strong>'+p.nombre+'</strong> agregada a tu pedido','success');
  cerrarProducto();
}
function agregarRapido(id, btn){
  const p = productosById.get(id);
  if(!p) return;
  const card = btn.closest('.product-card');
  card.classList.remove('adding'); void card.offsetWidth; card.classList.add('adding');
  agregarProducto(id, 1, 'Presentación sugerida');
  toast('<strong>'+p.nombre+'</strong> agregada a tu pedido','success');
}
function cerrarProducto(){
  document.getElementById('productModal').classList.remove('open');
  if(!document.getElementById('orderModal').classList.contains('open') &&
     !document.getElementById('cartDrawer').classList.contains('open')) document.body.style.overflow='';
}

/* =============================================================== */
/* CARRITO Y PEDIDO                                                */
/* =============================================================== */
function cargarCarrito(){
  try{
    const raw = localStorage.getItem('daroma_pedido');
    let lista = raw ? JSON.parse(raw) : [];
    lista.forEach(l=>{ if(!l.clave) l.clave = String(l.id) + '|' + (l.present || 'Presentación sugerida'); });
    return Array.isArray(lista) ? lista : [];
  }catch(e){ return []; }
}
function guardarCarrito(){
  localStorage.setItem('daroma_pedido', JSON.stringify(carrito));
  renderCart(); actualizarBadges();
}

function agregarProducto(id, cantidad, present){
  const p = productosById.get(id);
  if(!p) return;
  const clave = String(id) + '|' + (present || '');
  const existente = carrito.find(l=>l.clave===clave);
  const linea = {
    clave, id:String(id),
    name:p.nombre, price:(p.precio==null||p.precio==='') ? null : Number(p.precio),
    descuento_porcentaje:Number(p.descuento_porcentaje)||0,
    promo_inicio:p.promo_inicio||null, promo_fin:p.promo_fin||null,
    etiqueta_promo:p.etiqueta_promo||'',
    size:p.tamano, foto_url:p.foto_url||'', present, qty:cantidad
  };
  if(existente) existente.qty += cantidad;
  else carrito.push(linea);
  guardarCarrito(); actualizarBadges(true);
}
function cambiarCantidad(clave, delta){
  const l = carrito.find(x=>x.clave===clave);
  if(!l) return;
  l.qty += delta;
  if(l.qty<1) l.qty=1;
  guardarCarrito();
}
function eliminarItem(clave){
  const l = carrito.find(x=>x.clave===clave);
  carrito = carrito.filter(x=>x.clave!==clave);
  guardarCarrito();
  toast('<strong>'+(l?l.name:'Producto')+'</strong> eliminado del pedido','warn');
}
function contarItems(){
  return carrito.reduce((a,l)=>a+l.qty,0);
}
function comprimirCarrito(){
  const out = [];
  carrito.forEach(l=>{
    const e = out.find(x=>x.clave===l.clave);
    if(e) e.qty+=l.qty; else out.push(Object.assign({}, l));
  });
  return out;
}
function infoViva(linea){
  const viva = productosById.get(linea.id);
  if(viva) return viva;
  return linea;
}
function subtotalLinea(linea){
  const info = precioInfo(infoViva(linea));
  return info.final == null ? null : info.final * linea.qty;
}

function renderCart(){
  const body = document.getElementById('drawerBody');
  const foot = document.getElementById('drawerFoot');
  if(!carrito.length){
    body.innerHTML = '<div class="cart-empty"><i class="fa-solid fa-candle-holder"></i><h4 style="margin-bottom:.4rem;">Tu pedido está vacío</h4><p style="font-size:.85rem;">Explora el catálogo y agrega las velas que más te gusten.</p></div>';
    foot.innerHTML = '<button class="btn btn-primary btn-block" onclick="cerrarPedido();document.getElementById(\'catalogo\').scrollIntoView({behavior:\'smooth\'})"><i class="fa-solid fa-candles"></i> Ver catálogo</button>';
    return;
  }

  const items = carrito.map(l=>{
    const p = infoViva(l);
    const info = precioInfo(p);
    const foto = p.foto_url || l.foto_url;
    const thumb = foto
      ? '<img src="'+foto+'" alt="'+(p.nombre||l.name)+'">'
      : '<i class="fa-solid fa-candles"></i>';
    const precioStr = info.base == null ? 'Consultar' : (info.vigente ? '<span class="p-old">'+formatCOP(info.base)+'</span>'+formatCOP(info.final) : formatCOP(info.base));
    const sub = info.final == null ? '' : '<span class="sub">'+formatCOP(info.final * l.qty)+'</span>';
    return '<div class="cart-item">'+
      '<div class="thumb">'+thumb+'</div>'+
      '<div class="info">'+
        '<div class="nm">'+(p.nombre||l.name)+'</div>'+
        '<div class="pr">'+precioStr+' · '+(p.tamano||l.size||'')+'</div>'+
        '<div class="present">'+l.present+'</div>'+
        '<div class="line">'+
          '<div class="mini-step">'+
            '<button '+attrClick('cambiarCantidad('+JSON.stringify(l.clave)+',-1)')+' aria-label="Restar"><i class="fa-solid fa-minus"></i></button>'+
            '<span class="qn">'+l.qty+'</span>'+
            '<button '+attrClick('cambiarCantidad('+JSON.stringify(l.clave)+',1)')+' aria-label="Sumar"><i class="fa-solid fa-plus"></i></button>'+
          '</div>'+sub+
          '<button class="remove" '+attrClick('eliminarItem('+JSON.stringify(l.clave)+')')+' title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>'+
        '</div>'+
      '</div></div>';
  }).join('');

  const subtotales = carrito.map(subtotalLinea).filter(x=>x!=null);
  const sub = subtotales.reduce((a,x)=>a+x,0);
  const hayConsultar = carrito.some(l=>precioInfo(infoViva(l)).final == null);

  body.innerHTML = items;
  foot.innerHTML =
    '<div class="row"><span>Subtotal</span><span>'+formatCOP(sub)+'</span></div>'+
    (hayConsultar?'<div class="row" style="color:var(--magenta);font-style:italic;"><span>Personalizadas</span><span>Consultar</span></div>':'')+
    '<div class="row total"><span>Total estimado</span><b>'+(hayConsultar ? formatCOP(sub)+' + consulta' : formatCOP(sub))+'</b></div>'+
    '<div class="note"><i class="fa-solid fa-circle-info"></i><span>El valor mostrado es estimado. La empresa confirmará disponibilidad, personalización, envío y valor final antes de confirmar el pedido.</span></div>'+
    '<button class="btn btn-primary btn-block" onclick="abrirSolicitudPedido()"><i class="fa-solid fa-paper-plane"></i> Solicitar pedido</button>';
}

function actualizarBadges(pop){
  const n = contarItems();
  const badge = document.getElementById('cartBadge');
  const fbadge = document.getElementById('fBadge');
  badge.textContent = n;
  fbadge.textContent = n;
  badge.classList.toggle('show', n>0);
  fbadge.style.display = n>0?'':'none';
  if(pop){
    badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
  }
}

/* Drawer */
function abrirPedido(e){
  if(e) e.preventDefault();
  renderCart();
  document.getElementById('cartDrawer').classList.add('open');
  document.body.style.overflow='hidden';
}
function cerrarPedido(){
  document.getElementById('cartDrawer').classList.remove('open');
  if(!document.getElementById('productModal').classList.contains('open') &&
     !document.getElementById('orderModal').classList.contains('open')) document.body.style.overflow='';
}
function toggleMenu(){
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('navLinks').classList.toggle('open');
}
document.getElementById('navLinks').addEventListener('click', e=>{
  if(e.target.closest('a')){ document.getElementById('hamburger').classList.remove('open'); document.getElementById('navLinks').classList.remove('open'); }
});

/* =============================================================== */
/* SOLICITAR PEDIDO (formulario)                                   */
/* =============================================================== */
function abrirSolicitudPedido(){
  if(!carrito.length){
    toast('Tu pedido está vacío. Agrega algunas velas primero','warn');
    return;
  }
  cerrarPedido();
  document.getElementById('orderForm').reset();
  document.getElementById('orderSuccess').classList.remove('show');
  document.getElementById('orderFormView').style.display='';
  document.querySelectorAll('.field .msg').forEach(m=>m.classList.remove('show'));
  document.querySelectorAll('.field input,.field select,.field textarea').forEach(el=>el.classList.remove('err'));

  const comp = comprimirCarrito();
  const subtotales = comp.map(subtotalLinea).filter(x=>x!=null);
  const sub = subtotales.reduce((a,x)=>a+x,0);
  const hayConsultar = comp.some(l=>precioInfo(infoViva(l)).final == null);
  const lineas = comp.map(l=>'<div class="rl"><span>'+l.name+' × '+l.qty+'</span><span>'+ (subtotalLinea(l)==null?'Consultar':formatCOP(subtotalLinea(l))) +'</span></div>').join('');
  document.getElementById('orderResume').innerHTML =
    '<h4><i class="fa-solid fa-bag-shopping"></i> Resumen de tu pedido</h4>'+lineas+
    '<div class="rl total"><span>Total estimado</span><b>'+(hayConsultar?'Consultar':formatCOP(sub))+'</b></div>';

  document.getElementById('orderModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function cerrarPedidoModal(){
  document.getElementById('orderModal').classList.remove('open');
  if(!document.getElementById('productModal').classList.contains('open') &&
     !document.getElementById('cartDrawer').classList.contains('open')) document.body.style.overflow='';
}

/* Validación simple */
function campoError(id, cond){
  const el = document.getElementById(id);
  const msg = el.parentElement.querySelector('.msg');
  const bad = !cond;
  el.classList.toggle('err', bad);
  if(msg) msg.classList.toggle('show', bad);
  return bad;
}
function validarEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

document.getElementById('orderForm').addEventListener('submit', function(e){
  e.preventDefault();
  let ok = true;
  ok = campoError('oNombre', document.getElementById('oNombre').value.trim().length>=2) && ok;
  ok = campoError('oWhats', /^[0-9]{7,12}$/.test((document.getElementById('oWhats').value||'').replace(/[^0-9]/g,''))) && ok;
  ok = campoError('oCorreo', validarEmail(document.getElementById('oCorreo').value.trim())) && ok;
  ok = campoError('oCiudad', document.getElementById('oCiudad').value.trim().length>=2) && ok;
  ok = campoError('oDireccion', document.getElementById('oDireccion').value.trim().length>=4) && ok;
  ok = campoError('oFecha', !!document.getElementById('oFecha').value) && ok;
  if(!ok){ toast('Revisa los campos marcados','warn'); return; }

  const nombre = document.getElementById('oNombre').value.trim();
  const fecha = new Date(document.getElementById('oFecha').value + 'T12:00:00');
  const fechaFmt = fecha.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
  const comp = comprimirCarrito();
  const subtotales = comp.map(subtotalLinea).filter(x=>x!=null);
  const sub = subtotales.reduce((a,x)=>a+x,0);
  const hayConsultar = comp.some(l=>precioInfo(infoViva(l)).final == null);

  let prod = '';
  comp.forEach(l=>{ prod += '\n* '+l.name+' x'+l.qty+(subtotalLinea(l)==null?' (Consultar)':' '+formatCOP(subtotalLinea(l))); });

  let msg = 'Hola, D\'AROMA CON CERA.\n\nQuiero realizar una solicitud de pedido.\n\nNombre: '+nombre+'\nProductos:'+prod+
    '\n\nTotal estimado: '+(hayConsultar?'Consultar':formatCOP(sub))+
    '\nFecha deseada: '+fechaFmt+'\nCiudad: '+document.getElementById('oCiudad').value.trim()+
    '\nDirección: '+document.getElementById('oDireccion').value.trim();

  document.getElementById('waOrderBtn').href = PREFIJO_WA+'?text='+encodeURIComponent(msg);

  document.getElementById('orderFormView').style.display='none';
  document.getElementById('orderSuccess').classList.add('show');
  carrito = [];
  guardarCarrito();
  toast('¡Solicitud recibida con éxito!','success');
});

/* =============================================================== */
/* COTIZACIONES                                                    */
/* =============================================================== */
document.getElementById('quoteForm').addEventListener('submit', function(e){
  e.preventDefault();
  let ok = true;
  ok = campoError('qNombre', document.getElementById('qNombre').value.trim().length>=2) && ok;
  ok = campoError('qWhats', /^[0-9]{7,12}$/.test((document.getElementById('qWhats').value||'').replace(/[^0-9]/g,''))) && ok;
  ok = campoError('qCorreo', validarEmail(document.getElementById('qCorreo').value.trim())) && ok;
  ok = campoError('qEvento', !!document.getElementById('qEvento').value) && ok;
  ok = campoError('qFecha', !!document.getElementById('qFecha').value) && ok;
  ok = campoError('qCantidad', parseInt(document.getElementById('qCantidad').value)>0) && ok;
  if(!ok){ toast('Revisa los campos marcados','warn'); return; }

  let msg = 'Hola, D\'AROMA CON CERA.\n\nQuiero solicitar una cotización.\n\n'+
    'Nombre: '+document.getElementById('qNombre').value.trim()+
    '\nWhatsApp: '+document.getElementById('qWhats').value.trim()+
    '\nCorreo: '+document.getElementById('qCorreo').value.trim()+
    '\nEvento: '+document.getElementById('qEvento').value+
    '\nFecha: '+document.getElementById('qFecha').value+
    '\nCantidad aprox.: '+document.getElementById('qCantidad').value+
    '\nTipo de vela: '+(document.getElementById('qTipoVela').value||'No especificado')+
    '\nAroma: '+(document.getElementById('qAroma').value||'No especificado')+
    '\nColor: '+(document.getElementById('qColor').value||'No especificado')+
    '\nPersonalización: '+(document.getElementById('qPersonalizacion').value||'No especificada')+
    '\nPresupuesto: '+(document.getElementById('qPresupuesto').value||'No especificado');

  if(document.getElementById('qMensaje').value.trim()){
    msg += '\n\nMensaje: '+document.getElementById('qMensaje').value.trim();
  }
  document.getElementById('waQuoteBtn').href = PREFIJO_WA+'?text='+encodeURIComponent(msg);

  this.style.display='none';
  document.getElementById('quoteSuccess').classList.add('show');
  document.getElementById('quoteSuccess').scrollIntoView({behavior:'smooth',block:'center'});
  toast('¡Gracias por tu solicitud!','success');
});

function resetQuote(){
  document.getElementById('quoteForm').reset();
  document.getElementById('quoteForm').style.display='';
  document.getElementById('quoteSuccess').classList.remove('show');
  document.querySelectorAll('.field .msg').forEach(m=>m.classList.remove('show'));
  document.querySelectorAll('.field input,.field select,.field textarea').forEach(el=>el.classList.remove('err'));
}

/* =============================================================== */
/* GALERÍA DE REDES                                                */
/* =============================================================== */
function renderGallery(){
  const gal = document.getElementById('gallery');
  const items = productosDB.filter(p=>p.activo && p.foto_url).slice(0,12);
  if(!items.length){ gal.innerHTML=''; return; }
  gal.innerHTML = items.map(p=>
    '<div class="gal-item"><img src="'+p.foto_url+'" alt="'+(p.nombre||'')+'" loading="lazy"><span><i class="fa-brands fa-instagram" style="margin-right:.3rem;"></i>@d_aromaconcera</span></div>'
  ).join('');
}

/* =============================================================== */
/* TOASTS                                                          */
/* =============================================================== */
function toast(mensaje, tipo){
  const cont = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast '+(tipo||'');
  t.innerHTML = '<i class="fa-solid '+(tipo==='warn'?'fa-triangle-exclamation':tipo==='success'?'fa-circle-check':'fa-fire-flame-curved')+' ic"></i><span>'+mensaje+'</span>';
  cont.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(()=>t.remove(),500);
  },2800);
}

/* =============================================================== */
/* REVEAL AL SCROLL + ESC                                           */
/* =============================================================== */
const io = new IntersectionObserver((entries)=>{
  entries.forEach(en=>{
    if(en.isIntersecting){
      en.target.classList.add('visible');
      io.unobserve(en.target);
    }
  });
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

document.addEventListener('keydown', e=>{
  if(e.key==='Escape'){
    cerrarProducto(); cerrarPedido(); cerrarPedidoModal();
    document.getElementById('hamburger').classList.remove('open');
    document.getElementById('navLinks').classList.remove('open');
  }
});

/* =============================================================== */
/* INICIALIZACIÓN                                                   */
/* =============================================================== */
async function init(){
  try{
    sb = await clienteSupabase();
    productosDB = await cargarProductos();
    productosById = new Map(productosDB.map(p=>[String(p.id), p]));
    renderCategorias();
    renderChips();
    renderCatalogo();
    renderGallery();
    renderCart();
    actualizarBadges();
  }catch(err){
    console.error('Error cargando catálogo', err);
    const vacio = document.getElementById('emptyState');
    vacio.querySelector('h3').textContent = 'No pudimos cargar el catálogo';
    vacio.querySelector('p').textContent = 'Revisa tu conexión o intenta de nuevo en unos segundos.';
    const btn = vacio.querySelector('button');
    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reintentar';
    btn.onclick = ()=>{ location.reload(); };
    vacio.classList.add('show');
  }
}
init();