import axios from 'axios';
import TurndownService from 'turndown';
import sanitizeHtml from 'sanitize-html';
import AssistantCall from '@/lib/assistantCall';
const assistantCall = new AssistantCall();



// Define interfaces for your parameters
interface WebScrapeParameters {
  url: string;
  ignore_links?: boolean;
  max_length?: number;
}

// Utility function to convert HTML to text


function htmlToMarkdown(html: string): string {
  // Sanitize the HTML to remove scripts and unwanted attributes
  const cleanHtml = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'title'],
      img: ['src', 'alt', 'title'],
    },
    // Disallow JavaScript in href/src attributes
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {},
    allowProtocolRelative: false,
    transformTags: {
      // Remove event handler attributes like onclick
      '*': (tagName: string, attribs: Record<string, string>) => {
        for (const attr in attribs) {
          if (attr.startsWith('on')) {
            delete attribs[attr];
          }
        }
        return { tagName, attribs };
      },
    },
  });

  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(cleanHtml);
  return markdown.trim();
}

// Webscrape function
export async function webscrape(params: WebScrapeParameters): Promise<string> {
  try {
    const url = new URL(params.url);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    };

    const response = await axios.get(url.href, { headers });

    if (response.status !== 200) {
      return `Failed to fetch the URL. Status code: ${response.status}`;
    }

    let output = await htmlToMarkdown(response.data);

    if (params.max_length && output.length > params.max_length) {
      output = output.slice(0, params.max_length);
    }

    return output;
  } catch (error) {
    console.error('Error during webscrape:', error);
    return `Error fetching the URL ${params.url}`;
  }
}

interface GoogleSearchParameters {
    query: string;
    results?: number;
    exactTerms?: string;
    excludeTerms?: string;
    cx?: string;
  }
  
  // Google Search function
  export async function google_search(params: GoogleSearchParameters): Promise<string> {
    try {
      let apiKey = process.env.GOOGLE_SEARCH_DEVELOPER_KEY;
      let cx = params.cx || process.env.GOOGLE_SEARCH_CX_ID;
  
      if (!apiKey || !cx) {
        throw new Error('Google Search API key or Custom Search Engine (CSE) ID is missing.');
      }
  
      // Prepare the search query parameters
      const queryParams = {
        key: apiKey,
        cx: cx,
        q: params.query,
        num: params.results || 5,
        exactTerms: params.exactTerms || '',
        excludeTerms: params.excludeTerms || '',
        hl: 'en', // Set the language to English
      };
  
      // Make the API call using axios
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: queryParams,
      });
  
      const data = response.data;
  
      // Check if there are results
      if (data && data.items) {
        return JSON.stringify(data.items, null, 2); // Return formatted results
      } else {
        return 'No results found';
      }
    } catch (error) {
      console.error('Error during Google Search:', error);
      return 'An error occurred while performing the Google search.';
    }
  }

// Define interfaces for your parameters
interface CompanyResearchParameters {
  company_name: string;
  website: string; // You can use a URL type if available
}

// Company Research function
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
      content: content, // Message content
      tools: { webscrape }, // If web scraping or other tools are needed, pass them
    });

    // Return the response from the assistant
    return result.response ? String(result.response) : 'No response received';
  } catch (error) {
    console.error('Error during company research:', error);
    return 'An error occurred while researching the company.';
  }
}

async function runAfter(threadId: string) {
  console.log('runAfter', threadId);
  const result = await assistantCall.getThread({threadId: threadId});
  console.log('result', result);
}
// Export all tools in a single object
export const tools = {
  webscrape, 
  google_search,
  company_research,
  runAfter
};