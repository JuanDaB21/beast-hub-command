import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShaderBackdrop } from "@/components/shared/ShaderBackdrop";
import { BrandMark } from "@/components/layout/BrandMark";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [loading, user, from, navigate]);

  if (!loading && user) return <Navigate to={from} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email, password);
      toast({ title: "Bienvenido" });
      navigate(from, { replace: true });
    } catch (err) {
      toast({
        title: "No se pudo iniciar sesión",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-svh bg-[#0e1014] text-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(26rem,0.85fr)]">
      {/* Momento de marca: fondo shader a todo el panel */}
      <div className="relative h-[42svh] overflow-hidden lg:sticky lg:top-0 lg:h-svh">
        <ShaderBackdrop className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1014] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#0e1014]/40" />
        <div className="relative flex h-full flex-col justify-between p-6 pt-safe sm:p-10">
          <BrandMark className="text-white" />
          <p className="max-w-md pb-6 font-display text-[2.75rem] font-bold leading-[0.9] sm:text-6xl lg:pb-0 lg:text-7xl">
            Cada pedido, prenda y peso, bajo control.
          </p>
        </div>
      </div>

      <div className="relative -mt-8 rounded-t-3xl bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-foreground lg:mt-0 lg:flex lg:items-center lg:rounded-none lg:px-14">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-4xl font-semibold leading-none">Iniciar sesión</h1>
          <p className="mb-7 mt-2 text-sm text-muted-foreground">Beast Hub Command, centro de operación.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              className="h-11"
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              className="h-11"
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="brand" className="h-11 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </form>
          <p className="mt-6 text-xs text-muted-foreground">
            ¿No tienes cuenta? Pide a un administrador que te cree un usuario desde Configuración.
          </p>
        </div>
      </div>
    </div>
  );
}
