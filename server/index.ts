import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter, requireAuth } from './auth';
import { errorHandler } from './util';
import { runMigrations } from './migrate';
import { seedAdmin } from './seed-admin';
import { pool } from './db';
import { catalogsRouter } from './routes/catalogs';
import { suppliersRouter } from './routes/suppliers';
import { rawMaterialsRouter } from './routes/raw-materials';
import { productsRouter } from './routes/products';
import { productMaterialsRouter } from './routes/product-materials';
import { ordersRouter } from './routes/orders';
import { orderItemsRouter } from './routes/order-items';
import { codRouter } from './routes/cod';
import { logisticsRouter } from './routes/logistics';
import { workOrdersRouter } from './routes/work-orders';
import { supplyRequestsRouter } from './routes/supply-requests';
import { returnsRouter } from './routes/returns';
import { financeRouter } from './routes/finance';
import { staffRouter } from './routes/staff';
import { configRouter } from './routes/config';
import { supplierPortalRouter } from './routes/supplier-portal';
import { shopifyRouter } from './routes/shopify';
import { printDesignsRouter } from './routes/print-designs';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN;

app.use(
  cors({
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ limit: '10mb', type: 'text/plain' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
// Public: supplier portal uses its own secure_token validation.
app.use('/api/supplier-portal', supplierPortalRouter);
app.use('/api/catalogs', requireAuth, catalogsRouter);
app.use('/api/suppliers', requireAuth, suppliersRouter);
app.use('/api/raw-materials', requireAuth, rawMaterialsRouter);
app.use('/api/products', requireAuth, productsRouter);
app.use('/api/product-materials', requireAuth, productMaterialsRouter);
app.use('/api/orders', requireAuth, ordersRouter);
app.use('/api/order-items', requireAuth, orderItemsRouter);
app.use('/api/cod', requireAuth, codRouter);
app.use('/api/logistics', requireAuth, logisticsRouter);
app.use('/api/work-orders', requireAuth, workOrdersRouter);
app.use('/api/supply-requests', requireAuth, supplyRequestsRouter);
app.use('/api/returns', requireAuth, returnsRouter);
app.use('/api/finance', requireAuth, financeRouter);
app.use('/api/staff', requireAuth, staffRouter);
app.use('/api/config', requireAuth, configRouter);
app.use('/api/shopify', requireAuth, shopifyRouter);
app.use('/api/print-designs', requireAuth, printDesignsRouter);

// Serve SPA build in production: dist/ is the Vite output at repo root.
// When compiled server runs from dist/server/, static files live at ../
if (process.env.NODE_ENV === 'production') {
  const staticDir = path.resolve(__dirname, '..');
  app.use(express.static(staticDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });
}

app.use(errorHandler);

async function bootstrap() {
  console.log('[bootstrap] running migrations…');
  await runMigrations();
  console.log('[bootstrap] seeding admin…');
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`Server listening on :${PORT}`);
  });
}

bootstrap().catch(async (err) => {
  console.error('[bootstrap] failed:', err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
