import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  try {
    await dbConnect();
    const db = mongoose.connection.db;
    if (!db) throw new Error("DB not connected");

    //Fetch raw data
    const rawNodes = await db.collection("nodes").find({}).toArray();
    const rawLinks = await db.collection("transactions").find({}).toArray();

    // Format Nodes
    const nodes = rawNodes.map((n) => ({
      ...n,
      id: Number(n.node_id),
      color: n.is_anomalous === 1 ? "#ff4d4d" : "#00ff88", 
    }));

    const links = rawLinks.map((l) => ({
      source: Number(l.source), 
      target: Number(l.target),
      amount: Number(l.amount)
    }));

    // Final Validation: Filter out links that point to non-existent nodes
    // This prevents the "node not found" crash if your CSV is missing a node
    const nodeIds = new Set(nodes.map(n => n.id));
    const validLinks = links.filter(l => 
      nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    console.log(`Sending ${nodes.length} nodes and ${validLinks.length} valid links`);

    return NextResponse.json({ nodes, links: validLinks });
  } catch (error) {
    console.error("Graph API Error:", error);
    return NextResponse.json({ error: "Data fetch failed" }, { status: 500 });
  }
}