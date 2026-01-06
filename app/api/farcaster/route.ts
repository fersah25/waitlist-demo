import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Base Mini App",
    description: "My first Base Mini App",
    icon: "https://repand-claretta-semiexperimentally.ngrok-free.dev/favicon.ico",
    home_url: "https://repand-claretta-semiexperimentally.ngrok-free.dev",
    version: "1.0.0",
  });
}


