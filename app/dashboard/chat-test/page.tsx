import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";

import { ChatTest } from "./chat";

export default async function ChatTestPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const [tenant] = await db
    .select({ siteKey: tenants.siteKey })
    .from(tenants)
    .where(eq(tenants.id, session.user.tenantId));

  if (!tenant) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Chat test</h1>
        <p className="text-sm text-muted-foreground">
          Try the retrieval pipeline against your own uploaded documents and
          active model provider — the same endpoint the embeddable widget
          will call.
        </p>
      </div>
      <ChatTest siteKey={tenant.siteKey} />
    </div>
  );
}
