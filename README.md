This app is wrapper/chat demo for the included 'assistantCall' module, which is meant to be an OpenAI Assistant 'runner'
Easily provide it with a prompt + files and 'let it run' included tool calling that can also include wrapped Assisntat calls

The original in Python https://github.com/jlvanhulst/fastapi-assistant is currently slightly ahead in terms of features - but O1 and I are working hard on syncing them up!
You can see here how we worked together on the day the O1-preview come out, which I thought was amazing: https://chatgpt.com/share/66e9718e-c24c-8007-9d38-1520241dd7e6

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

in .env put at least your OPENAI_API_KEY - also supported are OPENAI_ORG_ID and OPENAI_PROJECT_ID (if you are using a service 
account)

This version only implements a (non-streaming) chat interface but you can already do all the examples from the python version,
I just haven't created the interface for it yet. I will add a few more integrations soon and example soon.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
