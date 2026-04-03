import { NextRequest, NextResponse } from "next/server";
import { savePrediction, getAllPredictions, updatePrediction } from "@/lib/kv";
import type { Prediction } from "@/lib/types";

export const maxDuration = 10;

export async function GET() {
  try {
    const predictions = await getAllPredictions();
    return NextResponse.json(predictions);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: Prediction = await req.json();
    body.id = body.id || crypto.randomUUID();
    body.date = body.date || new Date().toISOString().split("T")[0];
    body.status = "ongoing";
    body.verification_date = null;
    body.actual_outcome = null;
    body.score = null;
    body.lessons = null;
    await savePrediction(body);
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await updatePrediction(id, updates);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
