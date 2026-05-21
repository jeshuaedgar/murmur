import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Boxes, House, Settings2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const murmurMarkUrl = new URL("./assets/murmur-mark.png", import.meta.url).href;

function NavButton({
	to,
	label,
	icon: Icon,
}: {
	to: "/home" | "/models" | "/settings" | "/cleanup";
	label: string;
	icon: typeof House;
}) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isActive = pathname === to;

	return (
		<Button asChild variant={isActive ? "secondary" : "ghost"} className="min-w-24">
			<Link to={to} className="inline-flex items-center gap-1.5">
				<Icon />
				{label}
			</Link>
		</Button>
	);
}

export default function App({ children }: { children: ReactNode }) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<div className="flex h-screen flex-col">
			<header className="sticky top-0 z-10">
				<div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
					<div className="flex items-center gap-3">
						<div className="flex items-center gap-3">
							<img src={murmurMarkUrl} alt="Murmur" className="size-14" />
							<p className="mt-1">
								Offline-first transcription
							</p>
						</div>
						<Badge variant="secondary">Tauri + Web Preview</Badge>
					</div>
					<nav aria-label="Primary" className="flex flex-wrap gap-1 p-1">
						<NavButton to="/home" label="Home" icon={House} />
						<NavButton to="/models" label="Models" icon={Boxes} />
						<NavButton to="/cleanup" label="Cleanup" icon={WandSparkles} />
						<NavButton to="/settings" label="Settings" icon={Settings2} />
					</nav>
				</div>
			</header>

			<main className="w-full flex-1 overflow-hidden p-4 md:p-6">
				<div className="mx-auto h-full max-w-5xl overflow-auto p-4 md:p-6">
					<div key={pathname} className="h-full">
						{children}
					</div>
				</div>
			</main>

			<footer>
				<div className="mx-auto max-w-5xl px-4 py-2 md:px-6">
					Local-first Whisper transcription
				</div>
			</footer>
		</div>
	);
}
