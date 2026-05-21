import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ModelSectionCardProps = {
  sectionId?: string;
  title: string;
  icon?: ReactNode;
  countBadge?: string;
  preContent?: ReactNode;
  children: ReactNode;
};

function ModelSectionCountBadge({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className="ml-auto">
      {value}
    </Badge>
  );
}

export function ModelSectionCard({ sectionId, title, icon, countBadge, preContent, children }: ModelSectionCardProps) {
  return (
    <Card id={sectionId}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
        </div>
        <CardDescription>Manage models in this section.</CardDescription>
        <CardAction>{countBadge ? <ModelSectionCountBadge value={countBadge} /> : null}</CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 pt-6 pb-6">
        {preContent}
        {children}
      </CardContent>
      <CardFooter className="justify-end">
        <p className="text-xs text-muted-foreground">Install or remove models as needed.</p>
      </CardFooter>
    </Card>
  );
}
