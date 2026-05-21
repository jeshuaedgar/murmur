import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/context/app-state";
import { router } from "@/routes/router";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <AppStateProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AppStateProvider>
  </React.StrictMode>,
);
