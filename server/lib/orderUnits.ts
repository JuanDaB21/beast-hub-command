/**
 * Fuente única de verdad de "qué cuenta como prenda".
 *
 * Una prenda es una línea de pedido con kind='product'. Las líneas kind='fee'
 * (envío, comisión COD) son cargos, no prendas; las kind='unknown' son productos
 * de Shopify que aún no existen en el catálogo y no se pagan hasta asignarlos.
 *
 * Un pedido aporta prendas al periodo en que se ENTREGÓ (delivered_at), no en el
 * que se creó: la auditoría de 2026-09 encontró 9 pedidos que cruzan de mes, y
 * usar created_at desplazaba 11 prendas de septiembre a agosto.
 */
export const GARMENT_KIND = 'product';

/** Predicado SQL de línea pagable. `alias` es el alias de order_items. */
export function garmentLineSql(alias = 'oi') {
  return `${alias}.kind = '${GARMENT_KIND}'`;
}

/**
 * Predicado SQL de pedido pagable en la ventana [from, to).
 * `$${fromIdx}` y `$${fromIdx + 1}` son los placeholders de from y to.
 */
export function deliveredInRangeSql(alias: string, fromIdx: number) {
  return `${alias}.status = 'delivered'
        AND ${alias}.delivered_at >= $${fromIdx}
        AND ${alias}.delivered_at < $${fromIdx + 1}`;
}
