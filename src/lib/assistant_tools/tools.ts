/* 
Collect all your function call and 'when done' functions here.
each function should be export async 
*/
import * as demo_tools from "./demo_tools";
import * as scrape_tools from "./scrape_tools";

export const tools = {
    ...demo_tools,
    ...scrape_tools
}