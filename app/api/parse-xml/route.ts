import { NextRequest, NextResponse } from 'next/server';
import { parseString } from 'xml2js';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xml')) {
      return NextResponse.json(
        { error: 'File must be an XML file' },
        { status: 400 }
      );
    }

    // Read the file content
    const text = await file.text();

    // Parse XML to JSON
    return new Promise<Response>((resolve) => {
      parseString(text, { explicitArray: false }, (err: Error | null, result) => {
        if (err) {
          resolve(NextResponse.json(
            { error: 'Failed to parse XML file' },
            { status: 400 }
          ));
        } else {
          resolve(NextResponse.json(result));
        }
      });
    });

  } catch (error) {
    console.error('Error parsing XML:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 