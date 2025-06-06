import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

export default defineConfig({
  base: './',
  root: 'app',
  server: {
    port: 9000,
    open: true
  },
  build: {
    outDir: '../dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['jquery', 'underscore', 'ace-builds']
        }
      }
    }
  },
  publicDir: 'assets',
  optimizeDeps: {
    include: ['ace-builds']
  },
  plugins: [
    {
      name: 'serve-locales-dev',
      configureServer(server) {
        // Serve locale files directly from app/locales in development mode
        server.middlewares.use('/locales', (req, res, next) => {
          const url = req.url
          if (url && url.endsWith('.json')) {
            const fileName = url.substring(1) // Remove leading slash
            
            // Generate languages.json on-the-fly when requested
            if (fileName === 'languages.json') {
              const localesDir = resolve(process.cwd(), 'app', 'locales')
              const languages = getAvailableLanguages(localesDir)
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ languages }))
              return
            }
            
            const localePath = resolve(process.cwd(), 'app', 'locales', fileName)
            if (existsSync(localePath)) {
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              const content = readFileSync(localePath, 'utf-8')
              res.end(content)
              return
            }
          }
          next()
        })
      }
    },
    {
      name: 'copy-locales-to-dist',
      writeBundle() {
        try {
          console.log('Starting locale copy process...')
          console.log('Current working directory:', process.cwd())
          
          // Use absolute paths from project root
          const projectRoot = process.cwd()
          const localesDir = join(projectRoot, 'app', 'locales')
          const outputDir = join(projectRoot, 'dist', 'locales')
          
          console.log('Source locales directory:', localesDir)
          console.log('Target output directory:', outputDir)
          console.log('Locales directory exists:', existsSync(localesDir))
          
          if (!existsSync(outputDir)) {
            console.log('Creating output directory...')
            mkdirSync(outputDir, { recursive: true })
          }
          
          // Get list of all available languages
          const languages = getAvailableLanguages(localesDir)
          console.log('Available languages:', languages)
          
          // Copy all locale files to distribution directory
          languages.forEach(lang => {
            const src = join(localesDir, `${lang}.json`)
            const dest = join(outputDir, `${lang}.json`)
            console.log(`Copying ${src} -> ${dest}`)
            
            if (existsSync(src)) {
              copyFileSync(src, dest)
              console.log(`✓ Copied locale: ${lang}.json`)
            } else {
              console.warn(`✗ Source file not found: ${src}`)
            }
          })
          
          // Generate languages list file for runtime consumption
          const languagesFile = join(outputDir, 'languages.json')
          const languagesData = JSON.stringify({ languages }, null, 2)
          writeFileSync(languagesFile, languagesData)
          console.log(`✓ Generated languages list: ${languages.join(', ')}`)
          console.log('Locale copy process completed successfully!')
          
        } catch (error) {
          console.error('Error during locale copy process:', error)
          throw error
        }
      }
    }
  ]
})

// Helper function to scan locales directory and return available language codes
function getAvailableLanguages(localesDir) {
  console.log('Getting available languages from:', localesDir)
  
  if (!existsSync(localesDir)) {
    console.warn('Locales directory not found, using fallback languages')
    return ['en', 'ru']
  }
  
  try {
    const files = readdirSync(localesDir)
    console.log('Files in locales directory:', files)
    
    const languages = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .sort()
    
    console.log('Detected languages:', languages)
    
    // Ensure English is always first (default language)
    if (languages.includes('en')) {
      languages.splice(languages.indexOf('en'), 1)
      languages.unshift('en')
    }
    
    return languages.length > 0 ? languages : ['en']
  } catch (error) {
    console.warn('Error reading locales directory:', error)
    return ['en', 'ru']
  }
} 