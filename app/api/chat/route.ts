import { NextResponse } from "next/server";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

export const runtime = "nodejs";

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = (body?.messages ?? []) as ChatMsg[];

    const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
    const agentName = process.env.FOUNDRY_AGENT_NAME;

    if (!projectEndpoint || !agentName) {
      return NextResponse.json(
        { error: "Missing environment variables" },
        { status: 500 }
      );
    }

    const project = new AIProjectClient(
      projectEndpoint,
      new DefaultAzureCredential()
    );

    const openAIClient = project.getOpenAIClient();

    const input = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const resp = await openAIClient.responses.create(
      {
        input,
        store: false,
      },
      {
        body: {
          agent: { name: agentName, type: "agent_reference" },
        },
      }
    );

    return NextResponse.json({
      content: resp.output_text ?? "No response",
    });

  } catch (err: any) {
    console.error("API ERROR:", err);

    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
``