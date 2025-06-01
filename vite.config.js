import { defineConfig } from 'vite'
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

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
        // Сервим локали напрямую из app/locales в dev-режиме
        server.middlewares.use('/locales', (req, res, next) => {
          const url = req.url
          if (url && url.endsWith('.json')) {
            const fileName = url.substring(1) // убираем первый слеш
            
            // Если запрашивается languages.json, генерируем его на лету
            if (fileName === 'languages.json') {
              const localesDir = resolve('./app/locales')
              const languages = getAvailableLanguages(localesDir)
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ languages }))
              return
            }
            
            const localePath = resolve('./app/locales', fileName)
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
        // Автоматически копируем все локали в dist при билде
        const localesDir = resolve('./app/locales')
        // Копируем в корень dist, чтобы пути ./locales/ работали
        const outputDir = resolve('../dist/locales')
        
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true })
        }
        
        // Получаем список всех доступных языков
        const languages = getAvailableLanguages(localesDir)
        
        // Копируем все файлы локалей
        languages.forEach(lang => {
          const src = resolve('./app/locales', `${lang}.json`)
          const dest = resolve('../dist/locales', `${lang}.json`)
          if (existsSync(src)) {
            copyFileSync(src, dest)
            console.log(`Copied locale to dist: ${lang}.json`)
          }
        })
        
        // Генерируем файл со списком языков
        const languagesFile = resolve('../dist/locales', 'languages.json')
        writeFileSync(languagesFile, JSON.stringify({ languages }, null, 2))
        console.log(`Generated languages list: ${languages.join(', ')}`)
      }
    }
  ]
})

// Функция для получения списка доступных языков из папки
function getAvailableLanguages(localesDir) {
  if (!existsSync(localesDir)) {
    console.warn('Locales directory not found, using fallback languages')
    return ['en', 'ru']
  }
  
  try {
    const files = readdirSync(localesDir)
    const languages = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .sort()
    
    // Убеждаемся, что английский всегда первый (дефолтный)
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