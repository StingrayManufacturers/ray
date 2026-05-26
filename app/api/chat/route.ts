import { NextResponse } from "next/server";
import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const body = await req.json();
const messages = body?.messages ?? [];

// Extract the most recent question
const lastUserMessage = [...messages].reverse().find((m: any) => m?.role === "user")?.content;

if (!lastUserMessage) {
return NextResponse.json({ error: "No user message provided." }, { status: 400 });
}

const projectEndpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
const agentId = process.env.AGENT_ID;

if (!projectEndpoint || !agentId) {
return NextResponse.json(
{ error: "Architect Error: Missing Endpoint or Agent ID" },
{ status: 500 }
);
}

const project = new AIProjectClient(projectEndpoint, new DefaultAzureCredential());

    // 1. Create Thread (Using Flat SDK Syntax)
    const thread = await project.agents.createThread();

    // 2. Create Message (Using Flat SDK Syntax)
    await project.agents.createMessage(thread.id, {
role: "user",
content: lastUserMessage,
});

    // 3. Create Run (Fix: Pass agentId directly as a string, not an object)
    let run = await project.agents.createRun(thread.id, agentId);

    // 4. Poll Run Status (Using Flat SDK Syntax)
while (run.status === "queued" || run.status === "in_progress") {
await new Promise((resolve) => setTimeout(resolve, 1000));
      run = await project.agents.getRun(thread.id, run.id);
}

if (run.status !== "completed") {
throw new Error(`Agent run failed. Status: ${run.status}`);
}

    // 5. List Messages (Using Flat SDK Syntax)
    const threadMessages = await project.agents.listMessages(thread.id);

const latestResponse = threadMessages.data[0];  
let responseText = "No response generated.";
    
    // Fix: Storing the array item in a variable allows strict TypeScript type narrowing
    if (latestResponse && latestResponse.role === "assistant" && latestResponse.content.length > 0) {
      const firstContent = latestResponse.content[0];
      if (firstContent.type === "text") {
        responseText = firstContent.text.value;
      }
}

return NextResponse.json({ content: responseText });

} catch (err: any) {
console.error("Agent API Error:", err);
return NextResponse.json(
{ error: err?.message || "Internal Server Error" },
{ status: 500 }
);
}