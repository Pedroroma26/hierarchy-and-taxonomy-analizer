# Product Hierarchy & Taxonomy Analyzer

AI-powered tool for analyzing product data and designing optimal hierarchy structures for PIM/MDM implementations.

## 🎯 What does it do?

Analyzes raw product data (Excel/CSV) and automatically:
- Calculates cardinality scores for all attributes
- Recommends optimal hierarchy structure (Brand → Category → SKU levels)
- Classifies attributes into logical taxonomy groups
- Suggests Record IDs and Record Names for each level
- Validates data quality and completeness
- Generates export-ready documentation for PIM platforms (Salsify, Akeneo, etc.)

## 🚀 Live Demo

**Production:** https://hierarchy-and-taxonomy-analizer--promariz.replit.app/

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript
- **Build Tool:** Vite
- **UI Framework:** Tailwind CSS + shadcn/ui
- **Data Processing:** Client-side analysis (no backend required)
- **Charts:** Recharts
- **Export:** PDF generation, JSON export

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Setup

```bash
# Clone the repository
git clone https://github.com/Pedroroma26/hierarchy-and-taxonomy-analizer.git

# Navigate to project directory
cd hierarchy-and-taxonomy-analizer

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

## 🏗️ Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── FileUpload.tsx          # File upload interface
│   ├── CardinalityAnalysis.tsx # Cardinality visualization
│   ├── HierarchyProposal.tsx   # Hierarchy display
│   ├── PropertyRecommendations.tsx
│   ├── ThresholdAdjuster.tsx   # Interactive threshold controls
│   └── SkuLevelForcing.tsx     # Manual property forcing
├── utils/
│   ├── analysisEngine.ts       # Core analysis logic
│   ├── exportReport.ts         # JSON/PDF export
│   └── dataValidation.ts       # Data quality checks
├── pages/
│   └── Index.tsx               # Main application page
└── main.tsx                    # App entry point
```

## 🎨 Key Features

### 1. Cardinality-Based Analysis
Automatically calculates uniqueness scores to determine optimal hierarchy placement:
- **0-20% unique:** Parent/Brand level
- **20-75% unique:** Child/Category levels  
- **98%+ unique:** SKU/Item level

### 2. Smart Property Classification
Groups attributes into logical categories:
- SKU Identifiers (SKU, EAN, GTIN)
- Measurements & UoM
- Logistics & Inventory
- Technical Specs & Dates
- Descriptions & Names

### 3. Interactive Refinement
- Adjust cardinality thresholds with sliders
- Force specific properties to SKU-level
- Changes are cumulative and persistent during session

### 4. Data Quality Validation
- Missing value detection
- Duplicate property warnings
- Completeness scoring per attribute

### 5. Export Options
- **JSON:** Machine-readable hierarchy structure
- **PDF:** Human-readable documentation with charts and recommendations

## 🔒 Privacy & Security

**All data processing happens client-side:**
- Files are processed in the browser (no upload to server)
- No data is stored or transmitted
- Refresh page = all data cleared from memory
- GDPR compliant by design

## 🤝 Contributing

This is a demonstration project. For questions or suggestions:
- GitHub: [@Pedroroma26](https://github.com/Pedroroma26)
- Repository: [hierarchy-and-taxonomy-analizer](https://github.com/Pedroroma26/hierarchy-and-taxonomy-analizer)

## 📄 License

MIT License - see LICENSE file for details
