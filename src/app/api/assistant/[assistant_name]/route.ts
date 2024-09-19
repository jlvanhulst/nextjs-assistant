// /app/api/assistant/[assistant_name]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import AssistantCall, { AssistantRequest } from '@/lib/assistantCall';
import { tools } from '@/app/tools'; // Import the entire tools module

const assistantCall = new AssistantCall();

export async function POST(
  request: NextRequest,
  { params }: { params: { assistant_name: string } }
) {
  try {
    // Parse the request body as AssistantRequest
    const data = (await request.json()) as AssistantRequest;
    const assistantName = params.assistant_name;

    // Optional: Define your tools module if needed
    // import tools from '@/lib/tools'; // Adjust the path as needed
    // Call the assistant
    const result = await assistantCall.newThreadAndRun({
      assistantName,
      content: data.content,
      tools: tools,
      files: data.fileIds,
      whenDone: data.whenDone,
      metadata: data.metadata,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error running assistant:', error);
    return NextResponse.json({ error: 'Error running assistant' }, { status: 500 });
  }
}