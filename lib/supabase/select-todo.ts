/**
 * PostgREST devuelve como mucho 1000 filas por petición (límite del proyecto en
 * Supabase) y lo hace en silencio: sin error, simplemente se corta. Para tablas
 * que crecen (time_entries…) hay que pedir por tramos con `.range()`.
 *
 * `consulta` debe construir la query desde cero en cada llamada e incluir un
 * `.order()` estable; si no, los tramos pueden solaparse o saltarse filas.
 *
 *   const data = await selectTodo((desde, hasta) =>
 *     supabase.from('time_entries').select('*').eq('user_id', id)
 *       .order('fecha').order('hora_inicio').range(desde, hasta))
 */
const TRAMO = 1000

export async function selectTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += TRAMO) {
    const { data, error } = await consulta(desde, desde + TRAMO - 1)
    if (error) throw new Error(error.message)
    if (!data) break
    filas.push(...data)
    if (data.length < TRAMO) break
  }
  return filas
}
