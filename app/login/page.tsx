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
          <CardTitle className="text-2xl">Admin sign in</CardTitle>
          <CardDescription>Enter your admin ID to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", formData);
            }}
            className="space-y-3"
          >
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="space-y-1.5">
              <Label htmlFor="adminId">Admin ID</Label>
              <Input id="adminId" name="adminId" type="password" required autoComplete="off" />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
