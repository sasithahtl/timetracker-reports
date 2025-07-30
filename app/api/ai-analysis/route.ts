import { NextRequest, NextResponse } from 'next/server';

interface TimeEntry {
  id: string;
  date: string;
  user: string;
  project: string;
  task: string;
  description: string;
  hours: number;
  taskNumber?: string;
}

interface ParsedData {
  entries: TimeEntry[];
  summary: {
    totalHours: number;
    totalDays: number;
    users: string[];
    projects: string[];
  };
}

interface GroupedProgress {
  [user: string]: {
    projects: {
      [project: string]: {
        tasks: Array<{
          taskNumber?: string;
          description: string;
          hours: number;
          dates: string[];
        }>;
        totalHours: number;
      };
    };
    leave?: Array<{ date: string; reason: string }>;
    publicHolidays?: Array<{ date: string; reason: string }>;
    totalHours: number;
  };
}

interface RequestBody {
  prompt: string;
  data: {
    entries: TimeEntry[];
    summary: ParsedData['summary'];
    groupedProgress: GroupedProgress;
  };
}

// Function to analyze data using a simple rule-based approach
// In a real implementation, you would integrate with OpenAI, Anthropic, or other AI services

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { prompt, data } = body;

    if (!prompt || !data) {
      return NextResponse.json(
        { error: 'Missing prompt or data' },
        { status: 400 }
      );
    }

    // For now, use rule-based analysis
    // In a production environment, you would integrate with an AI service like:
    // - OpenAI GPT-4
    // - Anthropic Claude
    // - Google Gemini
    // - Azure OpenAI
    
    const analysis = analyzeWithOpenAI(prompt, data);

    return NextResponse.json({
      analysis,
      timestamp: new Date().toISOString(),
      prompt: prompt
    });

  } catch (error) {
    console.error('Error in AI analysis:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI analysis' },
      { status: 500 }
    );
  }
}

// Example integration with OpenAI (uncomment and configure for production use)

async function analyzeWithOpenAI(prompt: string, data: RequestBody['data']): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const systemPrompt = `You are a business analyst specializing in team productivity and project management. 
  Analyze the provided timesheet data and provide insights based on the user's prompt. 
  Focus on actionable insights, trends, and recommendations.`;

  const userPrompt = `Based on this timesheet data:
  ${JSON.stringify(data, null, 2)}
  
  Please analyze: ${prompt}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error('OpenAI API request failed');
  }

  const result = await response.json();
  return result.choices[0].message.content;
}
