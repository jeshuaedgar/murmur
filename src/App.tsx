import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FolderKanban, House, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function NavButton({
  to,
  label,
  icon: Icon,
}: {
  to: "/home" | "/models" | "/settings";
  label: string;
  icon: typeof House;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = pathname === to;

  return (
    <Button
      asChild
      variant={isActive ? "default" : "ghost"}
      className="min-w-24 transition-all duration-200 ease-out hover:translate-y-[-1px]"
    >
      <Link to={to} className="inline-flex items-center gap-1.5">
        <Icon className="size-4" />
        {label}
      </Link>
    </Button>
  );
}

export default function App({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="app-topbar sticky top-0 z-10 bg-card/90 backdrop-blur">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-base font-semibold leading-none">Murmur</p>
              <p className="mt-1 text-xs text-muted-foreground">Offline-first transcription</p>
            </div>
            <Badge variant="secondary">Tauri + Web Preview</Badge>
          </div>
          <nav aria-label="Primary" className="app-nav flex flex-wrap gap-1 rounded-xl p-1">
            <NavButton to="/home" label="Home" icon={House} />
            <NavButton to="/models" label="Models" icon={FolderKanban} />
            <NavButton to="/settings" label="Settings" icon={Settings2} />
          </nav>
        </div>
      </header>

      <main className="w-full flex-1 overflow-hidden p-4 md:p-6">
        <Card className="h-full border-0 bg-transparent ring-0 shadow-none">
          <CardContent className="h-full overflow-auto p-4 md:p-6">
            <div key={pathname} className="app-route-enter h-full">
              {children}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
