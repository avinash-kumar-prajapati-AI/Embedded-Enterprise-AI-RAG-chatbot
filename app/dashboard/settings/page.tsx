import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, session.user.tenantId));

  if (!tenant) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workspace settings</h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </div>

      <Card className="border-2 border-border-strong shadow-hard">
        <CardHeader>
          <CardTitle>{tenant.name}</CardTitle>
          <CardDescription>
            Signed in as {session.user.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Plan
            </span>
            <Badge variant="secondary">{tenant.plan}</Badge>
          </div>
          <Separator />
          <div className="space-y-1">
            <span className="text-sm font-medium text-muted-foreground">
              Site key
            </span>
            <p className="break-all font-mono text-sm">{tenant.siteKey}</p>
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium text-muted-foreground">
              Secret key
            </span>
            <p className="break-all font-mono text-sm">
              {tenant.secretKey.slice(0, 8)}
              {"•".repeat(24)}
            </p>
          </div>
          <Separator />
          <div className="text-sm text-muted-foreground">
            Usage overview coming in Phase 9.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
