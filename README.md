# 🎙️ AI Mock Interview Platform

> A voice-based, AI-powered mock interview platform that adapts to your resume, evaluates your performance, and helps you improve — with full privacy for your personal data.

---

## 📌 Overview

Upload your resume and a job description, and the platform conducts a fully adaptive, voice-driven mock interview. It listens to your answers in real time, asks intelligent follow-up questions, evaluates your performance across multiple dimensions, and gives you a personalised study plan — all powered by a combination of local and cloud AI.

---

## ✨ Features

- 🔐 **JWT Authentication** — Secure signup, login, and protected routes
- 📄 **Resume Parsing** — Upload PDF or DOCX; text extracted and structured locally
- 🧠 **Local LLM Inference** — Zero PII sent to the cloud during resume processing
- 🎤 **Voice Interview** — Real-time STT + AI-spoken questions via TTS
- 🔄 **Adaptive Questioning** — Follow-ups conditioned on your previous answers
- 📊 **AI Evaluation** — Scored across 4 dimensions with personalised feedback
- 💬 **RAG Chatbot** — Chat with an AI that knows your full interview history
- 📁 **Interview History** — Review all past sessions and evaluations anytime

---

## 🤖 AI Pipeline

### 1. Privacy-First Resume Parser (Local LLM)
- Resume text (PDF/DOCX) extracted via `pdf-parse` / `mammoth` and passed to a **locally hosted Qwen 2.5 3B model** via `llama.cpp` server
- Extracts structured JSON (skills, projects, experience) using **JSON grammar constraints + few-shot prompting** — enforcing schema-conformant output and eliminating malformed generations
- Zero PII transmitted to any external API during this stage

### 2. Adaptive Interview Engine (Gemini API)
- Synthesises structured resume JSON + job description to generate **role-specific technical questions**
- Each follow-up is conditioned on the full dialogue history, resume profile, and JD — mimicking real panel interview adaptability
- Multi-turn conversational loop managed server-side via `prompts/` and `services/`

### 3. Voice Pipeline (STT / TTS)
- **Silero VAD** (`@ricky0123/vad-web`) — automatic voice activity detection to trigger recording
- **AssemblyAI Streaming STT** — real-time transcription of candidate speech during interviews
- **Web Speech API TTS** — vocalises AI-generated questions for a fully hands-free experience

### 4. Post-Interview Evaluation Engine (Gemini API)
Scores candidates across four dimensions:

| Dimension | What's Evaluated |
|---|---|
| Technical Accuracy | Correctness and depth of answers |
| Communication | Clarity, structure, and articulation |
| Problem Solving | Approach, reasoning, and adaptability |
| Confidence | Delivery consistency and hesitation patterns |

Generates per-dimension **strengths**, **areas of concern**, **practice suggestions**, and **curated study material links**.

### 5. RAG Chatbot (LangGraph + ChromaDB)
- Post-interview chatbot powered by **LangGraph** + **LangChain** + **Gemini API**
- Vector store: **ChromaDB** (`chroma_data/`) with **Sentence Transformer embeddings**
- **Semantic chunking** + **MMR (Maximal Marginal Relevance)** retrieval for diverse, non-redundant context
- Returns cited, context-grounded answers over the user's full interview history
- Served as a **decoupled FastAPI microservice** (`rag_service/`) — Express proxies requests after JWT validation

---

## 🛠️ Tech Stack

### Frontend
| Tech | Purpose |
|---|---|
| React + Vite | UI framework |
| Tailwind CSS | Styling |
| `@ricky0123/vad-web` | Silero VAD — voice activity detection |
| AssemblyAI | Streaming STT |
| Web Speech API | TTS for question narration |
| React Router | Client-side routing |
| Axios | HTTP client |

### Backend
| Tech | Purpose |
|---|---|
| Node.js + Express | Core REST API |
| MongoDB + Mongoose | Database |
| JWT + bcryptjs | Authentication |
| Multer | Resume file uploads |
| pdf-parse + mammoth | PDF and DOCX text extraction |
| `@google/generative-ai` | Gemini API integration |

### AI / ML (RAG Service)
| Tech | Purpose |
|---|---|
| FastAPI + Uvicorn | RAG microservice server |
| llama.cpp | Local LLM inference server |
| Qwen 2.5 3B | Privacy-first resume extraction |
| Gemini API (`langchain-google-genai`) | Question generation + evaluation + RAG generation |
| LangChain + LangGraph | RAG orchestration and graph-based flow |
| ChromaDB (`langchain-chroma`) | Vector store for interview history |
| Sentence Transformers | Document embeddings |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.11
- MongoDB instance (local or Atlas)
- llama.cpp built with Qwen 2.5 3B model downloaded
- Gemini API key
- AssemblyAI API key

### 1. Clone the repository
```bash
git clone https://github.com/ashwin9000/VoiceAI-AI_Interview_Platform.git
cd VoiceAI-AI_Interview_Platform
```

### 2. Start the local LLM server
```bash
for mac:
brew install llama.cpp

for windows:
winget install llama.cpp

then run:
llama-server -hf Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M
```

### 3. Configure environment variables

**`server/.env`**
```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
LLAMA_SERVER_URL=http://localhost:8080
RAG_SERVICE_URL=http://localhost:8000
```

**`rag_service/.env`**
```env
GEMINI_API_KEY=your_gemini_api_key
CHROMA_PATH=./chroma_data
```

### 4. Start the Express backend
```bash
cd server
npm install
npm run dev
```

### 5. Start the FastAPI RAG microservice
```bash
cd rag_service
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
fastapi dev
```

### 6. Start the React frontend
```bash
cd client
npm install
npm run dev
```

## 📁 Project Structure

```
AI_INTERVIEWER_ANTIGRAVITY/
│
├── client/                        # React + Vite frontend
│   └── src/
│       ├── components/            # Reusable UI components
│       ├── pages/                 # Route-level page components
│       ├── context/               # React context (auth, state)
│       ├── services/              # Axios API call wrappers
│       └── utils/                 # Helper functions
│
├── server/                        # Express.js backend
│   ├── config/                    # DB connection, env config
│   ├── controllers/               # Route handler logic
│   ├── middleware/                # JWT auth middleware
│   ├── models/                    # Mongoose schemas
│   ├── routes/                    # Express route definitions
│   ├── services/                  # Business logic (Gemini, llama.cpp calls)
│   ├── prompts/                   # LLM prompt templates
│   ├── utils/                     # Utility helpers
│   └── uploads/                   # Temporary resume file storage
│
├── rag_service/                   # FastAPI RAG microservice (Python)
│   ├── app/                       # FastAPI app and routes
│   └── chroma_data/               # Persisted ChromaDB vector store
│
└── chroma_data/                   # Root-level ChromaDB (shared/backup)
```

---

## 🔒 Privacy

Resume parsing runs entirely on your local machine using a locally hosted LLM. **No resume content or personal data is sent to external APIs** during the extraction phase. Only the structured JSON output (skills, experience, projects) is used downstream for question generation.

---
