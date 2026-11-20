// Cambia presupuestos diarios por fase según `budget_phases` de un plan (por defecto black-week.plan.json).
// Uso: node scripts/meta-ads/budgets.cjs <fase> [--apply] [--plan=archivo]
// Sin --apply solo muestra el antes/después. Cada entrada de la fase: { id, nombre, daily_budget } (campaña CBO o conjunto ABO).
const fs = require('fs');
const path = require('path');
const { get, post } = require('./metaApi.cjs');

const PLAN_FILE = process.argv.find((a) => a.startsWith('--plan='))?.slice(7) || 'black-week.plan.json';
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, PLAN_FILE), 'utf8'));
const [phase] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
const items = plan.budget_phases?.[phase];
if (!items) throw new Error(`Fase desconocida «${phase}». Fases: ${Object.keys(plan.budget_phases ?? {}).join(', ')}`);

(async () => {
  let total = 0;
  for (const it of items) {
    const cur = await get(it.id, { fields: 'name,daily_budget,effective_status' });
    total += it.daily_budget;
    console.log(`${it.nombre}: ${cur.daily_budget} → ${it.daily_budget} (${cur.effective_status})`);
    if (APPLY && Number(cur.daily_budget) !== it.daily_budget) await post(it.id, { daily_budget: it.daily_budget });
  }
  console.log(`Total fase «${phase}»: ${total}/día${APPLY ? ' · aplicado' : ' · dry-run (agrega --apply)'}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
