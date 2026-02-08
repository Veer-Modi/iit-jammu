import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { openRouterChat } from '@/lib/openrouter';

const getAuthToken = (req: NextRequest): string | null => {
    const authHeader = req.headers.get('authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

export async function POST(req: NextRequest) {
    try {
        const token = getAuthToken(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await req.json();
        const { startup_idea } = body;

        if (!startup_idea || startup_idea.trim().length < 10) {
            return NextResponse.json({ error: 'Please provide a detailed startup idea (min 10 characters)' }, { status: 400 });
        }

        const prompt = `You are an expert startup advisor and business consultant. A founder has shared their startup idea with you. Analyze it and provide:

1. **Core Value Proposition**: What problem does this solve and for whom?
2. **Key Milestones** (5-7 actionable milestones in chronological order to go from idea to launch)
3. **Potential Risks** (3-4 major risks to watch for)
4. **Quick Wins** (3 things they can do THIS WEEK to validate the idea)
5. **Success Metrics** (KPIs to track)

Keep your response concise, actionable, and founder-friendly. Format as JSON with fields: value_proposition, milestones (array), risks (array), quick_wins (array), success_metrics (array).

**Startup Idea:**
${startup_idea}`;

        const aiResponse = await openRouterChat([
            {
                role: 'system',
                content: 'You are an expert startup advisor. Provide actionable, practical advice in JSON format.'
            },
            {
                role: 'user',
                content: prompt
            }
        ], { reasoning: true });

        if (!aiResponse) {
            return NextResponse.json({
                value_proposition: 'AI analysis unavailable. Please check OpenRouter API configuration.',
                milestones: [],
                risks: [],
                quick_wins: [],
                success_metrics: []
            });
        }

        // Parse AI response
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const guidance = JSON.parse(jsonMatch[0]);
                return NextResponse.json(guidance);
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
        }

        // Fallback response
        return NextResponse.json({
            value_proposition: aiResponse.substring(0, 300),
            milestones: [],
            risks: [],
            quick_wins: [],
            success_metrics: []
        });

    } catch (error) {
        console.error('Startup guidance error:', error);
        return NextResponse.json(
            { error: 'Failed to generate guidance' },
            { status: 500 }
        );
    }
}
