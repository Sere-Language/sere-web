import { NextRequest, NextResponse } from "next/server";
import { syncDocsFromGitHub } from "@/app/lib/docs";

export async function POST(request: NextRequest) {
  try {
    const result = await syncDocsFromGitHub();
    
    if (result.errors.length > 0) {
      console.error("Docs sync errors:", result.errors);
    }
    
    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Docs sync failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
