// Costo unitario y comisiones por pedido, compartidos por los generadores de análisis.

// Costo unitario por variante: fórmula canónica de ProductProfitPanel / bi/api.ts.
// Parámetros: $1 = printing_cost_per_meter, $2 = ironing_cost (de global_configs).
const COST_SQL = `
  SELECT p.id,
    COALESCE((SELECT SUM(pm.quantity_required * rm.unit_price) FROM product_materials pm
              JOIN raw_materials rm ON rm.id = pm.raw_material_id WHERE pm.product_id = p.id), 0)
  + COALESCE((SELECT SUM(pr.cost) FROM product_processes pp
              JOIN production_processes pr ON pr.id = pp.process_id WHERE pp.product_id = p.id), 0)
  + p.print_height_cm / 100.0 * $1 + $2 AS unit_cost
  FROM products p WHERE NOT p.is_parent`;

// Costos variables por pedido (sin flete: es pase directo, ver AUDITORIA_CRO §4).
// o = { source, gw, gross }; cfg = global_configs como números.
function orderFees(o, cfg) {
  const shopifyFee = o.source === 'shopify' ? (o.gross * (cfg.shopify_fee_percent || 0)) / 100 : 0;
  const gateway = /wompi/i.test(o.gw) ? (o.gross * (cfg.gateway_fee_percent || 0)) / 100 + (cfg.gateway_fee_fixed || 0) : 0;
  return shopifyFee + gateway; // la comisión COD (5 %) la paga el cliente en la puerta
}

module.exports = { COST_SQL, orderFees };
