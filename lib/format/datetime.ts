/**
 * El negocio opera en México (MXN, CLABE), así que las fechas siempre se
 * muestran en esta zona horaria — sin esto, un Server Component renderizado
 * en un proceso con TZ=UTC (p. ej. Vercel) mostraría la hora cruda en UTC en
 * vez de la hora local del usuario, aunque el valor guardado sea correcto.
 */
const TIME_ZONE = "America/Mexico_City";

export function formatDateTimeMX(date: Date): string {
  return date.toLocaleString("es-MX", { timeZone: TIME_ZONE });
}

export function formatDateMX(date: Date): string {
  return date.toLocaleDateString("es-MX", { timeZone: TIME_ZONE });
}
