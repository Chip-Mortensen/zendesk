# Zendesk Clone MVP Plan

A plan for building a Zendesk-like system with ticketing, AI-powered live chat, and a knowledge base using Next.js as a full-stack framework with direct Supabase/Postgres integration.

## 1. Project Setup & Prerequisites

### 1.1 Create a New Supabase Project

- Sign in at Supabase, create a new project
- Get Database URL, API key, and credentials

### 1.2 Initialize Next.js Project

```bash
# Create new Next.js app
npx create-next-app zendesk-clone

# Navigate and install dependencies
cd zendesk-clone
npm install
```

### 1.3 Install Supabase Client (Optional)

```bash
npm install @supabase/supabase-js
```

## 2. Database & Schema

### 2.1 Core Tables

1. **users**

   - `id` (UUID, primary key)
   - `email` (unique)
   - `password_hash`
   - `created_at`
   - `updated_at`

2. **tickets**

   - `id` (UUID, primary key)
   - `title`
   - `description`
   - `status` (enum: open, closed, etc.)
   - `created_by` (UUID → users.id)
   - `assigned_to` (UUID → users.id, nullable)
   - `created_at`
   - `updated_at`

3. **ticket_comments**

   - `id` (UUID, primary key)
   - `ticket_id` (UUID → tickets.id)
   - `comment_text`
   - `created_by` (UUID → users.id)
   - `created_at`

4. **kb_articles**

   - `id` (UUID, primary key)
   - `title`
   - `content`
   - `created_by` (UUID → users.id)
   - `created_at`
   - `updated_at`

5. **chat_messages**
   - `id` (UUID, primary key)
   - `message_text`
   - `sender_id` (UUID → users.id)
   - `created_at`
   - Optional: `conversation_id`

### 2.2 SQL Schema Creation

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tickets table
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ticket comments table
CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES tickets(id),
    comment_text TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Knowledge base articles table
CREATE TABLE kb_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_text TEXT NOT NULL,
    sender_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## 3. Next.js Implementation

### 3.1 Project Structure

```
zendesk-clone/
├─ pages/
│  ├─ api/
│  │  └─ tickets/
│  │     └─ index.js
│  ├─ tickets/
│  │  ├─ index.js      # list tickets page
│  │  └─ [ticketId].js # single ticket page
│  ├─ kb/
│  │  ├─ index.js      # knowledge base list
│  │  └─ [articleId].js # single article
│  ├─ chat/
│  │  └─ index.js      # chat UI
│  └─ index.js         # homepage
├─ components/
│  ├─ TicketList.js
│  ├─ TicketForm.js
│  ├─ ChatWindow.js
│  ├─ KBList.js
│  └─ ...
```

### 3.2 API Routes Example

```javascript
// pages/api/tickets/index.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // or anon key if just reading
);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // GET /api/tickets -> retrieve all tickets
    const { data, error } = await supabase.from('tickets').select('*');

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    // POST /api/tickets -> create a new ticket
    const { title, description, created_by } = req.body;
    const { data, error } = await supabase.from('tickets').insert([{ title, description, created_by }]).single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  }

  // ... handle other methods if needed
  return res.status(405).json({ error: 'Method not allowed' });
}
```

### 3.3 Component Example

```javascript
// components/TicketList.js
import { useEffect, useState } from 'react';

export default function TicketList() {
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    fetch('/api/tickets')
      .then((res) => res.json())
      .then((data) => setTickets(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div>
      <h1>Tickets</h1>
      {tickets.map((t) => (
        <div key={t.id}>
          <h2>{t.title}</h2>
          <p>{t.description}</p>
        </div>
      ))}
    </div>
  );
}
```

## 4. Core Features Implementation

### 4.1 User Authentication

- Registration and login endpoints (`/api/auth/login`, `/api/auth/register`)
- Session management (JWT or NextAuth.js)
- Protected routes and middleware
- Option to use Supabase Auth or custom implementation

### 4.2 Ticketing System

- List view of all tickets (`GET /api/tickets`)
- Create ticket form (`POST /api/tickets`)
- Ticket detail view (`GET /api/tickets/[id]`)
- Add comments (`POST /api/tickets/[id]/comments`)
- Status management and assignment

### 4.3 Knowledge Base

- Article listing with search (`GET /api/kb_articles`)
- Article detail view (`GET /api/kb_articles/[id]`)
- Article creation/editing (restricted by role)
- Rich text editor integration

### 4.4 AI-Powered Live Chat

- Real-time chat interface
- Message persistence in `chat_messages` table
- AI integration with OpenAI
- KB article suggestions
- Typing indicators

## 5. AI Integration

### 5.1 Setup

```bash
npm install openai
```

### 5.2 Knowledge Base Search

```javascript
// Example KB search with Supabase
const { data, error } = await supabase.from('kb_articles').select('*').ilike('content', `%${userQuery}%`);
```

### 5.3 OpenAI Integration

```javascript
import { Configuration, OpenAIApi } from 'openai';

const config = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(config);

async function handleUserMessage(userMessage) {
  // Optional: get KB content
  const kbContent = '...some relevant article text...';

  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful support agent...' },
      { role: 'user', content: userMessage },
      // Optionally pass in relevant KB content as context
    ],
  });
  return response.data.choices[0].message.content;
}
```

### 5.4 Real-time Updates

Choose one:

- Supabase Realtime (subscribe to chat_messages changes)
- WebSocket (Socket.io)
- Polling

## 6. Deployment

### 6.1 Prerequisites

- Set up environment variables
- Configure database connections
- Set up API keys (OpenAI, Supabase)

### 6.2 Deployment Steps

1. Build the application
2. Deploy to Vercel/Netlify
3. Configure production environment
4. Set up monitoring

## 7. Future Enhancements

### 7.1 Features

- Role-based access control
- Advanced search capabilities
- File attachments
- Email notifications
- Slack integration

### 7.2 Performance

- Implement caching
- Optimize database queries
- Add rate limiting
- Set up monitoring

### 7.3 AI Improvements

- Streaming responses
- Custom training
- Multi-language support
- Analytics dashboard
