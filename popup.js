// FontManager Class: Handles font size changes
class FontManager {
  constructor(noteElement, lineNumbersElement) {
    this.noteElement = noteElement;
    this.lineNumbersElement = lineNumbersElement;
    this.fontChangeInterval = null;

    // Load saved font size directly from localStorage (no StorageManager needed)
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
      this.noteElement.style.fontSize = savedFontSize;
      this.lineNumbersElement.style.fontSize = savedFontSize;
    }
  }

  adjustFontSize(change) {
  const currentSize = parseInt(window.getComputedStyle(this.noteElement).fontSize);
  const newSize = Math.max(10, currentSize + change);
  this.updateFontSize(newSize);
  }
  
  startIncrease() {
    this.fontChangeInterval = setInterval(() => {
      const currentSize = parseInt(window.getComputedStyle(this.noteElement).fontSize);
      const newSize = currentSize + 2;
      this.updateFontSize(newSize);
    }, 100);
  }

  startDecrease() {
    this.fontChangeInterval = setInterval(() => {
      const currentSize = parseInt(window.getComputedStyle(this.noteElement).fontSize);
      const newSize = Math.max(10, currentSize - 2);
      this.updateFontSize(newSize);
    }, 100);
  }

  updateFontSize(newSize) {
    this.noteElement.style.fontSize = `${newSize}px`;
    this.lineNumbersElement.style.fontSize = `${newSize}px`;
    localStorage.setItem('fontSize', `${newSize}px`);  // Save font size directly
  }

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

class TabManager {
  constructor(noteElement, lineNumberElement) {
    this.noteElement = noteElement;
    this.lineNumberElement = lineNumberElement;
    this.tabs = [];
    this.currentTabIndex = -1;

    this.tabContainer = document.getElementById('tabContainer');
    this.addTabBtn = document.getElementById('addTabBtn');

    this.addTabBtn.addEventListener('click', () => this.createNewTab());
    this.noteElement.addEventListener('input', () => this.saveCurrentTabContent());
    this.noteElement.addEventListener('scroll', () => this.syncScroll());

    // Load saved tabs and selected tab index
    const savedTabs = StorageManager.getFromLocalStorage('tabs', null);
    const savedTabIndex = StorageManager.getFromLocalStorage('currentTabIndex', -1);

    if (savedTabs) {
      this.tabs = JSON.parse(savedTabs);
      this.renderTabs();
      const index = parseInt(savedTabIndex);
      if (index >= 0 && index < this.tabs.length) {
        this.switchTab(index);
      } else {
        this.switchTab(0);
      }
    } else {
      this.createNewTab();
    }
  }

  createNewTab() {
    this.saveCurrentTabContent();

    const tabId = `tab-${Date.now()}`;
    const tab = {
      id: tabId,
      title: `Note ${this.tabs.length + 1}`,
      content: '',
    };
    this.tabs.push(tab);
    this.renderTabs();
    this.switchTab(this.tabs.length - 1);
    this.saveTabsToStorage();
  }

  switchTab(index) {
    if (this.currentTabIndex === index) return;

    this.saveCurrentTabContent();
    this.currentTabIndex = index;

    // Set new content
    this.noteElement.textContent = this.tabs[index].content;

    // Restore focus to the editable div
    this.noteElement.focus();

    // Optional: place cursor at end
    const range = document.createRange();
    range.selectNodeContents(this.noteElement);
    range.collapse(false); // false = cursor at end
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    this.updateLineNumbers();
    this.highlightActiveTab();
    this.saveTabsToStorage();
  }


  saveCurrentTabContent() {
    if (this.currentTabIndex !== -1) {
      this.tabs[this.currentTabIndex].content = this.noteElement.innerText;
      this.saveTabsToStorage();
    }
  }

  closeTab(index) {
    if (this.tabs.length <= 1) return;

    this.tabs.splice(index, 1);

    // Adjust the currentTabIndex
    if (this.currentTabIndex >= this.tabs.length) {
      this.currentTabIndex = this.tabs.length - 1;
    } else if (index < this.currentTabIndex) {
      this.currentTabIndex -= 1;
    }

    this.renderTabs();
    this.noteElement.innerText = this.tabs[this.currentTabIndex].content || '';
    this.updateLineNumbers();
    this.highlightActiveTab();
    this.saveTabsToStorage();
  }


    renderTabs() {
    this.tabContainer.innerHTML = '';
    this.tabs.forEach((tab, index) => {
      const tabElement = document.createElement('div');
      tabElement.classList.add('tab');

      const titleSpan = document.createElement('span');
      titleSpan.textContent = tab.title;
      titleSpan.classList.add('tab-title');

      // Enable editing on double click
      titleSpan.ondblclick = (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = tab.title;
        input.className = 'edit-title';

        // Replace span with input
        tabElement.replaceChild(input, titleSpan);
        input.focus();

        // Save on blur or enter
        const save = () => {
          tab.title = input.value.trim() || 'Untitled';
          this.saveTabsToStorage();
          this.renderTabs();
        };

        input.onblur = save;
        input.onkeydown = (e) => {
          if (e.key === 'Enter') input.blur();
        };
      };

      const closeBtn = document.createElement('span');
      closeBtn.textContent = '×';
      closeBtn.classList.add('close-btn');
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.closeTab(index);
      };

      tabElement.appendChild(titleSpan);
      tabElement.appendChild(closeBtn);
      tabElement.addEventListener('click', () => this.switchTab(index));
      this.tabContainer.appendChild(tabElement);
    });
    this.highlightActiveTab();
  }


  highlightActiveTab() {
    const tabElements = this.tabContainer.querySelectorAll('.tab');
    tabElements.forEach((tab, index) => {
      tab.classList.toggle('active', index === this.currentTabIndex);
    });
  }

  updateLineNumbers() {
    const lines = this.noteElement.innerText.split('\n').length;
    this.lineNumberElement.innerText = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  }

  syncScroll() {
    this.lineNumberElement.scrollTop = this.noteElement.scrollTop;
  }

  saveTabsToStorage() {
    StorageManager.saveToLocalStorage('tabs', JSON.stringify(this.tabs));
    StorageManager.saveToLocalStorage('currentTabIndex', this.currentTabIndex);
  }
}

class DarkModeManager {
    constructor(toggleSelector) {
        this.toggle = document.querySelector(toggleSelector);

        // Load saved preference
        if (localStorage.getItem("darkMode") === "enabled") {
            document.body.classList.add("dark-mode");
            this.toggle.checked = true;
        }

        this.toggle.addEventListener("change", () => this.toggleDarkMode());
    }

    toggleDarkMode() {
        if (this.toggle.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("darkMode", "enabled");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("darkMode", "disabled");
        }
    }
}

class AiTabs {
  constructor(tabSelector, contentSelector) {
    this.tabElements = document.querySelectorAll(tabSelector);
    this.contentElements = document.querySelectorAll(contentSelector);
    this.bindEvents();
  }

  bindEvents() {
    this.tabElements.forEach(button => {
      button.addEventListener("click", () => {
        this.switchTab(button);
      });
    });
  }

  switchTab(button) {
    // Remove active class from all tabs
    this.tabElements.forEach(tab => tab.classList.remove("active"));
    // Hide all tab contents
    this.contentElements.forEach(content => content.style.display = "none");

    // Activate the clicked tab
    button.classList.add("active");
    // Show the related content
    document.getElementById(button.dataset.tab).style.display = "block";
  }
}

class NoteApp {
    constructor() {
        this.note = document.getElementById('note');
        this.lineNumbers = document.getElementById('lineNumbers');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.printBtn = document.getElementById('printBtn');
        this.increaseFont = document.getElementById('increaseFont');
        this.decreaseFont = document.getElementById('decreaseFont');

        // Managers
        this.darkModeManager = new DarkModeManager("#darkModeToggle"); // ✅ NEW
        this.keyboardManager = new KeyboardShortcutManager(this.note);
        this.lintingManager = new LintingManager(this.note, this.lineNumbers);
        this.inputManager = new InputManager(this.note, this.keyboardManager, this.lintingManager);
        this.fontManager = new FontManager(this.note, this.lineNumbers);
        this.tabManager = new TabManager(this.note, this.lineNumbers);

        this.bindEvents();
    }

    bindEvents() {
        this.note.addEventListener('input', () => this.inputManager.handleInput());
        this.note.addEventListener('paste', (e) => this.inputManager.handlePaste(e));
        this.note.addEventListener('drop', (e) => this.inputManager.handleDrop(e));
        this.note.addEventListener('keydown', (e) => this.keyboardManager.handleKeyboardShortcuts(e));

        this.downloadBtn.addEventListener('click', () => this.download());
        this.printBtn.addEventListener('click', () => {
            const noteContent = this.note.innerText;

            const printWindow = window.open('', '_blank');
            const body = printWindow.document.body;

            const pre = printWindow.document.createElement('pre');
            pre.textContent = noteContent;

            body.appendChild(pre);

            printWindow.focus();
            printWindow.print();
            printWindow.close();
        });
        this.increaseFont.addEventListener('click', () => this.fontManager.adjustFontSize(2));
        this.decreaseFont.addEventListener('click', () => this.fontManager.adjustFontSize(-2));
        this.increaseFont.addEventListener('mousedown', () => this.fontManager.startIncrease());
        this.decreaseFont.addEventListener('mousedown', () => this.fontManager.startDecrease());
        document.addEventListener('mouseup', () => this.fontManager.stopFontChange());

        this.lintingManager.syncScrolling();
    }

    download() {
        const text = this.note.innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `note-${new Date().toISOString()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new NoteApp();
    new AiTabs(".rightTab", ".rightTabContent");
});



