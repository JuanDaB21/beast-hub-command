import { useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Save,
  ShoppingBag,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  useSaveShopifyConfig,
  useShopifyConfig,
  useSyncShopifyOrders,
  useSyncShopifyProducts,
  useTestShopifyConnection,
  useImportShopifyProductsCsv,
  useImportShopifyOrdersCsv,
  type SyncProductsResult,
  type SyncOrdersResult,
} from "@/features/shopify/api";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function SyncResultToast({
  result,
  type,
}: {
  result: SyncProductsResult | SyncOrdersResult;
  type: "products" | "orders";
}) {
  const count =
    type === "products"
      ? (result as SyncProductsResult).upserted
      : (result as SyncOrdersResult).imported;
  const label = type === "products" ? "variantes" : "órdenes";
  const synthesized =
    type === "products" ? (result as SyncProductsResult).synthesized_skus : 0;
  const lines = [
    `${count} ${label} sincronizadas`,
    `${result.skipped} omitidas`,
    synthesized > 0 ? `${synthesized} SKUs generados` : null,
    result.errors.length > 0 ? `${result.errors.length} errores` : null,
  ].filter(Boolean);
  return <div className="text-sm">{lines.join(" · ")}</div>;
}

function CsvImportSection({
  label,
  instructions,
  onImport,
  isPending,
}: {
  label: string;
  instructions: string;
  onImport: (text: string) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
  };

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: "Selecciona un archivo CSV", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      onImport(text);
    };
    reader.readAsText(file, "utf-8");
  };

  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">{instructions}</p>
          <div className="flex items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="text-xs"
            />
          </div>
          {fileName && (
            <p className="text-xs text-muted-foreground">Archivo: {fileName}</p>
          )}
          <Button
            size="sm"
            onClick={handleImport}
            disabled={isPending || !fileName}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isPending ? "Importando…" : "Importar CSV"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ShopifyPanel() {
  const { data: cfg, isLoading } = useShopifyConfig();
  const save = useSaveShopifyConfig();
  const testConn = useTestShopifyConnection();
  const syncProducts = useSyncShopifyProducts();
  const syncOrders = useSyncShopifyOrders();
  const importProductsCsv = useImportShopifyProductsCsv();
  const importOrdersCsv = useImportShopifyOrdersCsv();

  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);

  if (!initialized && cfg) {
    setDomain(cfg.store_domain ?? "");
    setToken(cfg.access_token ?? "");
    setSyncEnabled(cfg.sync_enabled ?? false);
    setInitialized(true);
  }

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        store_domain: domain,
        access_token: token.startsWith("****") ? undefined : token,
        sync_enabled: syncEnabled,
      });
      toast({ title: "Configuración de Shopify guardada" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleTest = async () => {
    try {
      const res = await testConn.mutateAsync();
      const lines = [
        res.products_count !== null
          ? `Productos: ${res.products_count}`
          : `Productos: sin acceso (${res.products_error})`,
        res.orders_count !== null
          ? `Órdenes: ${res.orders_count}`
          : `Órdenes: sin acceso (${res.orders_error})`,
      ];
      const allGood = res.products_count !== null && res.orders_count !== null;
      toast({
        title: `Conexión exitosa — ${res.shop}`,
        description: <div className="text-sm space-y-0.5">{lines.map((l) => <div key={l}>{l}</div>)}</div>,
        variant: allGood ? undefined : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Error de conexión", description: e.message, variant: "destructive" });
    }
  };

  const handleSyncProducts = async () => {
    try {
      const result = await syncProducts.mutateAsync();
      toast({
        title: "Productos sincronizados",
        description: <SyncResultToast result={result} type="products" />,
      });
    } catch (e: any) {
      toast({ title: "Error al sincronizar productos", description: e.message, variant: "destructive" });
    }
  };

  const handleSyncOrders = async () => {
    try {
      const result = await syncOrders.mutateAsync();
      toast({
        title: "Órdenes sincronizadas",
        description: <SyncResultToast result={result} type="orders" />,
      });
    } catch (e: any) {
      toast({ title: "Error al sincronizar órdenes", description: e.message, variant: "destructive" });
    }
  };

  const handleImportProductsCsv = async (text: string) => {
    try {
      const result = await importProductsCsv.mutateAsync(text);
      toast({
        title: "Productos importados",
        description: <SyncResultToast result={result} type="products" />,
      });
    } catch (e: any) {
      toast({ title: "Error al importar", description: e.message, variant: "destructive" });
    }
  };

  const handleImportOrdersCsv = async (text: string) => {
    try {
      const result = await importOrdersCsv.mutateAsync(text);
      toast({
        title: "Órdenes importadas",
        description: <SyncResultToast result={result} type="orders" />,
      });
    } catch (e: any) {
      toast({ title: "Error al importar", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const hasCredentials = !!(cfg?.store_domain && cfg?.access_token);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Credenciales Shopify
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Crea una app privada en Shopify Admin → Configuración → Apps → Desarrollar apps.
            Necesitas permisos de lectura en <strong>Products</strong> y{" "}
            <strong>Orders</strong>.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shopify-domain">Dominio de la tienda</Label>
            <Input
              id="shopify-domain"
              placeholder="mi-tienda.myshopify.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shopify-token">Access Token</Label>
            <Input
              id="shopify-token"
              type="password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              El token se guarda cifrado. Ingresa uno nuevo solo si quieres reemplazarlo.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="sync-enabled"
              checked={syncEnabled}
              onCheckedChange={setSyncEnabled}
            />
            <Label htmlFor="sync-enabled" className="cursor-pointer">
              Integración habilitada
            </Label>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSave} disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testConn.isPending || !hasCredentials}
            >
              {testConn.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : hasCredentials ? (
                <Wifi className="h-4 w-4 mr-1.5" />
              ) : (
                <WifiOff className="h-4 w-4 mr-1.5 text-muted-foreground" />
              )}
              Probar conexión
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronización directa
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Descarga datos directamente desde la API de Shopify. Requiere credenciales guardadas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Productos / Variantes</p>
                {cfg?.last_products_sync && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Última sync: {formatDate(cfg?.last_products_sync)}
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={handleSyncProducts}
                disabled={syncProducts.isPending || !hasCredentials}
              >
                {syncProducts.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {syncProducts.isPending ? "Sincronizando…" : "Sincronizar productos"}
              </Button>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Órdenes</p>
                {cfg?.last_orders_sync && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Última sync: {formatDate(cfg?.last_orders_sync)}
              </p>
              <Button
                size="sm"
                className="w-full"
                onClick={handleSyncOrders}
                disabled={syncOrders.isPending || !hasCredentials}
              >
                {syncOrders.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {syncOrders.isPending ? "Sincronizando…" : "Sincronizar órdenes"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar desde CSV
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Alternativa si no quieres usar la API directa. Exporta el archivo desde Shopify Admin y
            cárgalo aquí.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <CsvImportSection
            label="Importar Productos"
            instructions="En Shopify Admin → Productos → Exportar → Exportar productos → CSV para Excel. Luego sube el archivo aquí."
            onImport={handleImportProductsCsv}
            isPending={importProductsCsv.isPending}
          />
          <CsvImportSection
            label="Importar Órdenes"
            instructions="En Shopify Admin → Órdenes → Exportar → Exportar órdenes → CSV para Excel. Luego sube el archivo aquí."
            onImport={handleImportOrdersCsv}
            isPending={importOrdersCsv.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
