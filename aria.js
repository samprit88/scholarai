/**
 * ARIA — AI Study Companion Module
 * Handles all AI proxy interactions and ARIA chat logic
 */
const ARIA = (() => {
    const API_URL = 'https://scholarai-api.onrender.com/api/chat';
    const MODEL = 'llama-3.3-70b-versatile';
    let conversationHistory = [];

    function getApiKey() {
        return 'connected';
    }

    function getPersonalityPrompt() {
        const settings = ScholarDB.getSettings();
        const p = settings.ariaPersonality || 'warm';
        const map = {
            warm: 'You are warm, friendly, and encouraging. Use a supportive tone with occasional emojis. Be like a caring study buddy who genuinely wants the student to succeed.',
            mentor: 'You are a knowledgeable academic mentor. Be precise, structured, and thorough. Provide detailed explanations with academic rigor while remaining approachable.',
            strict: 'You are a strict but fair study coach. Push the student to do better, set high standards, and be direct. Challenge them with tough questions and hold them accountable.'
        };
        return map[p] || map.warm;
    }

    function buildSystemPrompt() {
        const settings = ScholarDB.getSettings();
        const subjects = ScholarDB.getAll('subjects');
        const notes = ScholarDB.getAll('notes');
        const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
        const events = ScholarDB.getAll('events');

        const subjectInfo = subjects.map(s => {
            const noteCount = notes.filter(n => n.subjectId === s.id).length;
            return `${s.name} (${noteCount} notes, Teacher: ${s.teacher})`;
        }).join(', ');

        const pendingAssignments = assignments.map(a => {
            const sub = ScholarDB.getSubjectById(a.subjectId);
            return `"${a.title}" (${sub ? sub.name : 'Unknown'}) due ${a.dueDate} [${a.priority}]`;
        }).join('; ');

        const upcomingEvents = events.map(e => {
            return `${e.title} (${e.type}) on ${e.date}`;
        }).join('; ');

        return `You are ARIA, an elegant and warm AI study companion for students. You have access to this student data:
- Student: ${settings.name || 'Scholar'}, ${settings.class || 'Student'}
- Subjects: ${subjectInfo || 'None added yet'}
- Pending assignments: ${pendingAssignments || 'None'}
- Upcoming events: ${upcomingEvents || 'None'}
- Total notes: ${notes.length}

Your personality: ${getPersonalityPrompt()}

Help with: explaining topics simply and clearly, creating personalized study plans, summarizing notes, listing due assignments, generating quizzes, giving study strategies, and motivating students. Always be encouraging, warm, and student-focused. Format responses with clear sections using **bold headers** and bullet points. Use markdown formatting.`;
    }

    async function callGroq(messages) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000,
                stream: false
            })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API error: ${response.status}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }

    // ── Chat ────────────────────────────────────────────
    async function chat(userMessage) {
        const systemPrompt = buildSystemPrompt();
        conversationHistory.push({ role: 'user', content: userMessage });

        // Keep last 20 messages for context window
        const recentHistory = conversationHistory.slice(-20);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...recentHistory
        ];

        const reply = await callGroq(messages);
        conversationHistory.push({ role: 'assistant', content: reply });
        return reply;
    }

    function clearHistory() {
        conversationHistory = [];
    }

    // ── Notes AI ────────────────────────────────────────
    async function summarizeNote(content) {
        const messages = [
            {
                role: 'system',
                content: 'You are an expert academic assistant. Given these class notes analyze them deeply and provide: 1) SUMMARY: 4-5 precise bullet points of the most critical information, 2) KEY CONCEPTS: 6-8 most important terms as single words or short phrases, 3) EXAM QUESTIONS: 5 high-probability exam questions a teacher might ask, 4) FLASHCARDS: 5 pairs in exact format TERM|||DEFINITION. Use these exact headers.'
            },
            { role: 'user', content: content }
        ];
        return await callGroq(messages);
    }

    async function enhanceNote(content) {
        const messages = [
            {
                role: 'system',
                content: 'You are an expert note formatter. Take the raw, messy student notes provided and reformat them into clean, well-organized notes. Use clear headings, bullet points, highlight key terms in bold, and add brief explanatory notes where helpful. Keep the content accurate but make it more readable and study-friendly. Return only the enhanced notes text.'
            },
            { role: 'user', content: content }
        ];
        return await callGroq(messages);
    }

    // ── Assignment AI ───────────────────────────────────
    async function estimateTime(title, description) {
        const messages = [
            {
                role: 'system',
                content: 'Based on this student assignment title and description, estimate realistically how many hours it would take to complete. Reply with ONLY a number followed by hours, example: 2.5 hours'
            },
            { role: 'user', content: `Title: ${title}\nDescription: ${description}` }
        ];
        return await callGroq(messages);
    }

    // ── Test Connection ─────────────────────────────────
    async function testConnection() {
        const messages = [
            { role: 'system', content: 'Reply with exactly: Connection successful!' },
            { role: 'user', content: 'Test' }
        ];
        return await callGroq(messages);
    }

    // ── Quick Actions ───────────────────────────────────
    function getQuickPrompt(type) {
        const subjects = ScholarDB.getAll('subjects').map(s => s.name).join(', ');
        const assignments = ScholarDB.getAll('assignments')
            .filter(a => a.status !== 'done')
            .map(a => {
                const sub = ScholarDB.getSubjectById(a.subjectId);
                return `${a.title} (${sub ? sub.name : ''}) — due ${a.dueDate} [${a.priority}]`;
            }).join('\n');

        const map = {
            'study-plan': `Create a detailed 7-day study plan for me. My subjects are: ${subjects}. My pending assignments are:\n${assignments}\nMake it realistic with breaks and revision time.`,
            'summarize': `I want to review my notes. My subjects are: ${subjects}. Which subject should I focus on today? Give me a brief overview of what I should prioritize.`,
            'quiz': `Quiz me! Pick a random topic from my subjects (${subjects}) and give me 5 challenging but fair questions. Mix multiple choice and short answer. Don't reveal answers until I attempt them.`,
            'whats-due': `List all my pending assignments sorted by due date urgency:\n${assignments}\n\nGive me a prioritized action plan for tackling them.`,
            'explain': `I need help understanding a topic. Ask me what topic I'd like explained, then provide a clear, simple explanation with examples.`
        };
        return map[type] || '';
    }

    // ── Parse Markdown to HTML ──────────────────────────
    function parseMarkdown(text) {
        if (!text) return '';
        let html = text
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Headers
            .replace(/^### (.+)$/gm, '<h4 class="aria-h4">$1</h4>')
            .replace(/^## (.+)$/gm, '<h3 class="aria-h3">$1</h3>')
            .replace(/^# (.+)$/gm, '<h2 class="aria-h2">$1</h2>')
            // Unordered lists
            .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
            // Numbered lists
            .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Wrap consecutive li elements in ul
        html = html.replace(/(<li>.*?<\/li>(\s*<br>)*)+/g, (match) => {
            return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
        });

        return '<p>' + html + '</p>';
    }

    return {
        chat, clearHistory, summarizeNote, enhanceNote,
        estimateTime, testConnection, getQuickPrompt,
        parseMarkdown, getApiKey
    };
})();
