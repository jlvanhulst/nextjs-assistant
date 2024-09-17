'use client';

import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';

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

  // New state variable for selected file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Ref to scroll to the bottom
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch available assistants
  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        const response = await fetch('/api/assistants');
        const data = await response.json();
        setAssistants(data);
        if (data.length > 0) {
          setSelectedAssistant(data[0]?.id || null);
        }
      } catch (error) {
        console.error('Error fetching assistants:', error);
      }
    };

    fetchAssistants();
  }, []);

  // Persist threadId in sessionStorage
  useEffect(() => {
    const savedThreadId = sessionStorage.getItem('threadId');
    if (savedThreadId) {
      setThreadId(savedThreadId);
    }
  }, []);

  useEffect(() => {
    if (threadId) {
      sessionStorage.setItem('threadId', threadId);
    }
  }, [threadId]);

  // Scroll to the bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if buttons and inputs should be disabled
  const isDisabled = loading || selectedAssistant === null;

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
        body: JSON.stringify({ content, threadId, assistantId: selectedAssistant }),
      });

      const data = await response.json();

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

  const startNewChat = () => {
    setMessages([]);
    setThreadId(null);
    sessionStorage.removeItem('threadId');
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  // Upload the selected file
  const uploadFile = async () => {
    if (!selectedAssistant) {
      console.error('No assistant selected');
      return;
    }

    if (!selectedFile) {
      console.error('No file selected');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('threadId', threadId as string );
    formData.append('assistantId', selectedAssistant);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          { sender: 'user', content: `Uploaded file: ${selectedFile.name}` }
        ]);
        setThreadId(data.threadId);
        setSelectedFile(null);
      } else {
        setMessages((prev) => [
          ...prev,
          { sender: 'assistant', content: 'Error: ' + data.error },
        ]);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', content: 'An error occurred while uploading your file.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Render message content with Markdown
  const renderMessageContent = (content: string) => {
    const htmlContent = marked(content);
    return { __html: htmlContent };
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Chat with Assistant</h1>
      </div>

      {/* Dropdown for selecting an assistant */}
      <div className="p-4 bg-gray-700 text-white">
        <label htmlFor="assistant-select" className="block text-white font-semibold mb-2">
          Select Assistant:
        </label>
        {assistants.length > 0 ? (
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
        ) : (
          <p className="w-full p-2 border rounded text-black bg-white">
            No assistants found - check your settings
          </p>
        )}
      </div>

      {/* Message Area */}
      <div className="flex-grow p-4 overflow-y-scroll bg-white">
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`p-2 rounded max-w-[80%] ${
                msg.sender === 'user'
                  ? 'bg-blue-200 text-black ml-auto'
                  : 'bg-gray-200 text-black mr-auto'
              }`}
            >
              {msg.sender === 'assistant' ? (
                <div dangerouslySetInnerHTML={renderMessageContent(msg.content)} />
              ) : (
                msg.content
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input and Buttons Area */}
      <div className="p-4 bg-gray-800 flex items-center space-x-4">
        {/* File Upload Input */}
        <input
          type="file"
          onChange={handleFileChange}
          className="text-white"
          disabled={isDisabled}
        />

        {/* Upload File Button */}
        <button
          onClick={uploadFile}
          className="p-2 bg-green-500 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={isDisabled || !selectedFile}
        >
          Upload File
        </button>

        {/* Message Input */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow p-2 border rounded text-black bg-white disabled:bg-gray-200 disabled:text-gray-400"
          disabled={isDisabled}
        />

        {/* Send Message Button */}
        <button
          onClick={sendMessage}
          className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={isDisabled || !inputValue.trim()}
        >
          Send
        </button>

        {/* New Chat Button */}
        <button
          onClick={startNewChat}
          className="p-2 bg-red-500 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={isDisabled}
        >
          New Chat
        </button>
      </div>
    </div>
  );
}
