// lib/assistantCall.ts
"use server"
import OpenAI from 'openai';
import fs from 'fs';
import os from 'os';
import path from 'path';
class FileUpload {
  fileId?: string;
  filename: string;

  // Optional properties to override computed values
  private _vision?: boolean;
  private _retrieval?: boolean;

  constructor(
    filename: string,
    fileId?: string,
    visionOverride?: boolean,
    retrievalOverride?: boolean
  ) {
    this.filename = filename;
    this.fileId = fileId;
    this._vision = visionOverride;
    this._retrieval = retrievalOverride;
  }

  // Getter for the file extension
  get extension(): string {
    const parts = this.filename.split('.');
    return parts[parts.length - 1].toLowerCase();
  }

  // Getter to determine if the file is a vision (image) file
  get vision(): boolean {
    if (this._vision !== undefined) {
      return this._vision;
    }
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
    return imageExtensions.includes(this.extension);
  }

  // Getter to determine if the file is for retrieval
  get retrieval(): boolean {
    if (this._retrieval !== undefined) {
      return this._retrieval;
    }
    const retrievalExtensions = [
      'c', 'cs', 'cpp', 'doc', 'docx', 'html', 'java', 'json', 'md', 'pdf',
      'php', 'pptx', 'py', 'rb', 'tex', 'txt', 'css', 'js', 'sh', 'ts',
    ];
    return retrievalExtensions.includes(this.extension);
  }
}

class AssistantCall {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({apiKey: process.env.OPENAI_API_KEY, organization: process.env.OPENAI_ORGANIZATION, project: process.env.OPENAI_PROJECT});
  }

  // Retrieve assistant ID by name
  async getAssistantByName(assistantName: string): Promise<string | undefined> {
    const response = await this.client.beta.assistants.list(
        {
            order: 'asc',
            limit: 100,
        }
    );

    for (const assistant of response.data) {
      if (assistant.name === assistantName) {
        return assistant.id;
      }
    }
    return undefined;
  }

  // Get list of assistants
  async getAssistants(limit: number = 100) {
    const response = await this.client.beta.assistants.list({
      order: 'asc',
      limit: 100,
    });
    if (response.data) {
      return response.data;
    } else {
      return [];
    }
  }

  // Main function to run a thread
  async newThreadAndRun(params: {
    assistantId?: string;
    assistantName?: string;
    threadId?: string;
    content: string;
    tools?: any;
    metadata?: Record<string, any>;
    files?: string[] | FileUpload[];
    whenDone?: string | ((threadId: string) => void);
  }) {
    const {
      assistantId,
      assistantName,
      threadId,
      content,
      tools,
      metadata,
      files,
      whenDone,
    } = params;

    let resolvedAssistantId = assistantId;

    if (!resolvedAssistantId && assistantName) {
      resolvedAssistantId = await this.getAssistantByName(assistantName);
      if (!resolvedAssistantId) {
        return {
          response: `Assistant '${assistantName}' not found`,
          statusCode: 404,
          threadId: undefined, // Include threadId as undefined
        };
      }
    }

    const thread = await this.prepThread({
      threadId,
      assistantId: resolvedAssistantId,
      files,
      content,
      metadata,
      assistantName,
    });

    if (whenDone) {
      const run = await this.client.beta.threads.runs.create(thread.id, {
        assistant_id: resolvedAssistantId as string
      });

      // Start processing in the background
      this.processRun(run.id, thread, tools).then(() => {
        if (typeof whenDone === 'function') {
          whenDone(thread.id);
        } else {
          // Handle string-based function names if needed
        }
      });

      return {
        response: `Thread ${thread.id} queued for execution`,
        statusCode: 200,
        threadId: thread.id,
      };
    } else {
      const run = await this.client.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: resolvedAssistantId as string
      });

      return await this.processRun(run.id, thread, tools);
    }
  }
  async getFileUploadById(fileId: string): Promise<FileUpload> {
    try {
      // Retrieve the file object from OpenAI
      const file = await this.client.files.retrieve(fileId);

      // Determine the purpose of the file
      const purpose = file.purpose;
      const filename = file.filename;

      // Set vision and retrieval based on purpose
      let visionOverride: boolean | undefined = undefined;
      let retrievalOverride: boolean | undefined = undefined;

      if (purpose === 'vision') {
        visionOverride = true;
        retrievalOverride = false;
      } else if (purpose === 'assistants') {
        visionOverride = false;
        retrievalOverride = true;
      }

      // Create a new FileUpload instance with overrides
      const fileUpload = new FileUpload(filename, file.id, visionOverride, retrievalOverride);

      // Return the FileUpload instance
      return fileUpload;
    } catch (error: any) {
      throw new Error(`Error retrieving file with ID ${fileId}: ${error.message}`);
    }
  }
  // Prepare thread with messages and attachments
  async prepThread(params: {
    threadId?: string;
    assistantId?: string;
    files?: string[]|FileUpload[];
    content: string;
    metadata?: Record<string, any>;
    assistantName?: string;
  }) {
    const { threadId, assistantId, files, content, metadata, assistantName } = params;

    const visionFiles: FileUpload[] = [];
    const attachmentFiles: any[] = [];
    let fileUploads: FileUpload[] = [];

    if (files && typeof files[0] === 'string') {
      // files is string[]
      const fileIds = files as string[];
      // Convert file IDs to FileUpload instances
      fileUploads = await Promise.all(fileIds.map(id => this.getFileUploadById(id)));
    } else {
      // files is FileUpload[]
      fileUploads = files as FileUpload[];
    }
    if (fileUploads && fileUploads.length > 0) {
      for (const file of fileUploads) {
        if (file.vision) {
          visionFiles.push(file);
          continue;
        } else {
          attachmentFiles.push({
            file_id: file.fileId,
            tools: [
              {
                type: file.retrieval ? 'file_search' : 'code_interpreter',
              },
            ],
          });
        }
      }
    }

    const thread = await this.getThread({
      threadId,
      assistantName,
      metadata,
    });

    await this.client.beta.threads.messages.create(thread.id, {
      role: 'user',
      attachments: attachmentFiles,
      content,
    });

    await this.addVisionFiles(thread.id, visionFiles);
    return thread;
  }


async addVisionFiles(threadId: string, visionFiles: FileUpload[]) {
  for (const v of visionFiles) {
    if (!v.fileId) {
        throw new Error(`File ID is missing for vision file: ${v.filename}`);
      }
    await this.client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: [
        {
          type: 'image_file',
          image_file: {
            file_id: v.fileId,
            detail: 'high',
          },
        },
      ],
    });
  }
}


  // Retrieve or create a thread
  async getThread(params: {
    threadId?: string;
    assistantName?: string;
    metadata?: Record<string, any>;
  }) {
    const { threadId, assistantName, metadata } = params;
    let thread;

    if (threadId) {
      try {
        thread = await this.client.beta.threads.retrieve(threadId);
      } catch (e) {
        console.error('Error retrieving thread:', e);
        thread = null;
      }
    }

    if (!thread) {
      const meta = metadata || {};
      if (assistantName) {
        meta['assistant_name'] = assistantName;
      }

      thread = await this.client.beta.threads.create({
        metadata: meta,
      });
    }

    return thread;
  }

  // Process the run and handle required actions
  async processRun(runId: string, thread: any, tools: any) {
    let run = await this.client.beta.threads.runs.retrieve(thread.id, runId);

    while (
      !['completed', 'expired', 'failed', 'cancelled', 'incomplete'].includes(run.status)
    ) {
        if (
            run.status === 'requires_action' &&
            run.required_action &&
            run.required_action.submit_tool_outputs
          ) {
            const toolOutputs = await this.processToolCalls({
              toolCalls: run.required_action.submit_tool_outputs.tool_calls,
              tools,
            });
          
            run = await this.client.beta.threads.runs.submitToolOutputsAndPoll(
              thread.id,
              run.id,
              {
                tool_outputs: toolOutputs,
              }
            );
          } else {
            // Handle the case where required_action or submit_tool_outputs is null
            throw new Error('Required action is missing necessary data.');
          }
    }

    if (run.status === 'completed') {
      const responseMessage = await this.getResponse(run.thread_id);
      return {
        response: responseMessage,
        statusCode: 200,
        threadId: thread.id,
      };
    } else {
      return {
        response: run.last_error,
        statusCode: 500,
        threadId: thread.id,
      };
    }
  }

  // Process all tool calls
  async processToolCalls(params: { toolCalls: any[]; tools: any }) {
    const { toolCalls, tools } = params;
    const toolOutputs = [];

    for (const toolCall of toolCalls) {
      const output = await this.processToolCall(toolCall, tools);
      toolOutputs.push(output);
    }

    return toolOutputs;
  }

  // Process a single tool call
  async processToolCall(toolCall: any, tools: Record<string, Function>) {
    let result: any;
  
    try {
      const args = JSON.parse(toolCall.function.arguments); // Get the arguments for the function call
      const functionName = toolCall.function.name; // Get the function name the assistant wants to call
  
      // Dynamically find the function in the tools object
      const func = tools[functionName];
  
      if (!func) {
        result = `Function ${functionName} not supported`;
      } else {
        // Call the tool function with the provided arguments
        result = await func(args);
      }
    } catch (e: any) {
      result = e.toString();
    }
  
    return {
      tool_call_id: toolCall.id,
      output: result,
    };
  }

  async uploadFile(params: {
    fileContent: Buffer | string;
    filename: string;
  }): Promise<FileUpload> {
    const { fileContent, filename } = params;
  
    const contentBuffer = Buffer.isBuffer(fileContent)
      ? fileContent
      : Buffer.from(fileContent);
  
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const visionExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
    const retrievalExtensions = [
      'c', 'cs', 'cpp', 'doc', 'docx', 'html', 'java', 'json', 'md', 'pdf',
      'php', 'pptx', 'py', 'rb', 'tex', 'txt', 'css', 'js', 'sh', 'ts',
    ];
  
    const isVision = visionExtensions.includes(extension);
    const isRetrieval = retrievalExtensions.includes(extension);
  
    // Write the content to a temporary file
    const tempFilePath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(tempFilePath, contentBuffer);
  
    // Create a read stream from the temporary file
    const fileStream = fs.createReadStream(tempFilePath);
  
    // Prepare the FileCreateParams object
    const fileCreateParams = {
      file: fileStream,
      purpose: isVision ? 'vision' : 'assistants' as 'vision' | 'assistants' | 'fine-tune',
    };
  
    // Upload the file
    const uploadedFile = await this.client.files.create(fileCreateParams);
  
    // Clean up the temporary file
    await fs.promises.unlink(tempFilePath);
  
    return {
      fileId: uploadedFile.id,
      filename,
      extension,
      vision: isVision,
      retrieval: isRetrieval,
    };
  }

// Function to check if a content block is a TextContentBlock

  
  async getFullResponse(threadId: string) {
    const messages = await this.client.beta.threads.messages.list(threadId);
    let fullResponse = '';
  
    for (const message of messages.data) {
      for (const contentBlock of message.content) {
        if (contentBlock.type === 'text') {
          fullResponse += contentBlock.text;
        }
        // Handle other content types if needed
      }
    }
    return fullResponse;
  }
  // Get full response from the assistant
  removeAnnotations(messageContent: { text: string; annotations?: { text: string }[] }): string {
    let contentValue = messageContent.text;
  
    // Check if annotations exist before trying to remove them
    if (messageContent.annotations && messageContent.annotations.length > 0) {
      for (const annotation of messageContent.annotations) {
        contentValue = contentValue.replace(annotation.text, '');
      }
    }
  
    return contentValue;
  }
  async getResponse(threadId: string, removeAnnotations: boolean = true): Promise<string> {
    const messages = await this.client.beta.threads.messages.list(threadId);
  
    if (messages.data.length === 0 || !messages.data[0].content[0]) {
      throw new Error('No messages or message content found');
    }
  
    const firstContent = messages.data[0].content[0];
  
    // Check if the content block is of type 'text'
    if (firstContent.type === 'text') {
      let messageContent = firstContent.text.value;
  
      if (removeAnnotations) {
        messageContent = this.removeAnnotations({ text: messageContent });
      }
  
      return messageContent;
    } else {
      throw new Error('First content block is not of type text');
    }
  }
  
  async transcribeAudio(fileName: string): Promise<{ text: string }> {
    try {
      const fileStream = fs.createReadStream(fileName);
      const response = await this.client.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1' // Specify the Whisper model
      });
   
      return { text: response.text };
    } catch (error) {
      console.error('Error during transcription:', error);
      throw new Error('Error transcribing audio');
    }
   };

}



export default AssistantCall;// Upload a file to OpenA