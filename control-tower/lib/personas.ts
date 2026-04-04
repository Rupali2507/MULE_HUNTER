// Pre-seeded demo personas for MuleHunter Payment Gateway
// Each maps to a graph node ID that produces a reliable fraud decision outcome

export interface Persona {
  id: string;
  name: string;
  accountNumber: string;
  maskedAccount: string;
  bankName: string;
  ifscCode: string;
  balance: number;
  sourceAccount: string; // graph node ID
  email: string;
  phone: string;
  avatarInitials: string;
  type: "clean" | "smurfing" | "ring_hub";
  expectedOutcome: "APPROVE" | "REVIEW" | "BLOCK";
  expectedRisk: string;
  description: string;
}

export const PERSONAS: Record<string, Persona> = {
  clean: {
    id: "clean",
    name: "Rahul Verma",
    accountNumber: "7842145533",
    maskedAccount: "••••••7842",
    bankName: "State Bank of India",
    ifscCode: "SBIN0001234",
    balance: 85000,
    sourceAccount: "1553",
    email: "rahul.verma@gmail.com",
    phone: "+91 98765 43210",
    avatarInitials: "RV",
    type: "clean",
    expectedOutcome: "APPROVE",
    expectedRisk: "< 0.35",
    description:
      "Normal transaction history, consistent device, single location, low velocity",
  },
  smurfing: {
    id: "smurfing",
    name: "Priya Mehta",
    accountNumber: "3921284712",
    maskedAccount: "••••••8471",
    bankName: "HDFC Bank",
    ifscCode: "HDFC0002847",
    balance: 42000,
    sourceAccount: "2847",
    email: "priya.mehta@yahoo.com",
    phone: "+91 87654 32109",
    avatarInitials: "PM",
    type: "smurfing",
    expectedOutcome: "REVIEW",
    expectedRisk: "0.50 – 0.70",
    description:
      "High tx count, many small uniform amounts, high amount_entropy, 7-day burst",
  },
  ring_hub: {
    id: "ring_hub",
    name: "Vikram Singh",
    accountNumber: "5647881201",
    maskedAccount: "••••••8812",
    bankName: "Axis Bank",
    ifscCode: "UTIB0008812",
    balance: 128000,
    sourceAccount: "8812",
    email: "vikram.singh@rediffmail.com",
    phone: "+91 76543 21098",
    avatarInitials: "VS",
    type: "ring_hub",
    expectedOutcome: "BLOCK",
    expectedRisk: "> 0.80",
    description:
      "Star-ring hub, high PageRank, high in_out_ratio, 12+ suspicious neighbors",
  },
};

export const MOCK_RECEIVERS = [
  {
    accountNumber: "4521893670",
    ifscCode: "ICIC0004521",
    name: "Ananya Krishnan",
    bankName: "ICICI Bank",
    branch: "Koramangala, Bengaluru",
  },
  {
    accountNumber: "8834521906",
    ifscCode: "PUNB0008834",
    name: "Suresh Patel",
    bankName: "Punjab National Bank",
    branch: "Satellite, Ahmedabad",
  },
  {
    accountNumber: "1122334455",
    ifscCode: "KKBK0001122",
    name: "Meera Nair",
    bankName: "Kotak Mahindra Bank",
    branch: "Vashi, Mumbai",
  },
  {
    accountNumber: "9876543210",
    ifscCode: "BARB0009876",
    name: "Arjun Sharma",
    bankName: "Bank of Baroda",
    branch: "Connaught Place, Delhi",
  },
];

// JA3 fingerprint headers by persona type
export const JA3_FINGERPRINTS: Record<string, string> = {
  clean:
    "771,4866-4867-4865-49196-49200-159-52393-52392-52394-49195-49199-158-49188-49192-107-49187-49191-103-49162-49172-57-49161-49171-51-157-156-61-60-53-47-255,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-21,29-23-24-25,0",
  smurfing:
    "771,49196-49200-159-52393-52392-52394-49195-49199-158-49188-49192-107-49187-49191-103-49162-49172-57-49161-49171-51-157-156-61-60-53-47-255,0-23-65281-10-11-35-16-5-13-18-51-45-43,29-23-24,0",
  ring_hub: "771,49196-49200-49195-49199-49171-49172-47-53-10,0-23-65281,29-23,0",
};
