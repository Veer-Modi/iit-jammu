import { NextRequest, NextResponse } from 'next/server';
import { openRouterChat } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
    try {
        const { milestones, workspaceName } = await req.json();

        const prompt = `
      You are a startup consultant. Generate a pitch deck text for a startup named "${workspaceName}".
      
      Here are the completed milestones (projects) achieved so far:
      ${milestones.map((m: any) => `- ${m.name || m.title} (Status: ${m.status})`).join('\n')}

      If the list is empty, assume they are pre-revenue/early stage.

      Return the content in Valid JSON format with the following keys:
      {
        "problem": "Describe a compelling problem statement relevant to these milestones.",
        "solution": "Describe the solution based on the completed projects.",
        "traction": "Highlight the milestones achieved as proof of traction.",
        "market": "Brief market opportunity description.",
        "team": "Description of the team capabilities."
      }
      Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

        // Use openRouterChat helper
        const content = await openRouterChat([{ role: 'user', content: prompt }]);
        const cleanContent = content?.replace(/```json|```/g, '').trim();

        return NextResponse.json(JSON.parse(cleanContent || '{}'));
    } catch (error) {
        console.error('Pitch Deck AI Error:', error);
        return NextResponse.json({ error: 'Failed to generate pitch deck' }, { status: 500 });
    }
}
