import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import App from "@/App";
import { HomePage } from "@/pages/HomePage";
import { ModelsPage } from "@/pages/ModelsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { CleanupPage } from "@/pages/CleanupPage";

const rootRoute = createRootRoute({
  component: () => (
    <App>
      <Outlet />
    </App>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/home" />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/home",
  component: HomePage,
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/models",
  component: ModelsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const cleanupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cleanup",
  component: CleanupPage,
});

const routeTree = rootRoute.addChildren([indexRoute, homeRoute, modelsRoute, settingsRoute, cleanupRoute]);

export function createAppRouter() {
  return createRouter({ routeTree });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
