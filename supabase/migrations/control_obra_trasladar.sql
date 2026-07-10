-- Control de obra — flag por partida: ¿el cambio se traslada al cliente?
-- Si es false, el cliente sigue viendo/pagando el precio del baseline aunque
-- internamente el coste/importe real haya cambiado (absorbemos el sobrecoste
-- o nos quedamos el ahorro). No afecta a coste, proveedores ni tesorería.

alter table public.obra_control_partidas
  add column if not exists trasladar_cliente boolean not null default true;

notify pgrst, 'reload schema';
