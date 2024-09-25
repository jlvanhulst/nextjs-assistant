// src/app/api/twilio/route.ts
/* 
Simple demo of how to use the assistantCall module to handle incoming calls and transcribe voicemails and
answer incoming SMS including media.
Setup your twilio account so that the webhook url for incoming calls and SMS is POST to /api/twilio/in and POST /api/twilio/sms
for messages.

(Tip: ceate a TwiML 'app' (which is really just a set of URLS) for both Local and Vercel/production URLS that way you can
easily switch between local testing and Vercel/production.

*/
// Import Prisma Client
import fetch from 'node-fetch';
import { waitUntil } from '@vercel/functions';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import os from 'os';
// Initialize Prisma Client
const prisma = new PrismaClient();
import type { User } from '@prisma/client'

// Constants
const THREAD_EXPIRATION_DAYS = 60;
import { NextRequest, NextResponse } from 'next/server';
import AssistantCall  from '@/lib/assistantCall';
import twilio from 'twilio';
const VoiceResponse = require('twilio').twiml.VoiceResponse;

import fs from 'fs';
import { CallInstance } from 'twilio/lib/rest/insights/v1/call';
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const assistantCall = new AssistantCall();



export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  const subPath = '/' + (params.path || []).join('/');

  switch (subPath) {
    case '/in':
      const formData = await request.formData();
      return handleIncomingCall(formData);
    case '/sms':
      const smsFormData = await request.formData();
      return handleSms(smsFormData);
    case '/transcribe':
      const transcribeFormData = await request.formData();
      return handleTranscription(transcribeFormData);
    case '/adduser':
      return handleAddUser(request);
    default:
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  }
}


// New handler function to add a user
async function handleAddUser(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse JSON body
    const data = await request.json();

    const { name, phone, email } = data;

    // Validate input
    if (!name || !phone || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }
    // Create new user
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email,
      },
    });

    return NextResponse.json({ status: 'success', user }, { status: 201 });
  } catch (error) {
    console.error('Error adding user:', error);
    return NextResponse.json({ error: 'Error adding user' }, { status: 500 });
  }
}
async function lookupUserByPhone(phoneNumber: string): Promise<User | null> {
  // Implement lookupUserByPhone to retrieve user details from your database
  // return null if the user is not allowed to use the service
  const user = await prisma.user.findUnique({
    where: { phone: phoneNumber },
  });
  return user;
}

/* 
handles incoming calls. Two steps: 
First determine if the user is allowed to use the service. LookupUserByPhone() will return null if not.
Add a user to the user table to allow calls from that number. Number must match callerid (ie +19543334444) 

Next we present a leave a message option and collect the voicemail.
We will receive a new incoming api call when the voicemail is complete.

*/
async function handleIncomingCall(formData: FormData): Promise<NextResponse> {
  const direction = formData.get('Direction') as string | null;
  const fromNumber = formData.get('From') as string | null;
  const digits = formData.get('Digits') as string | null;

  if (!direction) {
    return NextResponse.json({ error: 'No direction in payload' }, { status: 400 });
  }

  if (direction === 'inbound') {
    if (!fromNumber) {
      return NextResponse.json({ error: 'No From number in payload' }, { status: 400 });
    }

    const user = await lookupUserByPhone( fromNumber)

    const twiml = new VoiceResponse();

    if (!user) {
      twiml.say('No access to this number. Goodbye.');
      twiml.hangup();
      return new NextResponse(twiml.toString(), { status: 200, headers: { 'Content-Type': 'text/xml' } });
    } else {
      const { name } = user;
      twiml.say(`Hi ${name}, this is a bot. How can I help you today?`);
      twiml.record({
        timeout: 10,
        transcribe: false,
        recordingStatusCallback: '/api/twilio/transcribe',
        recordingStatusCallbackEvent: 'completed',
      });
      return new NextResponse(twiml.toString(), { status: 200, headers: { 'Content-Type': 'text/xml' } });
    }
  } else if (digits === 'hangup') {
    return NextResponse.json({ status: 'success', response: 'Call ended' }, { status: 200 });
  } else {
    return NextResponse.json({ error: 'Unknown request' }, { status: 400 });
  }
}

/* 
handles incoming SMS messages including media attachments. Will use the incoming number to find an existing thread
or create one. Please note: text message and voicemail from the same number are treated as one thread. 

Note: this function has a hardcoded Assistant Name 'Text Responder' that will be used to answer the message

*/
async function handleSms(formData: FormData): Promise<NextResponse> {
  const fromNumber = formData.get('From') as string | null;
  const message = formData.get('Body') as string | null;
  const toNumber = formData.get('To') as string | null;
  const numMedia = parseInt(formData.get('NumMedia') as string) || 0;

  if (!fromNumber || !toNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const assistantCall = new AssistantCall();

  // Retrieve or create threadId based on fromNumber. 
  let threadId = await getThreadId(fromNumber);
  if (!threadId) {
    const thread = await assistantCall.getThread({ metadata: { from: fromNumber, to: toNumber } });
    await setThreadId(fromNumber, thread.id);
    threadId = thread.id;
  }

  // Collect media files if any
  const mediaFiles: { filename: string; fileContent: Buffer }[] = [];

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = formData.get(`MediaUrl${i}`) as string;
    const mediaContentType = formData.get(`MediaContentType${i}`) as string;

    if (mediaUrl && mediaContentType) {
      try {
        const extension = mediaContentType.split('/')[1] || 'dat';
        const filename = `media_${Date.now()}_${i}.${extension}`;
        const response = await fetch(mediaUrl, { headers: {
            Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
          }});
        const buffer = await response.buffer();
        console.log('downloaded media', filename, mediaUrl, mediaContentType, buffer.length);
        mediaFiles.push({ filename, fileContent: buffer });
      } catch (error) {
        console.error('Error downloading media:', error);
        // Handle the error as needed
      }
    }
  }

  // Upload media files to OpenAI (if applicable)
  const fileUploads = [];
  for (const media of mediaFiles) {
    try {
      const fileUpload = await assistantCall.uploadFile({
        fileContent: media.fileContent,
        filename: media.filename,
      });
      fileUploads.push(fileUpload);
    } catch (error) {
      console.error('Error uploading file to OpenAI:', error);
      // Handle the error as needed
    }
  }

  // Prepare the content for the assistant call
  const assistantRequest = {
    assistantName: 'Text Responder',
    content: message || '', // Use an empty string if message is null
    whenDone: runAfter,
    threadId: threadId,
    files: fileUploads, // Include the uploaded files
  };

  // Start the assistant task, send the sms when done - but return immediately 
  const result = await assistantCall.newThreadAndRun(assistantRequest);
  return NextResponse.json({ status: 'success', response: 'SMS received' }, { status: 200 });
}
/*
sends an SMS message
to do: add media support
*/
async function sendSms(toNumber: string, content: string, fromNumber: string) {
  
    console.log('sending sms to', toNumber, 'content', content, 'from', fromNumber);
  const message = await client.messages.create({
  body: content,
  from: process.env.TWILIO_PHONE_NUMBER as string,
  to: toNumber,
});  
}

/*
 retrieve and transcibe a voicemail and respond (by message) to the caller

*/ 
async function handleTranscription(formData: FormData): Promise<NextResponse> {
  const recordingUrl = formData.get('RecordingUrl') as string | null;
  const callSid = formData.get('CallSid') as string | null;

  if (!recordingUrl || !callSid ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const fromNumber = await getCallerPhoneNumber(callSid);
  const user = await lookupUserByPhone(fromNumber);
  // get the details from the re
  // we need to decide if we want to allow this call - the lookupuserbyphone should be able to return a flag if the user is allowed to use the service
  if (!user) {
    return NextResponse.json({ error: 'Caller ID not allowed to use the service' }, { status: 404 });
  }

  try {
    const recordingResponse = await fetch(recordingUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'),
      },
    });

    if (!recordingResponse.ok) {
      throw new Error('Error fetching recording');
    }
    const audioBuffer = await recordingResponse.buffer();
    // save the audio to a file with unique temporary name that includes the fromNumber
    const fileName = `tempfile_${fromNumber}_${Date.now()}.wav`;
    const tempFile = path.join(os.tmpdir(), fileName);
    await fs.promises.writeFile(tempFile, audioBuffer);
  
    fs.writeFileSync(tempFile, Buffer.from(audioBuffer));

    // Transcribe the audio using OpenAI's Whisper model
    const transcription = await assistantCall.transcribeAudio(tempFile);
    //delete the temp file
    fs.unlinkSync(tempFile);
    // Send the transcription to the user
    if (transcription && transcription.length > 0) {
      await respondToVoicemail(transcription, user);
    } else {
      console.log('no transcription text');
    }

    return NextResponse.json({ status: 'success', response: 'Transcription received' }, { status: 200 });
  } catch (error) {
    console.error('Error during transcription:', error);
    return NextResponse.json({ error: 'Error processing transcription' }, { status: 500 });
  }
}

/*
  get the caller phone number from the call sid
*/
async function getCallerPhoneNumber(callSid: string): Promise<string> {

  try {
    const call = await client.calls(callSid).fetch();
    return call.from;
  } catch (error) {
    console.error('Error fetching call details:', error);
    throw new Error('Error fetching call details');
  }
}

  /* for now we respond by text - we could also consider different assistant and then a call 
   but what we are really waiting for is the multi modal assistnat that will pick up the call and stream
   with transcription! 

   Note uses a hardcoded assistant named 'Text Responder'
   The metadata are used in the 'whenDone' callback to send the message back to the original sender
  */
async function respondToVoicemail(transcription: string, user: User ) {

  const assistantCall = new AssistantCall();

  const thread = await assistantCall.getThread({threadId: user.threadid, metadata: { from: user.phone, to: process.env.TWILIO_PHONE_NUMBER as string }}); // Implement getThread to retrieve/create a new thread
  await assistantCall.newThreadAndRun({
    assistantName: 'Text Responder',
    content: transcription,
    whenDone: runAfter,
    threadId: thread.id,
  });
}


  

async function runAfter(threadId?: string) {
  if (!threadId) return;
  console.log('running after for threadId', threadId);
  waitUntil( (async () => {
    const assistantCall = new AssistantCall();
    const thread = await assistantCall.getThread({threadId: threadId});
    const metadata = thread.metadata as { from: string, to: string };

  const message = await assistantCall.getResponse(threadId);

  await sendSms(metadata.from, message, metadata.to);

})())
}


async function getThreadId(fromNumber: string): Promise<string | null> {
  const phoneNumber = fromNumber.trim();
  const now = new Date();
  const expirationDate = new Date(
    now.getTime() - THREAD_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
  );

  // Find the user by phone number
  const user = await prisma.user.findUnique({
    where: { phone: phoneNumber },
  });

  if (user && user.threadid && user.thread_created_at > expirationDate) {
    // Thread is still valid
    return user.threadid;
  } else {
    // Thread expired or doesn't exist
    return null; // Indicate that there's no valid thread
  }
}

// Function to set threadId for a phone number
async function setThreadId(fromNumber: string, threadId: string) {
  const phoneNumber = fromNumber.trim();
  const now = new Date();

  // Update the user's thread ID and thread_created_at
  await prisma.user.upsert({
    where: { phone: phoneNumber },
    update: {
      threadid: threadId,
      thread_created_at: now,
    },
    create: {
      phone: phoneNumber,
      threadid: threadId,
      thread_created_at: now,
    },
  });
}