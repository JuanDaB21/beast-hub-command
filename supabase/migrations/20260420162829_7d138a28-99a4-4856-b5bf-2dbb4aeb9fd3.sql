-- Allow anonymous access (app currently has no auth flow) for operational tables.
-- Profiles keep their stricter policies (auth-only).

-- SUPPLIERS
DROP POLICY IF EXISTS auth_insert_suppliers ON public.suppliers;
DROP POLICY IF EXISTS auth_update_suppliers ON public.suppliers;
DROP POLICY IF EXISTS auth_delete_suppliers ON public.suppliers;
DROP POLICY IF EXISTS auth_select_suppliers ON public.suppliers;
CREATE POLICY public_all_suppliers ON public.suppliers FOR ALL TO public USING (true) WITH CHECK (true);

-- RAW MATERIALS
DROP POLICY IF EXISTS auth_insert_raw_materials ON public.raw_materials;
DROP POLICY IF EXISTS auth_update_raw_materials ON public.raw_materials;
DROP POLICY IF EXISTS auth_delete_raw_materials ON public.raw_materials;
DROP POLICY IF EXISTS auth_select_raw_materials ON public.raw_materials;
CREATE POLICY public_all_raw_materials ON public.raw_materials FOR ALL TO public USING (true) WITH CHECK (true);

-- CATEGORIES / SUBCATEGORIES / COLORS / SIZES
DROP POLICY IF EXISTS auth_insert_categories ON public.categories;
DROP POLICY IF EXISTS auth_update_categories ON public.categories;
DROP POLICY IF EXISTS auth_delete_categories ON public.categories;
DROP POLICY IF EXISTS auth_select_categories ON public.categories;
CREATE POLICY public_all_categories ON public.categories FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_subcategories ON public.subcategories;
DROP POLICY IF EXISTS auth_update_subcategories ON public.subcategories;
DROP POLICY IF EXISTS auth_delete_subcategories ON public.subcategories;
DROP POLICY IF EXISTS auth_select_subcategories ON public.subcategories;
CREATE POLICY public_all_subcategories ON public.subcategories FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_colors ON public.colors;
DROP POLICY IF EXISTS auth_update_colors ON public.colors;
DROP POLICY IF EXISTS auth_delete_colors ON public.colors;
DROP POLICY IF EXISTS auth_select_colors ON public.colors;
CREATE POLICY public_all_colors ON public.colors FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_sizes ON public.sizes;
DROP POLICY IF EXISTS auth_update_sizes ON public.sizes;
DROP POLICY IF EXISTS auth_delete_sizes ON public.sizes;
DROP POLICY IF EXISTS auth_select_sizes ON public.sizes;
CREATE POLICY public_all_sizes ON public.sizes FOR ALL TO public USING (true) WITH CHECK (true);

-- ORDERS / ORDER ITEMS
DROP POLICY IF EXISTS auth_insert_orders ON public.orders;
DROP POLICY IF EXISTS auth_update_orders ON public.orders;
DROP POLICY IF EXISTS auth_delete_orders ON public.orders;
DROP POLICY IF EXISTS auth_select_orders ON public.orders;
CREATE POLICY public_all_orders ON public.orders FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_order_items ON public.order_items;
DROP POLICY IF EXISTS auth_update_order_items ON public.order_items;
DROP POLICY IF EXISTS auth_delete_order_items ON public.order_items;
DROP POLICY IF EXISTS auth_select_order_items ON public.order_items;
CREATE POLICY public_all_order_items ON public.order_items FOR ALL TO public USING (true) WITH CHECK (true);

-- PRODUCTS / PRODUCT MATERIALS
DROP POLICY IF EXISTS auth_insert_products ON public.products;
DROP POLICY IF EXISTS auth_update_products ON public.products;
DROP POLICY IF EXISTS auth_delete_products ON public.products;
DROP POLICY IF EXISTS auth_select_products ON public.products;
CREATE POLICY public_all_products ON public.products FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_product_materials ON public.product_materials;
DROP POLICY IF EXISTS auth_update_product_materials ON public.product_materials;
DROP POLICY IF EXISTS auth_delete_product_materials ON public.product_materials;
DROP POLICY IF EXISTS auth_select_product_materials ON public.product_materials;
CREATE POLICY public_all_product_materials ON public.product_materials FOR ALL TO public USING (true) WITH CHECK (true);

-- WORK ORDERS / ITEMS
DROP POLICY IF EXISTS auth_insert_work_orders ON public.work_orders;
DROP POLICY IF EXISTS auth_update_work_orders ON public.work_orders;
DROP POLICY IF EXISTS auth_delete_work_orders ON public.work_orders;
DROP POLICY IF EXISTS auth_select_work_orders ON public.work_orders;
CREATE POLICY public_all_work_orders ON public.work_orders FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_work_order_items ON public.work_order_items;
DROP POLICY IF EXISTS auth_update_work_order_items ON public.work_order_items;
DROP POLICY IF EXISTS auth_delete_work_order_items ON public.work_order_items;
DROP POLICY IF EXISTS auth_select_work_order_items ON public.work_order_items;
CREATE POLICY public_all_work_order_items ON public.work_order_items FOR ALL TO public USING (true) WITH CHECK (true);

-- RETURNS
DROP POLICY IF EXISTS auth_insert_returns ON public.returns;
DROP POLICY IF EXISTS auth_update_returns ON public.returns;
DROP POLICY IF EXISTS auth_delete_returns ON public.returns;
DROP POLICY IF EXISTS auth_select_returns ON public.returns;
CREATE POLICY public_all_returns ON public.returns FOR ALL TO public USING (true) WITH CHECK (true);

-- SUPPLY REQUESTS / ITEMS / ALERTS
DROP POLICY IF EXISTS auth_insert_supply_requests ON public.supply_requests;
DROP POLICY IF EXISTS auth_update_supply_requests ON public.supply_requests;
DROP POLICY IF EXISTS auth_delete_supply_requests ON public.supply_requests;
DROP POLICY IF EXISTS auth_select_supply_requests ON public.supply_requests;
CREATE POLICY public_all_supply_requests ON public.supply_requests FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_supply_request_items ON public.supply_request_items;
DROP POLICY IF EXISTS auth_update_supply_request_items ON public.supply_request_items;
DROP POLICY IF EXISTS auth_delete_supply_request_items ON public.supply_request_items;
DROP POLICY IF EXISTS auth_select_supply_request_items ON public.supply_request_items;
CREATE POLICY public_all_supply_request_items ON public.supply_request_items FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_insert_supply_alerts ON public.supply_alerts;
DROP POLICY IF EXISTS auth_update_supply_alerts ON public.supply_alerts;
DROP POLICY IF EXISTS auth_delete_supply_alerts ON public.supply_alerts;
DROP POLICY IF EXISTS auth_select_supply_alerts ON public.supply_alerts;
CREATE POLICY public_all_supply_alerts ON public.supply_alerts FOR ALL TO public USING (true) WITH CHECK (true);