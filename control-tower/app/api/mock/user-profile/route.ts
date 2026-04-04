import { NextRequest, NextResponse } from "next/server";
import { PERSONAS } from "@/lib/personas";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personaId = (searchParams.get("personaId") ?? "clean") as keyof typeof PERSONAS;

  const persona = PERSONAS[personaId] ?? PERSONAS.clean;

  return NextResponse.json({
    id: persona.id,
    name: persona.name,
    accountNumber: persona.accountNumber,
    maskedAccount: persona.maskedAccount,
    bankName: persona.bankName,
    ifscCode: persona.ifscCode,
    balance: persona.balance,
    sourceAccount: persona.sourceAccount,
    email: persona.email,
    phone: persona.phone,
    avatarInitials: persona.avatarInitials,
  });
}
