import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Boxes, History, House, Settings2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const murmurMarkUrl = new URL("./assets/murmur-mark.png", import.meta.url).href;

function NavButton({
	to,
	label,
	icon: Icon,
}: {
	to: "/home" | "/models" | "/settings" | "/cleanup" | "/history";
	label: string;
	icon: typeof House;
}) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isActive = pathname === to;

	return (
		<Button asChild variant={isActive ? "secondary" : "ghost"} className="min-w-24 shrink-0">
			<Link
				to={to}
				aria-current={isActive ? "page" : undefined}
				className="inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Icon data-icon="inline-start" />
				{label}
			</Link>
		</Button>
	);
}

export default function App({ children }: { children: ReactNode }) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isOverlayRoute = pathname === "/overlay";

	if (isOverlayRoute) {
		return <div className="h-screen overflow-hidden">{children}</div>;
	}

	return (
		<div className="flex h-screen flex-col">
			<header className="sticky top-0 z-10 px-4 pt-4 md:px-6">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:px-6">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<img src={murmurMarkUrl} alt="Murmur" className="size-12 rounded-xl shadow-sm" />
							<div className="flex flex-col gap-1">
								<p className="text-lg font-semibold leading-none">Murmur Studio</p>
								<p className="text-sm text-muted-foreground">Offline-first transcription</p>
							</div>
						</div>
						<div className="flex min-w-0 flex-1 justify-end">
							<div className="flex max-w-full flex-wrap items-center justify-end gap-2 sm:gap-1">
							<Badge variant="outline" className="whitespace-nowrap">Desktop + Web</Badge>
							<Badge variant="secondary" className="whitespace-nowrap">Local Whisper</Badge>
							</div>
						</div>
					</div>
					<Separator />
					<nav aria-label="Primary" className="flex gap-1 overflow-x-auto pb-1">
						<NavButton to="/home" label="Home" icon={House} />
						<NavButton to="/models" label="Models" icon={Boxes} />
						<NavButton to="/cleanup" label="Cleanup" icon={WandSparkles} />
						<NavButton to="/history" label="History" icon={History} />
						<NavButton to="/settings" label="Settings" icon={Settings2} />
					</nav>
				</div>
			</header>

			<main className="w-full flex-1 overflow-hidden px-4 pb-4 pt-3 md:px-6 md:pb-6">
				<div className="mx-auto h-full max-w-6xl overflow-auto p-4 md:p-6">
					<div key={pathname} className="h-full">
						{children}
					</div>
				</div>
			</main>

			<footer className="px-4 pb-3 md:px-6">
				<div className="mx-auto mb-3 max-w-6xl">
					<Separator />
				</div>
				<div className="mx-auto max-w-6xl text-xs text-muted-foreground">
					Local-first Whisper transcription with private on-device processing.
				</div>
			</footer>
		</div>
	);
}
