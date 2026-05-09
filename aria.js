/**
 * ARIA — AI Study Companion Module
 * Handles all AI proxy interactions and ARIA chat logic
 */
const ARIA = (() => {
    const API_URL = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? '/api/chat' : 'https://scholarai-api.onrender.com/api/chat';
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

    function capContext(text, maxChars = 3200) {
        if (text.length <= maxChars) return text;
        return text.slice(0, maxChars - 80) + '\n[Context capped to 800 tokens maximum.]';
    }

    async function fetchFirestoreStudentContext() {
        const user = window.ScholarFirebase?.auth?.currentUser;
        const db = window.ScholarFirebase?.firestore;
        if (!user || !db) return '';
        try {
            const base = db.collection('users').doc(user.uid);
            const [assignmentSnap, timetableDoc, notesSnap] = await Promise.all([
                base.collection('assignments').get(),
                base.collection('timetable').doc('weeklySchedule').get(),
                base.collection('notes').get()
            ]);

            const assignments = assignmentSnap.docs.map(doc => {
                const a = doc.data();
                return `- ${a.title || 'Untitled'} | ${a.subject || a.subjectId || 'General'} | deadline: ${a.deadline || a.dueDate || 'none'} | status: ${a.status || 'todo'}`;
            }).join('\n') || 'None';

            const timetableData = timetableDoc.exists ? timetableDoc.data() : {};
            const timetableItems = Array.isArray(timetableData.items) ? timetableData.items : [];
            const timetable = timetableItems.map(item => {
                return `- ${item.day || 'Day'} ${item.startTime || ''}-${item.endTime || ''}: ${item.subject || item.subjectId || 'Class'} ${item.room ? '(' + item.room + ')' : ''}`;
            }).join('\n') || 'None';

            const notes = notesSnap.docs.map(doc => {
                const n = doc.data();
                return `- ${n.title || 'Untitled'} | ${n.subject || n.subjectId || 'General'}`;
            }).join('\n') || 'None';

            return capContext(`You are ARIA, the AI study assistant inside ScholarAI. Here is this student's current data:
STUDENT NAME: ${user.displayName || 'Scholar'}
TODAY: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
ASSIGNMENTS:
${assignments}
TIMETABLE:
${timetable}
NOTES:
${notes}
Use this context to give personalized, proactive advice. If you notice upcoming deadlines or subjects not recently studied, mention them proactively.`);
        } catch (error) {
            return '';
        }
    }

    async function buildSystemPrompt() {
        const settings = ScholarDB.getSettings();
        const subjects = ScholarDB.getAll('subjects');
        const notes = ScholarDB.getAll('notes');
        const assignments = ScholarDB.getAll('assignments').filter(a => a.status !== 'done');
        const events = ScholarDB.getAll('events');
        const liveStudentContext = await fetchFirestoreStudentContext();

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

        return `${liveStudentContext ? liveStudentContext + '\n\n' : ''}You are ARIA, a warm intelligent and deeply knowledgeable AI study companion for students.

You have access to student data:
- Student name: ${settings.name || 'Scholar'}
- Class/year: ${settings.class || 'Student'}
- Subjects: ${subjectInfo || 'None added yet'}
- Notes count: ${notes.length}
- Assignments: ${pendingAssignments || 'None'}
- Events: ${upcomingEvents || 'None'}

Your core capabilities are:
1) STUDY PLANNING: Always create exactly 7-day plans with specific daily tasks, time allocations, and subject rotation. Consider actual assignments and exam dates when planning. A 7-day plan must include Day 1 - Monday, Day 2 - Tuesday, Day 3 - Wednesday, Day 4 - Thursday, Day 5 - Friday, Day 6 - Saturday, and Day 7 - Sunday. Never generate fewer than 7 days.
2) TOPIC EXPLANATION: Explain any academic topic clearly using simple language, real-world examples, analogies, and step-by-step breakdowns. Cover Physics, Chemistry, Mathematics, Biology, English, History, Geography and any other subject.
3) ASSIGNMENT HELP: Help students understand requirements, break into smaller tasks, suggest approaches and resources.
4) QUIZ GENERATION: Create varied question types: multiple choice, short answer, true/false. Always provide answers after student attempts.
5) NOTE SUMMARIZATION: When asked to summarize notes ask which subject first, then provide structured summary with key points, important formulas or dates, and likely exam questions.
6) MOTIVATION: When students feel overwhelmed acknowledge their feelings first then provide specific actionable encouragement based on actual progress data.
7) EXAM STRATEGY: Give specific study strategies, memory techniques like mnemonics and spaced repetition, and time management advice.

Always structure responses with clear headers and bullet points for easy mobile reading. Keep individual paragraphs short maximum 3 sentences each. Use encouraging language always. Never give vague answers: always be specific and actionable.

Your personality: ${getPersonalityPrompt()}`;
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
                max_tokens: 1600,
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
        const systemPrompt = await buildSystemPrompt();
        conversationHistory.push({ role: 'user', content: userMessage });

        // Keep last 20 messages for context window
        const recentHistory = conversationHistory.slice(-20);
        const messages = [
            { role: 'system', content: systemPrompt },
            ...recentHistory
        ];

        let reply = await callGroq(messages);
        if (isStudyPlanRequest(userMessage) && !hasCompleteSevenDayPlan(reply)) {
            reply = await callGroq([
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: `${userMessage}\n\nYour previous answer was incomplete. Rewrite the plan now. It must include exactly these seven bold headers once each: **Day 1 - Monday**, **Day 2 - Tuesday**, **Day 3 - Wednesday**, **Day 4 - Thursday**, **Day 5 - Friday**, **Day 6 - Saturday**, **Day 7 - Sunday**. Under every day include 2-3 specific study tasks with subject, topic, and duration. Do not omit any day.`
                }
            ]);
        }
        conversationHistory.push({ role: 'assistant', content: reply });
        return reply;
    }

    function isStudyPlanRequest(message) {
        return /7-day study plan|seven day study plan|study plan/i.test(message || '');
    }

    function hasCompleteSevenDayPlan(text) {
        const required = [
            /Day\s*1\s*[-–—]\s*Monday/i,
            /Day\s*2\s*[-–—]\s*Tuesday/i,
            /Day\s*3\s*[-–—]\s*Wednesday/i,
            /Day\s*4\s*[-–—]\s*Thursday/i,
            /Day\s*5\s*[-–—]\s*Friday/i,
            /Day\s*6\s*[-–—]\s*Saturday/i,
            /Day\s*7\s*[-–—]\s*Sunday/i
        ];
        return required.every(pattern => pattern.test(text || ''));
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
            'study-plan': `Create a 7-day study plan for me using exactly 7 days Monday through Sunday. You must output all of these bold headers exactly once: **Day 1 - Monday**, **Day 2 - Tuesday**, **Day 3 - Wednesday**, **Day 4 - Thursday**, **Day 5 - Friday**, **Day 6 - Saturday**, **Day 7 - Sunday**.\n\nMy subjects are: ${subjects || 'No subjects added yet, choose balanced academic subjects'}.\n\nMy pending assignments are:\n${assignments || 'None'}\n\nFor every day include 2-3 specific study tasks. Each task must include subject name, topic suggestion, and recommended duration. If there are fewer than 7 subjects, repeat subjects across days with different topic suggestions. Consider due assignments and exam/event dates. Use clear day separators. Never generate less than 7 days.`,
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
