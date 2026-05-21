import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import App from "@/App";
import { Spinner } from "@/components/ui/spinner";

const HomePage = lazy(async () => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const ModelsPage = lazy(async () =>
  import("@/pages/ModelsPage").then((m) => ({ default: m.ModelsPage })),
);
const SettingsPage = lazy(async () =>
  import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const CleanupPage = lazy(async () =>
  import("@/pages/CleanupPage").then((m) => ({ default: m.CleanupPage })),
);
const HistoryPage = lazy(async () =>
  import("@/pages/HistoryPage").then((m) => ({ default: m.HistoryPage })),
);
const OverlayPage = lazy(async () =>
  import("@/pages/OverlayPage").then((m) => ({ default: m.OverlayPage })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-32 items-center justify-center">
      <Spinner className="size-5" />
    </div>
  );
}

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
  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <HomePage />
    </Suspense>
  ),
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/models",
  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <ModelsPage />
    </Suspense>
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <SettingsPage />
    </Suspense>
  ),
});

const cleanupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cleanup",
  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <CleanupPage />
    </Suspense>
  ),
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <HistoryPage />
    </Suspense>
  ),
});

const overlayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/overlay",
  component: () => (
    <Suspense fallback={<RouteLoadingFallback />}>
      <OverlayPage />
    </Suspense>
  ),
});

const routeTree = rootRoute.addChildren([indexRoute, homeRoute, modelsRoute, settingsRoute, cleanupRoute, historyRoute, overlayRoute]);

export function createAppRouter() {
  return createRouter({ routeTree });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
