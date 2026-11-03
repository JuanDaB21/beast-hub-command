import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="text-center">
        <p className="tabular font-display text-[7rem] font-bold leading-none text-brand">404</p>
        <p className="mb-6 mt-2 text-lg text-muted-foreground">Esta página no existe.</p>
        <Link to="/" className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
