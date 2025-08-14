// FontManager Class: Handles font size changes
class FontManager {
  constructor(noteElement, lineNumbersElement) {
    this.noteElement = noteElement;
    this.lineNumbersElement = lineNumbersElement;
    this.fontChangeInterval = null;

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
    localStorage.setItem('fontSize', `${newSize}px`);
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

  saveState() {
    this.undoStack.push(this.noteElement.innerText);
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length > 0) {
      const lastState = this.undoStack.pop();
      this.redoStack.push(this.noteElement.innerText);
      this.noteElement.innerText = lastState;
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      const lastState = this.redoStack.pop();
      this.undoStack.push(this.noteElement.innerText);
      this.noteElement.innerText = lastState;
    }
  }

  handleKeyboardShortcuts(event) {
    if (event.ctrlKey) {
      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        this.undo();
      } else if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        this.redo();
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

  updateLineNumbers() {
    const lines = this.noteElement.innerText.split('\n').length;
    let lineNumberText = '';
    for (let i = 1; i <= lines; i++) {
      lineNumberText += i + '\n';
    }
    this.lineNumbersElement.innerText = lineNumberText;
  }

  syncScrolling() {
    this.noteElement.addEventListener('scroll', () => {
      this.lineNumbersElement.scrollTop = this.noteElement.scrollTop;
    });
  }
}

// StorageManager Class: Handles localStorage operations
class StorageManager {
  static saveToLocalStorage(key, value) {
    localStorage.setItem(key, value);
  }

  static getFromLocalStorage(key, defaultValue = '') {
    return localStorage.getItem(key) || defaultValue;
  }
  
  static removeFromLocalStorage(key) {
      localStorage.removeItem(key);
  }
}

class TabManager {
    constructor(noteElement, lineNumberElement, sectionManager) {
        this.noteElement = noteElement;
        this.lineNumberElement = lineNumberElement;
        this.sectionManager = sectionManager;
        this.tabs = [];
        this.currentTabIndex = -1;

        this.tabContainer = document.getElementById('tabContainer');
        this.addTabBtn = document.getElementById('addTabBtn');

        this.addTabBtn.addEventListener('click', () => this.createNewTab());
        this.noteElement.addEventListener('scroll', () => this.syncScroll());

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
        if (this.currentTabIndex !== -1) {
            this.saveCurrentTabContent();
        }

        const tabId = `note-${Date.now()}`;
        const tab = {
            id: tabId,
            title: `Note ${this.tabs.length + 1}`,
            content: '',
        };
        this.tabs.push(tab);
        this.renderTabs();
        this.switchTab(this.tabs.length - 1);
    }

    switchTab(index) {
        if (this.currentTabIndex === index) return;

        this.saveCurrentTabContent();

        this.currentTabIndex = index;
        const currentTab = this.tabs[this.currentTabIndex];
        this.noteElement.innerText = StorageManager.getFromLocalStorage(currentTab.id, '');
        
        this.sectionManager.setNoteId(currentTab.id);

        this.updateLineNumbers();
        this.highlightActiveTab();
        this.saveTabsToStorage();
        this.placeCursorAtEnd(this.noteElement);
    }
    
    saveCurrentTabContent() {
        if (this.currentTabIndex === -1) return;
        const currentTab = this.tabs[this.currentTabIndex];
        StorageManager.saveToLocalStorage(currentTab.id, this.noteElement.innerText);
    }

    closeTab(index) {
        if (this.tabs.length <= 1) return;
        
        const tabToClose = this.tabs[index];

        if (index === this.currentTabIndex) {
            this.saveCurrentTabContent();
            this.sectionManager.clearContent(tabToClose.id);
        }

        this.tabs.splice(index, 1);
        
        StorageManager.removeFromLocalStorage(tabToClose.id);
        ['summary', 'translation', 'grammar', 'rewriting'].forEach(section => {
            const key = `${tabToClose.id}-${section}`;
            StorageManager.removeFromLocalStorage(key);
        });

        if (this.currentTabIndex >= this.tabs.length) {
            this.currentTabIndex = this.tabs.length - 1;
        } else if (index < this.currentTabIndex) {
            this.currentTabIndex -= 1;
        }

        this.renderTabs();
        this.switchTab(this.currentTabIndex);
    }

    renderTabs() {
        this.tabContainer.innerHTML = '';
        this.tabs.forEach((tab, index) => {
            const tabElement = document.createElement('div');
            tabElement.classList.add('tab');

            const titleSpan = document.createElement('span');
            titleSpan.textContent = tab.title;
            titleSpan.classList.add('tab-title');

            titleSpan.ondblclick = (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = tab.title;
                input.className = 'edit-title';

                tabElement.replaceChild(input, titleSpan);
                input.focus();

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

    placeCursorAtEnd(element) {
        element.focus();
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    saveTabsToStorage() {
        StorageManager.saveToLocalStorage('tabs', JSON.stringify(this.tabs));
        StorageManager.saveToLocalStorage('currentTabIndex', this.currentTabIndex);
    }
}

class DarkModeManager {
    constructor(toggleSelector) {
        this.toggle = document.querySelector(toggleSelector);
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
    constructor(tabSelector, contentSelector, sectionManager) {
        this.tabElements = document.querySelectorAll(tabSelector);
        this.contentElements = document.querySelectorAll(contentSelector);
        this.sectionManager = sectionManager;
        this.bindEvents();
        this.switchTab(document.querySelector('.rightTab.active'));
    }

    bindEvents() {
        this.tabElements.forEach(button => {
            button.addEventListener("click", () => {
                this.switchTab(button);
            });
        });
    }

    switchTab(button) {
        this.tabElements.forEach(tab => tab.classList.remove("active"));
        this.contentElements.forEach(content => content.style.display = "none");
        button.classList.add("active");
        const contentElement = document.getElementById(button.dataset.tab);
        if (contentElement) {
            contentElement.style.display = "block";
            this.sectionManager.switchSection(button.dataset.tab);
        }
    }
}

class TranslationManager {
    constructor(sectionManager) {
        this.selectElement = document.getElementById('translationLanguageSelect');
        this.defaultLanguage = 'en';
        this.sectionManager = sectionManager;

        this.loadLanguage();
        this.bindEvents();
    }

    bindEvents() {
        this.selectElement.addEventListener('change', () => {
            this.saveLanguage();
            // Inform the section manager to load new content
            this.sectionManager.loadSectionContent('translation');
        });
    }

    loadLanguage() {
        const savedLanguage = StorageManager.getFromLocalStorage('translationLanguage', this.defaultLanguage);
        this.selectElement.value = savedLanguage;
    }

    saveLanguage() {
        const selectedLanguage = this.selectElement.value;
        StorageManager.saveToLocalStorage('translationLanguage', selectedLanguage);
    }

    getSelectedLanguage() {
        return this.selectElement.value;
    }
}

class ApiKeyManager {
  constructor() {
    this.modal = document.getElementById('apiKeyModal');
    this.apiKeyInput = document.getElementById('apiKeyInput');
    this.saveBtn = document.getElementById('saveApiKeyBtn');
    this.closeBtn = document.getElementById('closeModalBtn');
    this.settingsBtn = document.getElementById('settingsButton');

    this.bindEvents();
  }

  bindEvents() {
    // The aiWriteBtn event listener is no longer here
    this.settingsBtn.addEventListener('click', () => {
      this.showModal();
    });
    this.saveBtn.addEventListener('click', () => {
      this.saveApiKey();
    });
    this.closeBtn.addEventListener('click', () => {
      this.hideModal();
    });
    this.modal.addEventListener('click', (event) => {
      if (event.target === this.modal) {
        this.hideModal();
      }
    });
  }

  // The handleAiButtonClick method is no longer here
  // The API key check and API call logic is now in SectionManager.handleAiWrite()

  showModal() {
    const existingKey = StorageManager.getFromLocalStorage('apiKey');
    if (existingKey) {
      this.apiKeyInput.value = existingKey;
    } else {
      this.apiKeyInput.value = '';
    }
    this.modal.style.display = 'flex';
  }

  hideModal() {
    this.modal.style.display = 'none';
  }

  saveApiKey() {
    const key = this.apiKeyInput.value.trim();
    if (key) {
      StorageManager.saveToLocalStorage('apiKey', key);
      alert('API Key saved successfully!');
      this.hideModal();
    } else {
      alert('Please enter a valid API key.');
    }
  }
}

class SectionManager {
    constructor() {
        this.currentSectionElement = null;
        this.currentNoteId = null;
        this.activeSection = null;
        this.translationManager = null;
        this.aiNoteElements = document.querySelectorAll('.ai-note');
        this.apiKeyManager = null;
        this.apiCache = {};
        this.pollingTimeout = null;

        this.bindEvents();
    }

    bindEvents() {
        this.aiNoteElements.forEach(element => {
            element.addEventListener('input', () => {
                this.saveSectionContent();
            });
        });

        document.getElementById('aiWriteButton').addEventListener('click', () => {
            this.handleAiWrite();
        });
    }

    setNoteId(noteId) {
        this.currentNoteId = noteId;
        this.loadSectionContent(this.activeSection);
    }
    
    setTranslationManager(manager) {
        this.translationManager = manager;
    }

    setApiKeyManager(manager) {
        this.apiKeyManager = manager;
    }

    switchSection(section) {
        this.activeSection = section;
        const newSectionElement = document.querySelector(`.rightTabContent#${section} .ai-note`);
        
        if (!newSectionElement) {
            console.error(`Could not find contenteditable div for section: ${section}`);
            return;
        }

        this.currentSectionElement = newSectionElement;
        this.loadSectionContent(section);
    }
    
    async handleAiWrite() {
        if (this.activeSection === null) return;
        
        if (this.pollingTimeout) {
            clearTimeout(this.pollingTimeout);
        }

        const apiKey = StorageManager.getFromLocalStorage('apiKey');
        console.log('API Key retrieved from local storage:', apiKey);
        if (!apiKey) {
            this.apiKeyManager.showModal();
            return;
        }

        const noteContent = document.getElementById('note').innerText.trim();
        if (!noteContent) {
            alert('Please write some content in the main notepad first.');
            return;
        }
        
        const cacheKey = `${this.activeSection}-${this.currentNoteId}-${noteContent}`;
        if (this.apiCache[cacheKey]) {
            console.log('Using cached result for:', this.activeSection);
            this.currentSectionElement.innerText = this.apiCache[cacheKey];
            this.saveSectionContent();
            return;
        }
        
        this.currentSectionElement.innerText = 'Loading...';

        try {
            let apiPath;
            switch (this.activeSection) {
                case 'summary':
                    apiPath = '/v1/content/summarize';
                    break;
                case 'translation':
                    apiPath = '/v1/content/translate';
                    break;
                case 'grammar':
                    apiPath = '/v1/content/grammar-correct';
                    break;
                case 'rewriting':
                    apiPath = '/v1/content/rewrite';
                    break;
                default:
                    this.currentSectionElement.innerText = 'Function not implemented for this section.';
                    return;
            }
            
            const response = await this.callSharpApi('POST', apiPath, apiKey, { content: noteContent });

            if (response.status_url) {
                this.currentSectionElement.innerText = 'Job accepted. Waiting for result...';
                this.pollForStatus(response.status_url, apiKey);
            }

        } catch (error) {
            console.error('API Error:', error);
            this.currentSectionElement.innerText = `Error: ${error.message}`;
        }
    }

    async pollForStatus(statusUrl, apiKey, retries = 0) {
        const maxRetries = 10;
        const pollInterval = 3000;

        if (retries >= maxRetries) {
            this.currentSectionElement.innerText = 'Job timed out. Please try again.';
            return;
        }
        
        console.log(`Polling status URL: ${statusUrl} (Retry ${retries + 1}/${maxRetries})`);

        try {
            const response = await this.callSharpApi('GET', statusUrl, apiKey);
            console.log('Poll Response:', response);

            // CHANGED: Check for 'completed' or 'success' status
            if (response.data.attributes.status === 'completed' || response.data.attributes.status === 'success') {
                const resultJson = JSON.parse(response.data.attributes.result);
                const finalResult = resultJson.summary || 'No summary found.';

                this.currentSectionElement.innerText = finalResult;
                const cacheKey = `${this.activeSection}-${this.currentNoteId}-${finalResult}`;
                this.apiCache[cacheKey] = finalResult;
                this.saveSectionContent();
                return;
            } else if (response.data.attributes.status === 'failed') {
                this.currentSectionElement.innerText = `Job failed: ${response.data.attributes.message || 'Unknown error'}`;
                return;
            }
            
            this.pollingTimeout = setTimeout(() => this.pollForStatus(statusUrl, apiKey, retries + 1), pollInterval);

        } catch (error) {
            console.error('Polling Error:', error);
            this.currentSectionElement.innerText = `Polling failed: ${error.message}`;
        }
    }

    async callSharpApi(method, path, apiKey, body = null) {
        const url = path.startsWith('http') ? path : `https://sharpapi.com/api${path}`;
        
        console.log('Starting API call...');
        console.log('Method:', method);
        console.log('URL:', url);
        if (body) {
            console.log('Request Body:', body);
        }

        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Authorization", `Bearer ${apiKey}`);
        
        if (method === 'POST') {
            headers.append("Content-Type", "application/json");
        }
        
        const requestOptions = {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
            redirect: "follow"
        };
        
        const response = await fetch(url, requestOptions);
        console.log('Response Status:', response.status);
        
        const result = await response.json();
        console.log('Response Body:', result);

        if (response.status >= 400 && response.status !== 202) {
             throw new Error(result.message || `API call failed with status ${response.status}`);
        }
        
        return result;
    }

    saveSectionContent() {
        if (!this.currentNoteId || !this.currentSectionElement || !this.activeSection) return;
        
        let key = `${this.currentNoteId}-${this.activeSection}`;
        if (this.activeSection === 'translation' && this.translationManager) {
            const language = this.translationManager.getSelectedLanguage();
            key = `${this.currentNoteId}-${this.activeSection}-${language}`;
        }
        
        const content = this.currentSectionElement.innerText;
        StorageManager.saveToLocalStorage(key, content);
    }

    loadSectionContent(section) {
        if (!this.currentNoteId || !section) return;
        
        let key = `${this.currentNoteId}-${section}`;
        if (section === 'translation' && this.translationManager) {
            const language = this.translationManager.getSelectedLanguage();
            key = `${this.currentNoteId}-${section}-${language}`;
        }
        
        const content = StorageManager.getFromLocalStorage(key, '');
        
        const element = document.querySelector(`.rightTabContent#${section} .ai-note`);
        if (element) {
            element.innerText = content;
            element.focus();
            this.placeCursorAtEnd(element);
        }
    }
    
    clearContent(noteId) {
        if (this.currentNoteId === noteId) {
            if (this.currentSectionElement) {
                this.currentSectionElement.innerText = '';
            }
        }
    }

    placeCursorAtEnd(element) {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
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
        
        this.darkModeManager = new DarkModeManager("#darkModeToggle");
        this.keyboardManager = new KeyboardShortcutManager(this.note);
        this.lintingManager = new LintingManager(this.note, this.lineNumbers);
        this.sectionManager = new SectionManager();
        this.tabManager = new TabManager(this.note, this.lineNumbers, this.sectionManager);
        this.fontManager = new FontManager(this.note, this.lineNumbers);
        this.aiTabs = new AiTabs(".rightTab", ".rightTabContent", this.sectionManager);
        this.translationManager = new TranslationManager(this.sectionManager);
        
        this.apiKeyManager = new ApiKeyManager();
        
        // Connect the managers
        this.sectionManager.setTranslationManager(this.translationManager);
        this.sectionManager.setApiKeyManager(this.apiKeyManager);
        
        this.bindEvents();
    }

    bindEvents() {
        this.note.addEventListener('input', () => {
            this.keyboardManager.saveState();
            this.tabManager.saveCurrentTabContent();
            this.lintingManager.updateLineNumbers();
        });
        this.note.addEventListener('paste', (e) => this.pasteHandler(e));
        this.note.addEventListener('drop', (e) => this.dropHandler(e));
        this.note.addEventListener('keydown', (e) => this.keyboardManager.handleKeyboardShortcuts(e));

        this.increaseFont.addEventListener('click', () => this.fontManager.adjustFontSize(2));
        this.decreaseFont.addEventListener('click', () => this.fontManager.adjustFontSize(-2));
        this.increaseFont.addEventListener('mousedown', () => this.fontManager.startIncrease());
        this.decreaseFont.addEventListener('mousedown', () => this.fontManager.startDecrease());
        document.addEventListener('mouseup', () => this.fontManager.stopFontChange());

        this.downloadBtn.addEventListener('click', () => this.download());
        this.printBtn.addEventListener('click', () => this.print());
        this.lintingManager.syncScrolling();
        
        // CORRECTED: The AI button now calls the method on SectionManager
        document.getElementById('aiWriteButton').addEventListener('click', () => {
            this.sectionManager.handleAiWrite();
        });
    }

    pasteHandler(event) {
        event.preventDefault();
        const plainText = (event.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, plainText);
        this.keyboardManager.saveState();
        this.tabManager.saveCurrentTabContent();
    }
    
    dropHandler(event) {
        event.preventDefault();
        const plainText = event.dataTransfer.getData('text');
        document.execCommand('insertText', false, plainText);
        this.keyboardManager.saveState();
        this.tabManager.saveCurrentTabContent();
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

    print() {
        const noteContent = this.note.innerText;
        const printWindow = window.open('', '_blank');
        const body = printWindow.document.body;
        const pre = printWindow.document.createElement('pre');
        pre.textContent = noteContent;
        body.appendChild(pre);
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const app = new NoteApp();
});