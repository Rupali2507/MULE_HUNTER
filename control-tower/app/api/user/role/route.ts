import { NextResponse } from "next/server";
import { auth } from "@/auth"; 
import { hashRole } from "@/lib/hash";

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role || "user"; 
  const hashedRole = await hashRole(userRole);

  return NextResponse.json({
    roleHash: hashedRole,
  });
}