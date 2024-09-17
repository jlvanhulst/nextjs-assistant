// src/app/api/upload/route.ts

import { NextResponse } from 'next/server';
import AssistantCall from '@/lib/assistantCall';
import { tools } from '@/app/tools'; // Import the entire tools module

export const runtime = 'nodejs'; // Optional: Specify the runtime if needed

export async function POST(request: Request) {
  try {
    // Parse the form data
    const formData = await request.formData();

    const assistantId = formData.get('assistantId') as string;
    const threadIdRaw = formData.get('threadId'); // Get the raw value
    const file = formData.get('file') as File | null;
    let threadId: string | undefined;

    if (threadIdRaw && threadIdRaw !== 'null') {
      threadId = threadIdRaw.toString();
    }

    if (!assistantId) {
      return NextResponse.json({ error: 'Assistant ID is required' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Read the file content
    const arrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);

    // Initialize AssistantCall
    const assistantCall = new AssistantCall();

    // Upload the file to OpenAI
    const fileUpload = await assistantCall.uploadFile({
      fileContent,
      filename: file.name,
    });
    
    // Prepare parameters for newThreadAndRun
    const params = {
      assistantId,
      threadId: threadId || undefined,
      content: 'file uploaded '+file.name, 
      files: [fileUpload], // Attach the uploaded file
      tools: tools, // Pass the tools object to the assistant
    };

    // Start a new thread or continue the existing one
    const thread = await assistantCall.prepThread(params);

    return NextResponse.json(
      {
        response: 'file uploaded '+file.name,
        threadId: thread.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error handling file upload:', error);
    return NextResponse.json({ error: 'Error handling file upload' }, { status: 500 });
  }
}
