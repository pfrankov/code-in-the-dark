# Code in the Dark - AI Edition

A multilingual code editor for "Code in the Dark" competitions with AI-powered features.  
https://pfrankov.github.io/code-in-the-dark/

## Features and differences from the original editor
- **Multilingual Support**: Automatically detects and supports any language files in the locales folder
- **Drag & Drop**: Reference image support

## Language Support
### Automatic Detection
The application automatically detects the user's language based on:
1. URL parameter `?lang=en`, `?lang=ru`, etc.
2. Browser language settings (fallback)

### Supported Languages
The application automatically supports any language for which a JSON file exists in the `app/locales/` directory.

Currently included:
- **English** (`en`)
- **Russian** (`ru`)

### Usage Examples
```
# Current local language
http://localhost:9000/

# Russian via URL parameter
http://localhost:9000/?lang=ru

# Force English
http://localhost:9000/?lang=en
```

## Development

### Prerequisites
- Node.js 16+
- npm

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

### Adding New Languages
Simply create a new locale file in `app/locales/` following the naming convention `{language_code}.json`:

## Credits
- [Code in the Dark Editor](https://github.com/codeinthedark/editor)


## License
MIT License - see LICENSE file for details.
