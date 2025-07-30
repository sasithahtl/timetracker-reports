# XML to PDF Generator

A modern web application built with Next.js that allows users to upload XML files, parse them, and generate beautiful PDF documents with a clean, professional layout.

## Features

- **XML File Upload**: Drag and drop or click to upload XML files
- **XML Parsing**: Automatically parse XML content using xml2js
- **Data Visualization**: View parsed data in a readable JSON format
- **PDF Generation**: Generate professional PDF documents using Puppeteer
- **Modern UI**: Clean, responsive interface built with Tailwind CSS
- **Real-time Processing**: See parsing and generation progress in real-time

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **XML Parsing**: xml2js
- **PDF Generation**: Puppeteer
- **Development**: ESLint, Turbopack

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pdf-generator-app
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Navigate to the Upload Page**: Click "Start Uploading XML" on the home page or go to `/upload`

2. **Upload XML File**: 
   - Drag and drop an XML file onto the upload area
   - Or click to browse and select an XML file

3. **View Parsed Data**: The application will automatically parse the XML and display the structured data

4. **Generate PDF**: Click the "Generate PDF" button to create a professional PDF document

5. **Download**: The PDF will automatically download to your device

## Sample Data

A sample XML file (`sample-data.xml`) is included in the project root for testing purposes. It contains company data with employees, projects, and contact information.

## API Endpoints

- `POST /api/parse-xml`: Parse uploaded XML files
- `POST /api/generate-pdf`: Generate PDF from parsed data

## Project Structure

```
pdf-generator-app/
├── app/
│   ├── api/
│   │   ├── parse-xml/
│   │   │   └── route.ts          # XML parsing API
│   │   └── generate-pdf/
│   │       └── route.ts          # PDF generation API
│   ├── upload/
│   │   └── page.tsx              # Upload page component
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── public/                       # Static assets
├── sample-data.xml              # Sample XML file for testing
└── package.json
```

## Development

### Available Scripts

- `npm run dev`: Start development server with Turbopack
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

### Key Components

- **Upload Page** (`app/upload/page.tsx`): Main interface for file upload and data display
- **XML Parser** (`app/api/parse-xml/route.ts`): Handles XML file parsing using xml2js
- **PDF Generator** (`app/api/generate-pdf/route.ts`): Generates PDF documents using Puppeteer

## Customization

### Styling
The application uses Tailwind CSS for styling. You can customize the design by modifying the CSS classes in the components.

### PDF Layout
The PDF generation uses a custom HTML template with embedded CSS. You can modify the `generateHTML` function in `app/api/generate-pdf/route.ts` to change the PDF layout and styling.

### XML Parsing
The XML parsing configuration can be adjusted in `app/api/parse-xml/route.ts`. The current setup uses `explicitArray: false` to simplify the output structure.

## Deployment

The application can be deployed to Vercel, Netlify, or any other platform that supports Next.js applications.

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For support or questions, please open an issue in the repository.
