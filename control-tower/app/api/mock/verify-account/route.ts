import { NextRequest, NextResponse } from "next/server";
import { MOCK_RECEIVERS } from "@/lib/personas";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountNo = searchParams.get("accountNo") ?? "";

  // Simulate a small network delay (80-150ms)
  await new Promise((r) => setTimeout(r, 80 + Math.random() * 70));

  // Look up a pre-seeded receiver
  const matched = MOCK_RECEIVERS.find((r) => r.accountNumber === accountNo);

  if (matched) {
    return NextResponse.json({
      verified: true,
      name: matched.name,
      bankName: matched.bankName,
      ifscCode: matched.ifscCode,
      branch: matched.branch,
    });
  }

  // Generate a plausible mock for any 10-digit number
  if (/^\d{10}$/.test(accountNo)) {
    const mockNames = [
      "Kavya Reddy", "Aryan Gupta", "Divya Nair", "Rohan Joshi",
      "Sneha Pillai", "Nikhil Agarwal", "Pooja Iyer", "Amit Bose",
    ];
    const mockBanks = [
      { bank: "Union Bank of India", ifsc: "UBIN0" + accountNo.slice(0, 5) },
      { bank: "Canara Bank", ifsc: "CNRB0" + accountNo.slice(0, 5) },
      { bank: "Indian Bank", ifsc: "IDIB0" + accountNo.slice(0, 5) },
    ];
    const rng = parseInt(accountNo.slice(-2), 10);
    return NextResponse.json({
      verified: true,
      name: mockNames[rng % mockNames.length],
      bankName: mockBanks[rng % mockBanks.length].bank,
      ifscCode: mockBanks[rng % mockBanks.length].ifsc,
      branch: "Main Branch",
    });
  }

  return NextResponse.json({ verified: false, error: "Account not found" }, { status: 404 });
}
