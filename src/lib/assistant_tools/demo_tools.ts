import AssistantCall  from '@/lib/assistantCall';
/* 

this module contains all the tools that the Assistant can use. To be available they need to be aysnc, exported and the name must match exactly 
the name in the Assistant function definition. 
If you select an Assistant in the chat window, it will check if the functions defined in the Assistant are available in this module. 

*/

// Define interfaces for your parameters
interface CompanyResearchParameters {
  company_name: string;
  website: string; // You can use a URL type if available
}

// Company Research function example
/* 
This is an example of a function that calls another Assistant.
it would be very eaysy to make it totally generic and call any assistant (make botht the Asistant name and the prompt a parameter)

*/

export async function company_research(params: CompanyResearchParameters): Promise<string> {
  try {
    const { company_name, website } = params;
    // Instantiate AssistantCall to interact with the assistant
    const assistantCall = new AssistantCall();
    // The content we're sending to the assistant
    const content = `Research this company: ${company_name} ${website}`;

    // Pass the parameters and tools to the assistant
    const result = await assistantCall.newThreadAndRun({
      assistantName: 'Company Research Assistant', // Assistant name
      content: content // Message content
    });
    // Return the response from the assistant
    return result.response ? String(result.response) : 'No response received';
  } catch (error) {
    console.error('Error during company research:', error);
    return 'An error occurred while researching the company.';
  }
}

// Example of a tool that runs after the assistant has run  
export async function runAfter(threadId: string): Promise<string>  {
  const assistantCall = new AssistantCall();

  console.log('runAfter', threadId);
  const result = await assistantCall.getThread({threadId: threadId});
  console.log('result', result);
  return "done"
}
// Export all tools in a single object

