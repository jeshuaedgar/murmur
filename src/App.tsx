import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function NavButton({ to, label }: { to: "/home" | "/models" | "/settings"; label: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = pathname === to;

  return (
    <Button asChild variant={isActive ? "default" : "outline"}>
      <Link to={to}>{label}</Link>
    </Button>
  );
}

export default function App({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Whisper Local STT</CardTitle>
          <CardDescription>Offline-first transcription powered by local models.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <NavButton to="/home" label="Home" />
            <NavButton to="/models" label="Models" />
            <NavButton to="/settings" label="Settings" />
          </div>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
