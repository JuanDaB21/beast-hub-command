import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
}
