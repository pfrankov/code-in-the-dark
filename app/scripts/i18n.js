class I18n {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.supportedLanguages = []; // Будет заполнен автоматически
  }

  async init() {
    await this.loadSupportedLanguages();
    this.detectLanguage();
    await this.loadTranslations();
    this.applyTranslations();
  }

  async loadSupportedLanguages() {
    try {
      // Пытаемся загрузить список языков из сгенерированного файла
      const response = await fetch('./locales/languages.json');
      if (response.ok) {
        const data = await response.json();
        this.supportedLanguages = data.languages || ['en'];
      } else {
        // Fallback к дефолтным языкам
        this.supportedLanguages = ['en', 'ru'];
      }
    } catch (error) {
      console.warn('Failed to load supported languages, using fallback:', error);
      this.supportedLanguages = ['en', 'ru'];
    }
  }

  detectLanguage() {
    // Check URL parameter first
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    
    if (langParam && this.supportedLanguages.includes(langParam)) {
      this.currentLanguage = langParam;
      return;
    }

    // Check browser language
    const browserLang = navigator.language.split('-')[0];
    if (this.supportedLanguages.includes(browserLang)) {
      this.currentLanguage = browserLang;
    }
  }

  async loadTranslations() {
    try {
      const response = await fetch(`./locales/${this.currentLanguage}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translations for ${this.currentLanguage}`);
      }
      this.translations = await response.json();
    } catch (error) {
      console.warn('Failed to load translations, falling back to English:', error);
      if (this.currentLanguage !== 'en') {
        this.currentLanguage = 'en';
        const response = await fetch('./locales/en.json');
        this.translations = await response.json();
      }
    }
  }

  applyTranslations() {
    // Update UI elements with data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.getTranslation(key);
      if (translation) {
        element.textContent = translation;
      }
    });

    // Update HTML lang attribute
    document.documentElement.lang = this.currentLanguage;

    // Update title if needed
    const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
    if (titleKey) {
      const titleTranslation = this.getTranslation(titleKey);
      if (titleTranslation) {
        document.title = titleTranslation;
      }
    }
  }

  getTranslation(key) {
    const keys = key.split('.');
    let value = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }
    
    return value;
  }

  // Get translated text programmatically
  t(key) {
    return this.getTranslation(key) || key;
  }

  // Get array of translations (for exclamations, etc.)
  getArray(key) {
    const result = this.getTranslation(key);
    return Array.isArray(result) ? result : [];
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }
}

export default I18n; 