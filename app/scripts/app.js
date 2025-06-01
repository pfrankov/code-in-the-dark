import "../styles/index.css";

import _ from "underscore";
import $ from "jquery";

import ace from "ace-builds";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/theme-vibrant_ink";
import "ace-builds/src-noconflict/ext-searchbox";

class App {
  constructor() {
    // Power mode settings
    this.POWER_MODE_ACTIVATION_THRESHOLD = 200;
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
    this.EXCLAMATION_EVERY = 10;
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

    this.EXCLAMATIONS = ["Super!", "Radical!", "Fantastic!", "Great!", "OMG",
      "Whoah!", ":O", "Nice!", "Splendid!", "Wild!", "Grand!", "Impressive!",
      "Stupendous!", "Extreme!", "Awesome!"];

    // Storage keys
    this.STORAGE_KEYS = {
      name: "name",
      content: "content",
      reference: "reference"
    };

    this.currentStreak = 0;
    this.powerMode = false;
    this.particles = [];
    this.particlePointer = 0;
    this.lastDraw = 0;

    this.init();
  }

  init() {
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
    this.$body = $("body");
    this.$dragDropOverlay = $(".drag-drop-overlay");
    this.$referenceImage = $(".reference-screenshot");
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
    
    $(window).on("beforeunload", () => "Hold your horses!");
    
    // Отвязываем старые обработчики
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
    
    // Закрытие инструкций по клику на фон
    $(".instructions-container").on("click", (e) => {
      if (e.target === e.currentTarget) {
        this.onClickInstructions();
      }
    });
    
    // Закрытие инструкций и референса по Esc
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
    const name = (!forceUpdate && this.getFromStorage(this.STORAGE_KEYS.name)) || prompt("What's your name?");
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
      sessionStorage[key] = value;
    } catch (e) {
      console.warn('Failed to save to sessionStorage:', e);
    }
  }

  onUserInput(e) {
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
    
    if (this.currentStreak > 0 && this.currentStreak % this.EXCLAMATION_EVERY === 0) {
      this.showExclamation();
    }

    if (this.currentStreak >= this.POWER_MODE_ACTIVATION_THRESHOLD && !this.powerMode) {
      this.activatePowerMode();
    }

    this.refreshStreakBar();
    this.renderStreak();
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

    _.defer(() => {
      this.$streakCounter.addClass("bump");
    });
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

  showExclamation() {
    const $exclamation = $("<span>")
      .addClass("exclamation")
      .text(_.sample(this.EXCLAMATIONS));

    this.$exclamations.prepend($exclamation);
    setTimeout(() => $exclamation.remove(), this.EXCLAMATION_TIMEOUT);
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

  onClickInstructions() {
    this.$body.toggleClass("show-instructions");
    if (!this.$body.hasClass("show-instructions")) {
      this.editor.focus();
    }
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
    const confirm = prompt(`
      This will show the results of your code. Doing this before the round is over
      WILL DISQUALIFY YOU. Are you sure you want to proceed? Type "yes" to confirm.
    `);

    if (confirm?.toLowerCase() === "yes") {
      this.$result[0].contentWindow.postMessage(this.editor.getValue(), "*");
      this.$result.show();
    }
  }

  setupDragDrop() {
    this.dragCounter = 0; // Счётчик для отслеживания вложенных drag событий
    
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
    // Просто предотвращаем дефолтное поведение
    // Overlay уже показан через handleDragEnter
  }

  handleDrop(e) {
    this.dragCounter = 0; // Сбрасываем счётчик
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
      alert('Блять, это не картинка! Загружай только изображения.');
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
    this.$referenceImage.css('background-image', `url(${imageData})`);
    this.$reference.addClass('has-image');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
}); 