-- Urban Analyst — superficie construida computable a edificabilidad.
-- El bruto catastral (built_area) incluye garaje y trastero/almacén anejo, que
-- NO computan a edificabilidad. built_area_computable guarda el bruto menos esos
-- usos (estimación INFERIDO a partir de los elementos constructivos de Catastro,
-- DNPRC); built_area_desglose guarda el detalle por uso para mostrarlo y auditarlo.

alter table public.urban_assets
  add column if not exists built_area_computable numeric,
  add column if not exists built_area_desglose jsonb;

notify pgrst, 'reload schema';
