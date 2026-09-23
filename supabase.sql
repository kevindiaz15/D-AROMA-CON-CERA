-- ================================================================
-- D'AROMA CON CERA · Configuración de Supabase
-- Pega este script completo en: Dashboard → SQL Editor → New query → Run
-- También puedes pegar línea por línea si lo prefieres.
-- Luego crea tu usuario admin en Dashboard → Authentication → Users → Add user
-- ================================================================

-- 1) Extensión para generar UUIDs
create extension if not exists pgcrypto;

-- 2) Tabla de productos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text default '',
  aroma text default '',
  tamano text default '',
  categoria text not null default 'aromaticas',
  precio integer,
  foto_url text default '',
  etiqueta text default '',
  orden integer default 0,
  activo boolean default true,
  descuento_porcentaje numeric default 0,
  etiqueta_promo text default '',
  promo_inicio date,
  promo_fin date,
  created_at timestamptz default now()
);

-- Índice de orden (la tienda ordena por esto)
create index if not exists products_orden_idx on public.products (orden, created_at);

-- 3) Seguridad: RLS
alter table public.products enable row level security;

-- Lectura pública: cualquiera puede ver los productos (la tienda)
create policy "products_lectura_publica"
  on public.products for select
  using (true);

-- Solo el admin autenticado puede crear
create policy "products_admin_insert"
  on public.products for insert
  with check (auth.role() = 'authenticated');

-- Solo el admin autenticado puede editar
create policy "products_admin_update"
  on public.products for update
  using (auth.role() = 'authenticated');

-- Solo el admin autenticado puede eliminar
create policy "products_admin_delete"
  on public.products for delete
  using (auth.role() = 'authenticated');

-- 4) Storage: bucket público para las fotos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- Fotos: todos pueden verlas
create policy "storage_productos_lectura"
  on storage.objects for select
  using (bucket_id = 'productos');

-- Fotos: solo el admin autenticado puede subir
create policy "storage_productos_insert"
  on storage.objects for insert
  with check (bucket_id = 'productos' and auth.role() = 'authenticated');

-- Fotos: solo el admin autenticado puede modificar
create policy "storage_productos_update"
  on storage.objects for update
  using (bucket_id = 'productos' and auth.role() = 'authenticated');

-- Fotos: solo el admin autenticado puede eliminar
create policy "storage_productos_delete"
  on storage.objects for delete
  using (bucket_id = 'productos' and auth.role() = 'authenticated');

-- ================================================================
-- Siguiente paso manual:
--   Authentication → Users → Add user (email + contraseña del admin)
-- Luego entra a tuweb.com/admin.html y sube tus productos y fotos.
-- ================================================================