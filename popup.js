// FontManager Class: Handles font size changes
class FontManager {
  constructor(noteElement, lineNumbersElement) {
    this.noteElement = noteElement;
    this.lineNumbersElement = lineNumbersElement;
    this.fontChangeInterval = null;
  }

  // Start increasing font size fluidly
  startIncrease() {
    this.fontChangeInterval = setInterval(() => {
      const currentSize = parseInt(window.getComputedStyle(this.noteElement).fontSize);
      const newSize = currentSize + 2;
      this.updateFontSize(newSize);
    }, 100); // Repeat every 100ms while holding the button
  }

  // Start decreasing font size fluidly
  startDecrease() {
    this.fontChangeInterval = setInterval(() => {
      const currentSize = parseInt(window.getComputedStyle(this.noteElement).fontSize);
      const newSize = Math.max(10, currentSize - 2); // Prevent going below 10px
      this.updateFontSize(newSize);
    }, 100); // Repeat every 100ms while holding the button
  }

  // Update the font size and sync it with line numbers
  updateFontSize(newSize) {
    this.noteElement.style.fontSize = `${newSize}px`;
    this.lineNumbersElement.style.fontSize = `${newSize}px`;
    StorageManager.saveToLocalStorage('fontSize', `${newSize}px`);
  }

  // Stop font size change when button is released
  stopFontChange() {
    clearInterval(this.fontChangeInterval);
  }
}

// KeyboardShortcutManager Class: Handles undo and redo functionality via keyboard shortcuts
class KeyboardShortcutManager {
  constructor(noteElement) {
    this.noteElement = noteElement;
    this.undoStack = [];
    this.redoStack = [];
  }

  // Save the current state to undo stack
  saveState() {
    this.undoStack.push(this.noteElement.innerText);
    if (this.undoStack.length > 50) {
      this.undoStack.shift(); // Keep the stack size manageable
    }
    this.redoStack = []; // Clear redo stack after a new action
  }

  // Undo the last action
  undo() {
    if (this.undoStack.length > 0) {
      const lastState = this.undoStack.pop();
      this.redoStack.push(this.noteElement.innerText);
      this.noteElement.innerText = lastState;
      StorageManager.saveToLocalStorage('savedNote', this.noteElement.innerText);
    }
  }

  // Redo the last undone action
  redo() {
    if (this.redoStack.length > 0) {
      const lastState = this.redoStack.pop();
      this.undoStack.push(this.noteElement.innerText);
      this.noteElement.innerText = lastState;
      StorageManager.saveToLocalStorage('savedNote', this.noteElement.innerText);
    }
  }

  // Handle keyboard shortcuts for undo and redo
  handleKeyboardShortcuts(event) {
    if (event.ctrlKey) {
      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        this.undo(); // Perform undo action
      } else if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        this.redo(); // Perform redo action
      }
    }
  }
}

// LintingManager Class: Handles various linting tasks like line numbers, highlighting, etc.
class LintingManager {
  constructor(noteElement, lineNumbersElement) {
    this.noteElement = noteElement;
    this.lineNumbersElement = lineNumbersElement;
  }

  // Update line numbers based on the note's content
  updateLineNumbers() {
    const lines = this.noteElement.innerText.split('\n').length;
    let lineNumberText = '';
    for (let i = 1; i <= lines; i++) {
      lineNumberText += i + '\n';
    }
    this.lineNumbersElement.innerText = lineNumberText;
  }

  // Sync scrolling between the note area and line numbers
  syncScrolling() {
    this.noteElement.addEventListener('scroll', () => {
      this.lineNumbersElement.scrollTop = this.noteElement.scrollTop;
    });
  }
}

// StorageManager Class: Handles localStorage operations
class StorageManager {
  // Save data to localStorage
  static saveToLocalStorage(key, value) {
    localStorage.setItem(key, value);
  }

  // Retrieve data from localStorage
  static getFromLocalStorage(key, defaultValue = '') {
    return localStorage.getItem(key) || defaultValue;
  }
}

// InputManager Class: Handles input, paste, and drop events
class InputManager {
  constructor(noteElement, keyboardShortcutManager, lintingManager) {
    this.noteElement = noteElement;
    this.keyboardShortcutManager = keyboardShortcutManager;
    this.lintingManager = lintingManager;
  }

  // Handle input events and save the state
  handleInput() {
    this.keyboardShortcutManager.saveState();
    StorageManager.saveToLocalStorage('savedNote', this.noteElement.innerText);
    this.lintingManager.updateLineNumbers();
  }

  // Handle paste events (only plain text should be pasted)
  handlePaste(event) {
    event.preventDefault(); // Prevent the default paste behavior
    const plainText = (event.clipboardData || window.clipboardData).getData('text');
    this.insertTextAtCaret(plainText);
    this.keyboardShortcutManager.saveState();
  }

  // Handle drop events (append plain text)
  handleDrop(event) {
    event.preventDefault();
    const plainText = event.dataTransfer.getData('text');
    this.insertTextAtCaret(plainText);
    this.keyboardShortcutManager.saveState();
  }

  // Insert text at the current caret position
  insertTextAtCaret(text) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    range.deleteContents(); // Remove any selected content
    range.insertNode(document.createTextNode(text)); // Insert new plain text
    StorageManager.saveToLocalStorage('savedNote', this.noteElement.innerText);
    this.lintingManager.updateLineNumbers();
  }
}

// NoteApp Class: Manages the note and integrates all other managers
class NoteApp {
  constructor(noteElementId, lineNumbersElementId, increaseFontBtnId, decreaseFontBtnId, downloadBtnId) {
    this.noteElement = document.getElementById(noteElementId);
    this.lineNumbersElement = document.getElementById(lineNumbersElementId);
    this.increaseFontBtn = document.getElementById(increaseFontBtnId);
    this.decreaseFontBtn = document.getElementById(decreaseFontBtnId);
    this.downloadBtn = document.getElementById(downloadBtnId);

    // Create instances of other managers
    this.fontManager = new FontManager(this.noteElement, this.lineNumbersElement);
    this.keyboardShortcutManager = new KeyboardShortcutManager(this.noteElement);
    this.lintingManager = new LintingManager(this.noteElement, this.lineNumbersElement);
    this.inputManager = new InputManager(this.noteElement, this.keyboardShortcutManager, this.lintingManager);

    // Bind event listeners
    this.bindEventListeners();

    // Load saved state when the page loads
    this.loadState();
  }

  // Load saved note and font size
  loadState() {
    this.noteElement.innerText = StorageManager.getFromLocalStorage('savedNote', '');
    const fontSize = StorageManager.getFromLocalStorage('fontSize', '16px');
    this.noteElement.style.fontSize = fontSize;
    this.lineNumbersElement.style.fontSize = fontSize;
    this.lintingManager.updateLineNumbers(); // Update line numbers when the page loads
  }

  // Bind event listeners for actions
  bindEventListeners() {
    const { noteElement, increaseFontBtn, decreaseFontBtn, downloadBtn } = this;

    // Note input actions
    noteElement.addEventListener('input', () => this.inputManager.handleInput());
    noteElement.addEventListener('paste', (event) => this.inputManager.handlePaste(event));
    noteElement.addEventListener('drop', (event) => this.inputManager.handleDrop(event));
    noteElement.addEventListener('scroll', () => {this.lintingManager.lineNumbersElement.scrollTop = noteElement.scrollTop;});
    

    // Font size controls with fluid behavior
    increaseFontBtn.addEventListener('mousedown', () => this.fontManager.startIncrease());
    decreaseFontBtn.addEventListener('mousedown', () => this.fontManager.startDecrease());
    increaseFontBtn.addEventListener('mouseup', this.fontManager.stopFontChange.bind(this.fontManager));
    decreaseFontBtn.addEventListener('mouseup', this.fontManager.stopFontChange.bind(this.fontManager));
    increaseFontBtn.addEventListener('mouseleave', this.fontManager.stopFontChange.bind(this.fontManager));
    decreaseFontBtn.addEventListener('mouseleave', this.fontManager.stopFontChange.bind(this.fontManager));

    // Keyboard shortcuts for undo (Ctrl+Z) and redo (Ctrl+Y)
    document.addEventListener('keydown', (event) => this.keyboardShortcutManager.handleKeyboardShortcuts(event));

    // Download button event
    downloadBtn.addEventListener('click', () => this.downloadNote());
  }

  // Function to download the note as a .txt file
  downloadNote() {
    const noteContent = this.noteElement.innerText;
    const blob = new Blob([noteContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'note.txt';
    a.click();
    URL.revokeObjectURL(a.href); // Cleanup
  }
}

// Initialize the app by creating an instance of the NoteApp class
document.addEventListener('DOMContentLoaded', () => {
  const noteApp = new NoteApp('note', 'lineNumbers', 'increaseFont', 'decreaseFont', 'downloadBtn');
});

