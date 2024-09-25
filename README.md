This app has an Assistant wrapper module that makes it super easy to run OpenAI Assistants in your Nextjs app (on Vercel)

The Vercel specific part is the use of waitUntil function that is used to support starting an Assistant run while
and a 'whenDone' function that is called after the Assistant run is complete. 

(Note: the focus here is on 'agents' not CHAT. If you're looking for a streaming chat solution, this is not it) the chat implementation is to easily check your function calls and nested assistant calls.

/chat demo is for the included 'assistantCall' module, which is meant to be an OpenAI Assistant 'runner'
It will show all availabe assistants for the API key and let you select one to run against the chat interface.
In the sidebar you will the availbe tools and if they are available in the code.

Also able to handle Twilio SMS and phone calls straight to Assistant.

Easily provide it with a prompt + files and 'let it run' included tool calling that can also include wrapped Assisntat calls

The original in Python https://github.com/jlvanhulst/fastapi-assistant is currently slightly ahead in terms of features - but O1 and I are working hard on syncing them up!
You can see here how we worked together on the day the O1-preview come out, which I thought was amazing: https://chatgpt.com/share/66e9718e-c24c-8007-9d38-1520241dd7e6

## Getting Started

First, run the development server:

```bash
npm run dev

```

in .env put at least your OPENAI_API_KEY - also supported are OPENAI_ORG_ID and OPENAI_PROJECT_ID (if you are using a service account)

This new version now uses Prisma as ORM and Postgres as DB - so you need to have a Postgres DB and the DB URL in your .env
POSTGRES_PRISMA_URL= ...

This version only implements a (non-streaming) chat interface but you can already do all the examples from the python version,
I just haven't created the interface for it yet. I will add a few more integrations soon and example soon.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


In your own Nextjs app you would only need to use the assistantCall.ts file and you create a tools.ts module to define your tools. In this version I have separated the tools into two files to show how to pick them up in a single tools.ts module. 
I'm still trying to figure out how to dymanically load the tools.ts module 
