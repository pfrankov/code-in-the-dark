import "../styles/index.css";

import _ from "underscore";
import $ from "jquery";

import ace from "ace-builds";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/theme-vibrant_ink";
import "ace-builds/src-noconflict/ext-searchbox";

import I18n from "./i18n.js";

class App {
  constructor() {
    // Power mode settings
    this.POWER_MODE_ACTIVATION_THRESHOLD = 200;
    this.COMBO_ANIMATION_THRESHOLD = this.POWER_MODE_ACTIVATION_THRESHOLD / 10;
    this.STREAK_TIMEOUT = 10 * 1000;

    // Particle settings
    this.MAX_PARTICLES = 500;
    this.PARTICLE_NUM_RANGE = [5, 12];
    this.PARTICLE_GRAVITY = 0.075;
    this.PARTICLE_SIZE = 8;
    this.PARTICLE_ALPHA_FADEOUT = 0.96;
    this.PARTICLE_VELOCITY_RANGE = {
      x: [-2.5, 2.5],
      y: [-7, -3.5]
    };

    // UI settings
    this.EXCLAMATION_TIMEOUT = 3000;
    this.SHAKE_DURATION = 75;
    this.CURSOR_OFFSET = { x: 4, y: 10 };

    this.PARTICLE_COLORS = {
      "text": [255, 255, 255],
      "text.xml": [255, 255, 255],
      "keyword": [0, 221, 255],
      "variable": [0, 221, 255],
      "meta.tag.tag-name.xml": [0, 221, 255],
      "keyword.operator.attribute-equals.xml": [0, 221, 255],
      "constant": [249, 255, 0],
      "constant.numeric": [249, 255, 0],
      "support.constant": [249, 255, 0],
      "string.attribute-value.xml": [249, 255, 0],
      "string.unquoted.attribute-value.html": [249, 255, 0],
      "entity.other.attribute-name.xml": [129, 148, 244],
      "comment": [0, 255, 121],
      "comment.xml": [0, 255, 121]
    };

    // Storage keys
    this.STORAGE_KEYS = {
      name: "name",
      content: "content",
      reference: "reference",
      // New settings keys for localStorage (not sessionStorage)
      competitionMode: "citd_competition_mode",
      apiUrl: "citd_api_url", 
      apiModel: "citd_api_model",
      apiToken: "citd_api_token"
    };

    // Competition modes
    this.MODES = {
      CODE: 'code',
      AI: 'ai'
    };

    // Settings menu activation sequence
    this.keySequence = [];
    this.ACTIVATION_SEQUENCE = ['AltLeft', 'AltRight', 'Digit1'];
    this.SEQUENCE_TIMEOUT = 500; // 500ms для быстрой активации

    this.currentStreak = 0;
    this.powerMode = false;
    this.particles = [];
    this.particlePointer = 0;
    this.lastDraw = 0;
    this.i18n = new I18n();
    
    this.lastInputTime = 0;
    this.INPUT_DEBOUNCE_TIME = 50; // 50ms debounce protection against double input

    // Current competition mode
    this.currentMode = this.MODES.CODE;
    this.lastKeyTime = 0; // For settings menu activation sequence

    this.init();
  }

  async init() {
    await this.i18n.init();
    this.cacheElements();
    this.setupCanvas();
    this.setupThrottledMethods();
    this.setupEditor();
    this.loadContent();
    this.bindEvents();
    this.setupDragDrop();
    this.loadReference();
    this.getName();
    this.startAnimationLoop();
    this.setupSettingsMenu();
    this.loadSettings();
  }

  cacheElements() {
    this.$streakCounter = $(".streak-container .counter");
    this.$streakBar = $(".streak-container .bar");
    this.$exclamations = $(".streak-container .exclamations");
    this.$reference = $(".reference-screenshot-container");
    this.$nameTag = $(".name-tag");
    this.$result = $(".result");
    this.$editor = $("#editor");
    this.$finish = $(".finish-button");
    this.$aiLoader = $(".ai-loader");
    this.$body = $("body");
    this.$dragDropOverlay = $(".drag-drop-overlay");
    this.$referenceImage = $(".reference-screenshot");
    
    // New elements for settings menu
    this.$settingsOverlay = $(".settings-menu-overlay");
    this.$modeSelector = $(".mode-selector");
    this.$aiSettings = $(".ai-settings");
    this.$apiUrl = $(".api-url");
    this.$apiModel = $(".api-model");
    this.$apiToken = $(".api-token");
  }

  setupCanvas() {
    this.canvas = $(".canvas-overlay")[0];
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvasContext = this.canvas.getContext("2d");
  }

  setupThrottledMethods() {
    this.debouncedSaveContent = _.debounce(this.saveContent.bind(this), 300);
    this.debouncedEndStreak = _.debounce(this.endStreak.bind(this), this.STREAK_TIMEOUT);
    this.throttledShake = _.throttle(this.shake.bind(this), 100, { trailing: false });
    this.throttledSpawnParticles = _.throttle(this.spawnParticles.bind(this), 25, { trailing: false });
  }

  setupEditor() {
    this.editor = ace.edit("editor");
    this.editor.setShowPrintMargin(false);
    this.editor.setHighlightActiveLine(false);
    this.editor.setFontSize(20);
    this.editor.setTheme("ace/theme/vibrant_ink");
    this.editor.getSession().setMode("ace/mode/html");
    this.editor.session.setOption("useWorker", false);
    this.editor.session.setFoldStyle("manual");
    this.editor.$blockScrolling = Infinity;
    this.editor.focus();
  }

  startAnimationLoop() {
    requestAnimationFrame(this.onFrame.bind(this));
  }

  bindEvents() {
    this.editor.getSession().on("change", (e) => {
      if (this.isUserTyping(e)) {
        this.onUserInput(e);
      }
      this.debouncedSaveContent();
    });
    
    $(window).on("beforeunload", () => this.i18n.t('prompts.beforeUnload'));
    
    // Remove old event handlers
    $(".instructions-button").off("click");
    $(".instructions-container").off("click");
    this.$reference.off("click");
    this.$finish.off("click");
    this.$nameTag.off("click");
    $(document).off("keydown.instructions");
    
    $(".instructions-button").on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClickInstructions();
    });
    
    // Close instructions by clicking on background
    $(".instructions-container").on("click", (e) => {
      if (e.target === e.currentTarget) {
        this.onClickInstructions();
      }
    });
    
    // Close instructions and reference with Esc
    $(document).on("keydown.instructions", (e) => {
      if (e.key === "Escape") {
        if (this.$body.hasClass("show-instructions")) {
          this.onClickInstructions();
        }
        if (this.$reference.hasClass("active")) {
          this.onClickReference();
        }
      }
    });
    
    this.$reference.on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClickReference();
    });
    this.$finish.on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onClickFinish();
    });
    this.$nameTag.on("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.getName(true);
    });
  }

  isUserTyping(e) {
    return e.action === "insert" && 
           e.lines && 
           e.lines.length === 1 && 
           e.lines[0].length === 1;
  }

  getName(forceUpdate = false) {
    const name = (!forceUpdate && this.getFromStorage(this.STORAGE_KEYS.name)) || 
                 prompt(this.i18n.t('prompts.namePrompt'));
    if (name) {
      this.saveToStorage(this.STORAGE_KEYS.name, name);
      this.$nameTag.text(name);
    }
  }

  loadContent() {
    const content = this.getFromStorage(this.STORAGE_KEYS.content);
    if (!content) return;
    
    this.editor.getSession().off("change");
    this.editor.setValue(content, -1);
    this.bindEvents();
  }

  getFromStorage(key) {
    try {
      return sessionStorage[key];
    } catch (e) {
      console.warn('Failed to read from sessionStorage:', e);
      return null;
    }
  }

  saveToStorage(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (e) {
      console.warn("Failed to save to sessionStorage:", e);
    }
  }

  onUserInput(e) {
    // Prevent double scoring from rapid consecutive inputs
    const currentTime = Date.now();
    if (currentTime - this.lastInputTime < this.INPUT_DEBOUNCE_TIME) {
      return;
    }
    this.lastInputTime = currentTime;
    
    this.increaseStreak();
    this.debouncedEndStreak();
    this.throttledShake();

    const token = this.editor.session.getTokenAt(e.start.row, e.start.column);
    if (token) {
      this.throttledSpawnParticles(token.type);
    }
  }

  saveContent() {
    this.saveToStorage(this.STORAGE_KEYS.content, this.editor.getValue());
  }

  onFrame(time) {
    this.drawParticles(time - this.lastDraw);
    this.lastDraw = time;
    requestAnimationFrame(this.onFrame.bind(this));
  }

  increaseStreak() {
    this.currentStreak++;
    
    if (!this.powerMode && this.currentStreak < this.POWER_MODE_ACTIVATION_THRESHOLD) {
      this.checkAndShowExclamation();
    }

    if (this.currentStreak >= this.POWER_MODE_ACTIVATION_THRESHOLD && !this.powerMode) {
      this.activatePowerMode();
    }

    this.refreshStreakBar();
    this.renderStreak();
  }

  checkAndShowExclamation() {
    const exclamations = this.i18n.getArray('exclamations');
    if (exclamations.length === 0) {
      return;
    }
    
    const maxExclamations = exclamations.length;
    const interval = Math.floor(this.POWER_MODE_ACTIVATION_THRESHOLD / maxExclamations);
    
  
    if (this.currentStreak % interval === 0) {
      const exclamationNumber = Math.floor(this.currentStreak / interval) - 1;
      
      if (exclamationNumber >= 0 && exclamationNumber < maxExclamations) {
        this.showExclamationByIndex(exclamationNumber);
      }
    }
  }

  showExclamationByIndex(index) {
    const exclamations = this.i18n.getArray('exclamations');
    if (index < 0 || index >= exclamations.length) {
      return;
    }
    
    const exclamationText = exclamations[index];
    const $exclamation = $("<span>")
      .addClass("exclamation")
      .text(exclamationText);

    this.$exclamations.prepend($exclamation);
    setTimeout(() => $exclamation.remove(), this.EXCLAMATION_TIMEOUT);
  }

  endStreak() {
    this.currentStreak = 0;
    this.renderStreak();
    this.deactivatePowerMode();
  }

  renderStreak() {
    this.$streakCounter
      .text(this.currentStreak)
      .removeClass("bump");

    if (this.currentStreak >= this.COMBO_ANIMATION_THRESHOLD) {
      _.defer(() => {
        this.$streakCounter.addClass("bump");
      });
    }
  }

  refreshStreakBar() {
    this.$streakBar.css({
      "transform": "scaleX(1)",
      "transition": "none"
    });

    _.defer(() => {
      this.$streakBar.css({
        "transform": "",
        "transition": `all ${this.STREAK_TIMEOUT}ms linear`
      });
    });
  }

  getCursorPosition() {
    const { left, top } = this.editor.renderer.$cursorLayer.getPixelPosition();
    return {
      x: left + this.editor.renderer.gutterWidth + this.CURSOR_OFFSET.x,
      y: top - this.editor.renderer.scrollTop + this.CURSOR_OFFSET.y
    };
  }

  spawnParticles(type) {
    if (!this.powerMode) return;

    const { x, y } = this.getCursorPosition();
    const numParticles = this.getRandomInRange(this.PARTICLE_NUM_RANGE, true);
    const color = this.getParticleColor(type);
    
    for (let i = 0; i < numParticles; i++) {
      this.particles[this.particlePointer] = this.createParticle(x, y, color);
      this.particlePointer = (this.particlePointer + 1) % this.MAX_PARTICLES;
    }
  }

  getRandomInRange([min, max], isInteger = false) {
    const random = min + Math.random() * (max - min);
    return isInteger ? Math.floor(random + 1) : random;
  }

  getParticleColor(type) {
    return this.PARTICLE_COLORS[type] || [255, 255, 255];
  }

  createParticle(x, y, color) {
    return {
      x,
      y,
      alpha: 1,
      color,
      velocity: {
        x: this.getRandomInRange(this.PARTICLE_VELOCITY_RANGE.x),
        y: this.getRandomInRange(this.PARTICLE_VELOCITY_RANGE.y)
      }
    };
  }

  drawParticles(timeDelta) {
    this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const particle of this.particles) {
      if (particle.alpha <= 0.1) continue;

      this.updateParticle(particle);
      this.renderParticle(particle);
    }
  }

  updateParticle(particle) {
    particle.velocity.y += this.PARTICLE_GRAVITY;
    particle.x += particle.velocity.x;
    particle.y += particle.velocity.y;
    particle.alpha *= this.PARTICLE_ALPHA_FADEOUT;
  }

  renderParticle(particle) {
    this.canvasContext.fillStyle = `rgba(${particle.color.join(", ")}, ${particle.alpha})`;
    this.canvasContext.fillRect(
      Math.round(particle.x - this.PARTICLE_SIZE / 2),
      Math.round(particle.y - this.PARTICLE_SIZE / 2),
      this.PARTICLE_SIZE,
      this.PARTICLE_SIZE
    );
  }

  shake() {
    if (!this.powerMode) return;

    const intensity = 1 + 2 * Math.random() * Math.floor(
      (this.currentStreak - this.POWER_MODE_ACTIVATION_THRESHOLD) / 100
    );
    const x = intensity * (Math.random() > 0.5 ? -1 : 1);
    const y = intensity * (Math.random() > 0.5 ? -1 : 1);

    this.$editor.css("margin", `${y}px ${x}px`);
    setTimeout(() => this.$editor.css("margin", ""), this.SHAKE_DURATION);
  }

  activatePowerMode() {
    this.powerMode = true;
    this.$body.addClass("power-mode");
  }

  deactivatePowerMode() {
    this.powerMode = false;
    this.$body.removeClass("power-mode");
  }

  onClickReference() {
    // Only allow clicking if there's an image
    if (!this.$reference.hasClass('has-image')) {
      return;
    }
    
    this.$reference.toggleClass("active");
    if (!this.$reference.hasClass("active")) {
      this.editor.focus();
    }
  }

  onClickFinish() {
    const confirm = prompt(this.i18n.t('prompts.finishConfirm'));

    if (confirm) {
      const confirmWord = this.i18n.t('prompts.confirmWord');
      const userInput = confirm.toLowerCase().trim();
      
      if (userInput === confirmWord.toLowerCase()) {
        // Get reference image data
        const referenceData = this.getFromStorage(this.STORAGE_KEYS.reference);
        
        if (this.currentMode === this.MODES.AI) {
          // AI mode - generate from prompt
          this.generateWithAI(referenceData);
        } else {
          // Traditional code mode
          const content = this.editor.getValue();
          this.showResult(content, referenceData);
        }
      }
    }
  }

  setupDragDrop() {
    this.dragCounter = 0; // Counter for tracking nested drag events
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, this.preventDefaults.bind(this), false);
    });

    // Highlight drop area when item is dragged over it
    document.addEventListener('dragenter', this.handleDragEnter.bind(this), false);
    document.addEventListener('dragleave', this.handleDragLeave.bind(this), false);
    document.addEventListener('dragover', this.handleDragOver.bind(this), false);

    // Handle dropped files
    document.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  loadReference() {
    const referenceData = this.getFromStorage(this.STORAGE_KEYS.reference);
    if (referenceData) {
      this.setReferenceImage(referenceData);
    }
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleDragEnter(e) {
    this.dragCounter++;
    if (this.dragCounter === 1) {
      this.$dragDropOverlay.addClass('active');
    }
  }

  handleDragLeave(e) {
    this.dragCounter--;
    if (this.dragCounter === 0) {
      this.$dragDropOverlay.removeClass('active');
    }
  }

  handleDragOver(e) {
    // Just prevent default behavior
    // Overlay is already shown through handleDragEnter
  }

  handleDrop(e) {
    this.dragCounter = 0; // Reset counter
    this.$dragDropOverlay.removeClass('active');
    
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      this.handleFiles(files);
    }
  }
  
  handleFiles(files) {
    const file = files[0];
    
    if (!file.type.startsWith('image/')) {
      alert(this.i18n.t('prompts.notAnImage'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target.result;
      this.setReferenceImage(imageData);
      this.saveToStorage(this.STORAGE_KEYS.reference, imageData);
    };
    reader.readAsDataURL(file);
  }

  setReferenceImage(imageData) {
    // Clear any existing content
    this.$referenceImage.empty();
    
    // Create img element for proper aspect ratio handling
    const $img = $('<img>').attr('src', imageData);
    
    this.$referenceImage.append($img);
    this.$reference.addClass('has-image');
  }

  // New methods for localStorage (persistent settings)
  getFromLocalStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("Failed to read from localStorage:", e);
      return null;
    }
  }

  saveToLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }
  }

  // Settings management
  loadSettings() {
    const mode = this.getFromStorage(this.STORAGE_KEYS.competitionMode) || this.MODES.CODE;
    const apiUrl = this.getFromLocalStorage(this.STORAGE_KEYS.apiUrl) || 'https://api.openai.com/v1';
    const apiModel = this.getFromLocalStorage(this.STORAGE_KEYS.apiModel) || 'gpt-3.5-turbo';
    const apiToken = this.getFromLocalStorage(this.STORAGE_KEYS.apiToken) || '';

    this.currentMode = mode;
    this.$modeSelector.val(mode);
    this.$apiUrl.val(apiUrl);
    this.$apiModel.val(apiModel);
    this.$apiToken.val(apiToken);

    this.updateModeInterface();
  }

  saveSettings() {
    const mode = this.$modeSelector.val();
    const apiUrl = this.$apiUrl.val();
    const apiModel = this.$apiModel.val();
    const apiToken = this.$apiToken.val();

    this.saveToStorage(this.STORAGE_KEYS.competitionMode, mode);
    this.saveToLocalStorage(this.STORAGE_KEYS.apiUrl, apiUrl);
    this.saveToLocalStorage(this.STORAGE_KEYS.apiModel, apiModel);
    this.saveToLocalStorage(this.STORAGE_KEYS.apiToken, apiToken);

    this.currentMode = mode;
    this.updateModeInterface();
  }

  updateModeInterface() {
    // Show/hide AI settings based on mode
    if (this.$modeSelector.val() === this.MODES.AI) {
      this.$aiSettings.show();
    } else {
      this.$aiSettings.hide();
    }
  }

  // Settings menu setup
  setupSettingsMenu() {
    // Listen for key sequence to activate settings
    $(document).on('keydown', (e) => {
      this.handleKeySequence(e);
      
      // Close settings with Esc
      if (e.key === "Escape" && this.$settingsOverlay.hasClass('active')) {
        this.hideSettingsMenu();
      }
    });

    // Auto-save settings on change
    this.$modeSelector.on('change', () => {
      this.saveSettings();
    });

    this.$apiUrl.on('input', () => {
      this.saveSettings();
    });

    this.$apiModel.on('input', () => {
      this.saveSettings();
    });

    this.$apiToken.on('input', () => {
      this.saveSettings();
    });

    // Close settings on overlay click
    this.$settingsOverlay.on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hideSettingsMenu();
      }
    });
  }

  handleKeySequence(e) {
    const key = e.code;
    const now = Date.now();

    // Reset sequence if too much time has passed
    if (this.keySequence.length > 0 && now - this.lastKeyTime > this.SEQUENCE_TIMEOUT) {
      this.keySequence = [];
    }

    this.lastKeyTime = now;

    // Add key to sequence if it's part of the activation sequence
    if (this.ACTIVATION_SEQUENCE.includes(key)) {
      this.keySequence.push(key);

      // Check if sequence is complete
      if (this.keySequence.length === this.ACTIVATION_SEQUENCE.length) {
        const isCorrectSequence = this.keySequence.every((k, i) => k === this.ACTIVATION_SEQUENCE[i]);
        
        if (isCorrectSequence) {
          this.showSettingsMenu();
        }
        
        this.keySequence = []; // Reset sequence
      }
    } else {
      // Reset sequence if wrong key is pressed
      this.keySequence = [];
    }
  }

  showSettingsMenu() {
    this.$settingsOverlay.addClass('active');
    this.loadSettings(); // Refresh current settings
  }

  hideSettingsMenu() {
    this.$settingsOverlay.removeClass('active');
  }

  // Extract HTML from LLM response (handles markdown, code blocks, etc.)
  extractHTMLFromResponse(response) {
    if (!response || typeof response !== 'string') {
      return '';
    }

    let html = response.trim();

    // Remove markdown code blocks (```html ... ``` or ``` ... ```)
    html = html.replace(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/gm, '$1');
    
    // Remove single backticks around HTML
    html = html.replace(/^`([\s\S]*?)`$/gm, '$1');
    
    // Remove explanatory text before HTML (common patterns)
    html = html.replace(/^.*?(?=<!DOCTYPE|<html|<head|<body|<div|<main|<section)/s, '');
    
    // If no HTML tags found, wrap in basic HTML structure
    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      // Check if it looks like body content
      if (html.includes('<') && (html.includes('<div') || html.includes('<p') || html.includes('<h') || html.includes('<span'))) {
        html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Page</title>
</head>
<body>
${html}
</body>
</html>`;
      }
    }
    
    return html.trim();
  }

  async generateWithAI(referenceData) {
    const prompt = this.editor.getValue().trim();
    
    if (!prompt) {
      alert('Please enter a prompt in the editor first!');
      return;
    }

    const baseApiUrl = this.$apiUrl.val();
    const apiModel = this.$apiModel.val();
    const apiToken = this.$apiToken.val();

    if (!baseApiUrl || !apiModel || !apiToken) {
      alert('Please configure API URL, model and token in settings first!\nUse: Left Alt → Right Alt → 1');
      return;
    }

    // Construct full API URL by adding /chat/completions to base URL
    const apiUrl = baseApiUrl.replace(/\/$/, '') + '/chat/completions';

    // Show loading state
    this.$aiLoader.addClass('active');

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          model: apiModel,
          messages: [
            {
              role: 'system',
              content: `
                You are a web developer.
                Generate complete HTML code based on the user prompt.
                Return ONLY the HTML code, no explanations or markdown formatting.
                The HTML should be a complete ONE webpage with inline CSS styles and inline JS if needed.
              `.replace(/\t/g, '').trim()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const generatedHTML = data.choices[0].message.content;

      // Extract HTML from LLM response (handles markdown, code blocks, etc.)
      const extractedHTML = this.extractHTMLFromResponse(generatedHTML);

      // Set the generated HTML to the result iframe
      this.showResult(extractedHTML, referenceData);

    } catch (error) {
      console.error('AI generation failed:', error);
      alert(`Failed to generate with AI: ${error.message}`);
    } finally {
      this.$aiLoader.removeClass('active');
    }
  }

  showResult(content, referenceData) {
    // Send both content and reference to the result iframe
    const messageData = {
      type: 'content',
      html: content,
      reference: referenceData
    };
    
    this.$result[0].contentWindow.postMessage(messageData, "*");
    this.$result.show();
    this.$body.addClass('result-page')
  }
}


document.addEventListener('DOMContentLoaded', () => {
  new App();
}); 