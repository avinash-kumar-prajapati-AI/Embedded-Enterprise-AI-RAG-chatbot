import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl ?? "/dashboard/settings";

  if (session) {
    redirect(redirectTo);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-2 border-border-strong shadow-hard">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Access your workspace dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV !== "production" ? (
            <>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("credentials", formData);
                }}
                className="space-y-2"
              >
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <Label htmlFor="username">Username (dev only, no password)</Label>
                <Input id="username" name="username" placeholder="e.g. alice" required />
                <Button type="submit" className="w-full" variant="outline">
                  Continue with username
                </Button>
              </form>
              <Separator />
            </>
          ) : null}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
