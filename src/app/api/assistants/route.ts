import { NextRequest, NextResponse } from 'next/server';
import AssistantCall from '@/lib/assistantCall';

const assistantCall = new AssistantCall();

export async function GET(request: NextRequest) {
  try {
    const assistants = await assistantCall.getAssistants();
    // return map with only  id and name
    const assistantsMap = assistants.map((assistant) => ({
      id: assistant.id,
      name: assistant.name,
    }));
    return NextResponse.json(assistantsMap); // Return the list of assistants as JSON
  } catch (error: unknown) {
    console.error('Error fetching assistants:', error);
    // need to return em
    return NextResponse.json({ assistants: [] }, { status: 200 });
  }
}

