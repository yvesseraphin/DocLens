import { useMemo, useEffect } from "react";
import { routes } from "./routes.jsx";
import { Shell } from "./components/Shell.jsx";
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { CasesPage } from "./pages/cases/CasesPage.jsx";
import { useRoute } from "./hooks/useRoute.js";
import { auth, healthCheck } from "./lib/api.js";

const PING_INTERVAL_MS = 10 * 60 * 1000;

function App() {
  const [path, navigate] = useRoute();

  const isAppPage = path
    ? path.startsWith("/dashboard") ||
      path.startsWith("/cases") ||
      path.startsWith("/reports")
    : false;

  useEffect(() => {
    if (isAppPage && !auth.isLoggedIn()) {
      navigate("/login");
    }
  }, [path, isAppPage, navigate]);

  useEffect(() => {
    healthCheck().catch(() => {});
    const id = setInterval(
      () => healthCheck().catch(() => {}),
      PING_INTERVAL_MS,
    );
    return () => clearInterval(id);
  }, []);

  const Page = useMemo(() => {
    if (!path) return LoginPage;
    const FallbackPage = isAppPage ? CasesPage : LoginPage;
    return routes[path] || FallbackPage;
  }, [path, isAppPage]);

  if (isAppPage && !auth.isLoggedIn()) return null;

  return isAppPage ? (
    <Shell path={path} navigate={navigate}>
      <Page navigate={navigate} />
    </Shell>
  ) : (
    <Page navigate={navigate} />
  );
}

export default App;
