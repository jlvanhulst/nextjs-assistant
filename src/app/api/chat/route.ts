// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import AssistantCall, {isFunctionName} from '@/lib/assistantCall';
const assistantCall = new AssistantCall();
// This is the chat endpoint, it creates a new thread when needed and runs the assistant
// if threadId is not provided a new thread is created, if it is provided a message is added to the thread
export async function POST(request: NextRequest) {
  try {
    const { content, threadId, assistantId } = await request.json();

    if (!content || !assistantId) {
      return NextResponse.json({ error: 'Content and Assistant ID are required' }, { status: 400 });
    }

    // Use the provided assistant ID in the assistantCall
    const result = await assistantCall.newThreadAndRun({
      assistantId, // Use the assistantId provided by the request
      threadId,
      content    });

    return NextResponse.json({
      response: result.response,
      threadId: result.threadId,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request.' },
      { status: 500 }
    );
  }
}