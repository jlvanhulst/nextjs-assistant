'use client';

import { useState, useEffect } from 'react';

interface Message {
  sender: 'user' | 'assistant';
  content: string;
}

interface Assistant {
  id: string;
  name: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<string | null>(null);

  // Fetch available assistants
  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        const response = await fetch('/api/assistants');
        const data = await response.json();
        setAssistants(data);
        setSelectedAssistant(data[0]?.id || null); // Automatically select the first assistant
      } catch (error) {
        console.error('Error fetching assistants:', error);
      }
    };

    fetchAssistants();
  }, []);

  // Persist threadId in localStorage
  useEffect(() => {
    const savedThreadId = localStorage.getItem('threadId');
    if (savedThreadId) {
      setThreadId(savedThreadId);
    }
  }, []);

  useEffect(() => {
    if (threadId) {
      localStorage.setItem('threadId', threadId);
    }
  }, [threadId]);

  const sendMessage = async () => {
    if (!selectedAssistant) {
      console.error('No assistant selected');
      return;
    }
  
    const content = inputValue.trim();
    if (!content) return;
  
    setMessages((prev) => [...prev, { sender: 'user', content }]);
    setInputValue('');
    setLoading(true);
  
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, threadId, assistantId: selectedAssistant }), // Pass the assistant ID here
      });
  
      const data = await response.json();
      console.log(data);
      if (response.ok) {
        setMessages((prev) => [...prev, { sender: 'assistant', content: data.response }]);
        setThreadId(data.threadId);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'assistant', content: 'Error: ' + data.error },
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', content: 'An error occurred while sending your message.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-black">Chat with Assistant</h1>
      
      {/* Dropdown for selecting an assistant */}
      <div className="mb-4">
        <label htmlFor="assistant-select" className="block text-black font-semibold mb-2">
          Select Assistant:
        </label>
        <select
          id="assistant-select"
          value={selectedAssistant || ''}
          onChange={(e) => setSelectedAssistant(e.target.value)}
          className="w-full p-2 border rounded text-black bg-white"
        >
          {assistants.map((assistant) => (
            <option key={assistant.id} value={assistant.id}>
              {assistant.name}
            </option>
          ))}
        </select>
      </div>

      <div className="border p-4 h-96 overflow-y-scroll mb-4 bg-white text-black">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`my-2 p-2 rounded max-w-[80%] ${
              msg.sender === 'user' ? 'bg-blue-200 text-black ml-auto' : 'bg-gray-200 text-black mr-auto'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div className="italic text-gray-500 mt-2">Assistant is typing...</div>}
      </div>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Type your message..."
        className="w-full p-2 border rounded mb-2 text-black bg-white"
        disabled={loading}
      />
      <button
        onClick={sendMessage}
        className="w-full p-2 bg-blue-500 text-white rounded"
        disabled={loading}
      >
        Send
      </button>
    </div>
  );
}