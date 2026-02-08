/**
 * OpenRouter AI - Trinity model for smart task management
 * Used for: task suggestions, daily summaries, smart insights
 */

const MODEL = 'arcee-ai/trinity-large-preview:free';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function openRouterChat(
  messages: { role: string; content: string }[],
  options?: { reasoning?: boolean }
) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.warn('OPENROUTER_API_KEY not set');
    return null;
  }
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        ...(options?.reasoning && { reasoning: { enabled: true } }),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('OpenRouter error:', res.status, err);
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return content || null;
  } catch (err) {
    console.error('OpenRouter request failed:', err);
    return null;
  }
}

/** Suggest task breakdown from a project or goal description */
export async function suggestTasks(description: string): Promise<string[] | null> {
  const content = await openRouterChat([
    {
      role: 'user',
      content: `As a startup task management assistant, break this into 3-6 actionable tasks. Return ONLY a JSON array of task titles, e.g. ["Task 1", "Task 2"]. Input: ${description}`,
    },
  ]);
  if (!content) return null;
  try {
    const match = content.match(/\[[\s\S]*?\]/);
    if (match) {
      const arr = JSON.parse(match[0]) as string[];
      return Array.isArray(arr) ? arr.slice(0, 6) : null;
    }
  } catch { }
  return null;
}

/** Daily summary of tasks and progress */
export async function getDailySummary(tasks: { title: string; status: string; priority?: string }[]): Promise<string | null> {
  const text = tasks.map((t) => `- ${t.title} (${t.status}${t.priority ? `, ${t.priority}` : ''})`).join('\n');
  return openRouterChat([
    {
      role: 'user',
      content: `Summarize this task list for a founder in 2-3 brief sentences. Focus on priorities and blockers.\n\n${text || 'No tasks yet.'}`,
    },
  ]);
}
