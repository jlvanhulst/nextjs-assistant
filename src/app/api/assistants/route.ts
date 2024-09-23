import { NextRequest, NextResponse } from 'next/server';
import AssistantCall ,{ isFunctionName } from '@/lib/assistantCall';
import { AssistantTool} from 'openai/resources/beta/assistants';
const assistantCall = new AssistantCall();

export async function GET(request: NextRequest) {
  try {
    const assistants = await assistantCall.getAssistants();
    const sortedAssistants = assistants.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    // Use Promise.all to resolve all Promises in assistantsMap
    const assistantsMap = await Promise.all(
      sortedAssistants.map(async (assistant) => ({
        id: assistant.id,
        name: assistant.name,
        instructions: assistant.instructions,
        // Use Promise.all to resolve the tools array
        tools: assistant.tools
          ? await Promise.all(assistant.tools.map(getFunctionName))
          : [],
        model: assistant.model,
      }))
    );

    return NextResponse.json(assistantsMap);
  } catch (error: unknown) {
    console.error('Error fetching assistants:', error);
    return NextResponse.json({ assistants: [] }, { status: 200 });
  }
}
// getFunctionName is a helper function that returns the name of the function and if it is enabled
async function getFunctionName(func: AssistantTool): Promise<{name: string, enabled: boolean}> {
  if (func.type === 'function') {
    let isEnabled = false;
    try {
     isEnabled = await isFunctionName(func.function.name);
     //isEnabled = true;
    } catch (error) {
      
    }
    return {'name': func.function.name, 'enabled': isEnabled};
  } else if (func.type === 'file_search') {
    return {'name': 'file_search', 'enabled': true};
  } else if (func.type === 'code_interpreter') {
    return {'name': 'code_interpreter', 'enabled': true};
  }
  return {'name': '', 'enabled': false};
}
