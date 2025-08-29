// Global utility functions
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// StorageManager Class: Batches localStorage operations
class StorageManager {
    static pendingWrites = new Map();
    static writeTimeout = null;

    static saveToLocalStorage(key, value) {
        this.pendingWrites.set(key, value);
        
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }
        
        this.writeTimeout = setTimeout(() => {
            this.flushWrites();
        }, 100);
    }

    static flushWrites() {
        this.pendingWrites.forEach((value, key) => {
            localStorage.setItem(key, value);
        });
        this.pendingWrites.clear();
        this.writeTimeout = null;
    }

    static getFromLocalStorage(key, defaultValue = '') {
        if (this.pendingWrites.has(key)) {
            return this.pendingWrites.get(key);
        }
        return localStorage.getItem(key) || defaultValue;
    }

    static removeFromLocalStorage(key) {
        this.pendingWrites.delete(key);
        localStorage.removeItem(key);
    }
}

// HistoryManager: Manages undo/redo stacks with a size limit
class HistoryManager {
    constructor() {
        this.past = [];
        this.future = [];
        this.current = '';
        this.isNavigating = false;
        this.maxHistorySize = 50; // Limit history size
    }

    pushState(newState) {
        if (this.isNavigating) {
            this.isNavigating = false;
            return;
        }
        
        if (this.current !== '' && this.current !== newState && 
            Math.abs(this.current.length - newState.length) > 5) {
            this.past.push(this.current);
            
            if (this.past.length > this.maxHistorySize) {
                this.past.shift();
            }
        }
        
        this.current = newState;
        this.future = [];
    }

    undo() {
        if (this.past.length > 0) {
            this.isNavigating = true;
            this.future.unshift(this.current);
            this.current = this.past.pop();
            return this.current;
        }
        return null;
    }

    redo() {
        if (this.future.length > 0) {
            this.isNavigating = true;
            this.past.push(this.current);
            this.current = this.future.shift();
            return this.current;
        }
        return null;
    }
}

// FontManager Class: Handles font size changes
class FontManager {
  constructor(noteElement, lineNumbersElement) {
    this.noteElement = noteElement;
    this.lineNumbersElement = lineNumbersElement;
    this.fontChangeInterval = null;

    const savedFontSize = StorageManager.getFromLocalStorage('fontSize');
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
    StorageManager.saveToLocalStorage('fontSize', `${newSize}px`);
  }

  stopFontChange() {
    clearInterval(this.fontChangeInterval);
  }
}

// LintingManager Class: Handles various linting tasks with performance improvements
class LintingManager {
    constructor(noteElement, lineNumbersElement) {
        this.noteElement = noteElement;
        this.lineNumbersElement = lineNumbersElement;
        this.lineUpdatePending = false;
        
        this.scrollHandler = throttle(() => {
            this.lineNumbersElement.scrollTop = this.noteElement.scrollTop;
        }, 16); // Throttled to ~60fps

        this.syncScrolling();
    }

    updateLineNumbers() {
        if (this.lineUpdatePending) return;
        
        this.lineUpdatePending = true;
        requestAnimationFrame(() => {
            const lines = this.noteElement.innerText.split('\n').length;
            const lineNumbers = Array.from({ length: lines }, (_, i) => i + 1);
            this.lineNumbersElement.innerText = lineNumbers.join('\n');
            this.lineUpdatePending = false;
        });
    }

    syncScrolling() {
        this.noteElement.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    cleanup() {
        this.noteElement.removeEventListener('scroll', this.scrollHandler);
    }
}

class TabManager {
    constructor(noteElement, lineNumberElement, sectionManager) {
        this.noteElement = noteElement;
        this.lineNumberElement = lineNumberElement;
        this.sectionManager = sectionManager;
        this.tabs = [];
        this.tabHistories = {};
        this.currentTabIndex = -1;

        this.tabContainer = document.getElementById('tabContainer');
        this.addTabBtn = document.getElementById('addTabBtn');

        this.addTabBtn.addEventListener('click', () => this.createNewTab());

        this.scrollHandler = throttle(() => this.syncScroll(), 16);
        this.noteElement.addEventListener('scroll', this.scrollHandler, { passive: true });
        
        this.bindUndoRedo();

        const savedTabs = StorageManager.getFromLocalStorage('tabs', null);
        const savedTabIndex = StorageManager.getFromLocalStorage('currentTabIndex', -1);

        if (savedTabs) {
            this.tabs = JSON.parse(savedTabs);
            this.tabs.forEach(tab => {
                this.tabHistories[tab.id] = new HistoryManager();
                const savedContent = StorageManager.getFromLocalStorage(tab.id, '');
                this.tabHistories[tab.id].current = savedContent;
            });
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
        };
        this.tabs.push(tab);
        this.tabHistories[tabId] = new HistoryManager();
        this.renderTabs();
        this.switchTab(this.tabs.length - 1);
    }

    switchTab(index) {
        if (this.currentTabIndex === index) return;
        this.saveCurrentTabContent();

        this.currentTabIndex = index;
        const currentTab = this.tabs[this.currentTabIndex];
        
        const historyManager = this.tabHistories[currentTab.id];
        const newContent = historyManager.current || StorageManager.getFromLocalStorage(currentTab.id, '');
        
        this.noteElement.innerText = newContent;
        historyManager.current = newContent;

        this.sectionManager.setNoteId(currentTab.id);

        this.updateLineNumbers();
        this.highlightActiveTab();
        this.saveTabsToStorage();
        this.placeCursorAtEnd(this.noteElement);
    }
    
    saveCurrentTabContent() {
        if (this.currentTabIndex === -1) return;
        const currentTab = this.tabs[this.currentTabIndex];
        const currentContent = this.noteElement.innerText;
        
        StorageManager.saveToLocalStorage(currentTab.id, currentContent);
        this.tabHistories[currentTab.id].pushState(currentContent);
    }

    closeTab(index) {
        if (this.tabs.length <= 1) {
            alert("Cannot delete the last tab.");
            return;
        }

        const tabToClose = this.tabs[index];
        const wasActiveTab = (index === this.currentTabIndex);

        this.tabs.splice(index, 1);
        
        delete this.tabHistories[tabToClose.id];
        
        StorageManager.removeFromLocalStorage(tabToClose.id);
        ['summary', 'translation', 'grammar', 'rewriting', 'keywords'].forEach(section => {
            const key = `${tabToClose.id}-${section}`;
            StorageManager.removeFromLocalStorage(key);
        });

        if (wasActiveTab) {
            if (index >= this.tabs.length) {
                this.currentTabIndex = this.tabs.length - 1;
            } else {
                this.currentTabIndex = index;
            }
        } else if (index < this.currentTabIndex) {
            this.currentTabIndex -= 1;
        }

        this.saveTabsToStorage();
        this.renderTabs();
        
        if (wasActiveTab) {
            this.currentTabIndex = -1;
            this.switchTab(index >= this.tabs.length ? this.tabs.length - 1 : index);
        }
    }

    bindUndoRedo() {
        this.undoRedoHandler = (e) => {
            if (e.target !== this.noteElement) return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                this.undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
        };
        document.addEventListener('keydown', this.undoRedoHandler);
    }
    
    undo() {
        if (this.currentTabIndex === -1) return;
        const currentTabId = this.tabs[this.currentTabIndex].id;
        const historyManager = this.tabHistories[currentTabId];

        const previousState = historyManager.undo();
        if (previousState !== null) {
            this.noteElement.innerText = previousState;
            this.updateLineNumbers();
            this.placeCursorAtEnd(this.noteElement);
        }
    }

    redo() {
        if (this.currentTabIndex === -1) return;
        const currentTabId = this.tabs[this.currentTabIndex].id;
        const historyManager = this.tabHistories[currentTabId];

        const nextState = historyManager.redo();
        if (nextState !== null) {
            this.noteElement.innerText = nextState;
            this.updateLineNumbers();
            this.placeCursorAtEnd(this.noteElement);
        }
    }

    renderTabs() {
        const existingTabs = this.tabContainer.querySelectorAll('.tab');
        
        this.tabs.forEach((tab, index) => {
            let tabElement = existingTabs[index];
            
            if (!tabElement) {
                tabElement = this.createTabElement(tab, index);
                this.tabContainer.appendChild(tabElement);
            } else {
                const titleSpan = tabElement.querySelector('.tab-title');
                if (titleSpan && titleSpan.textContent !== tab.title) {
                    titleSpan.textContent = tab.title;
                }
            }
        });
        
        while (this.tabContainer.children.length > this.tabs.length) {
            this.tabContainer.removeChild(this.tabContainer.lastChild);
        }
        
        this.highlightActiveTab();
    }
    
    createTabElement(tab, index) {
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
                const newTitle = input.value.trim() || 'Untitled';
                
                // Update the tab's title in the data
                tab.title = newTitle;
                this.saveTabsToStorage();

                // Create a new title span and set its content
                const newTitleSpan = document.createElement('span');
                newTitleSpan.textContent = newTitle;
                newTitleSpan.classList.add('tab-title');
                
                // Re-attach the dblclick event listener to the new span
                newTitleSpan.ondblclick = (e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = newTitle;
                    input.className = 'edit-title';

                    tabElement.replaceChild(input, newTitleSpan);
                    input.focus();
                    
                    const newSave = () => {
                        const finalNewTitle = input.value.trim() || 'Untitled';
                        tab.title = finalNewTitle;
                        this.saveTabsToStorage();
                        this.renderTabs();
                    };
                    
                    input.onblur = newSave;
                    input.onkeydown = (e) => {
                        if (e.key === 'Enter') input.blur();
                    };
                };

                // Replace the input with the new span
                tabElement.replaceChild(newTitleSpan, input);
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
        
        return tabElement;
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
    
    cleanup() {
        if (this.scrollHandler) {
            this.noteElement.removeEventListener('scroll', this.scrollHandler);
        }
        if (this.undoRedoHandler) {
            document.removeEventListener('keydown', this.undoRedoHandler);
        }
    }
}

class DarkModeManager {
    constructor(toggleSelector) {
        this.toggle = document.querySelector(toggleSelector);
        if (StorageManager.getFromLocalStorage("darkMode") === "enabled") {
            document.body.classList.add("dark-mode");
            this.toggle.checked = true;
        }
        this.toggle.addEventListener("change", () => this.toggleDarkMode());
    }

    toggleDarkMode() {
        if (this.toggle.checked) {
            document.body.classList.add("dark-mode");
            StorageManager.saveToLocalStorage("darkMode", "enabled");
        } else {
            document.body.classList.remove("dark-mode");
            StorageManager.saveToLocalStorage("darkMode", "disabled");
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
        
        if (this.selectElement.options.length === 0) {
            this.populateLanguageSelect();
        }
        
        this.loadLanguage();
        this.bindEvents();
    }
    
    populateLanguageSelect() {
        const languages = {
            "Afrikaans": "af", "Albanian": "sq", "Amharic": "am", "Arabic": "ar", "Armenian": "hy",
            "Assamese": "as", "Aymara": "ay", "Azerbaijani": "az", "Bambara": "bm", "Basque": "eu",
            "Belarusian": "be", "Bengali": "bn", "Bhojpuri": "bho", "Bosnian": "bs", "Bulgarian": "bg",
            "Burmese": "my", "Catalan": "ca", "Cebuano": "ceb", "Chichewa": "ny", "Chinese (Simplified)": "zh-Hans",
            "Chinese (Traditional)": "zh-Hant", "Corsican": "co", "Croatian": "hr", "Czech": "cs", "Danish": "da",
            "Dhivehi": "dv", "Dogri": "doi", "Dutch": "nl", "English": "en", "Esperanto": "eo",
            "Estonian": "et", "Ewe": "ee", "Filipino": "fil", "Finnish": "fi", "French": "fr",
            "Frisian": "fy", "Galician": "gl", "Georgian": "ka", "German": "de", "Greek": "el",
            "Guarani": "gn", "Gujarati": "gu", "Haitian Creole": "ht", "Hausa": "ha", "Hawaiian": "haw",
            "Hebrew": "he", "Hindi": "hi", "Hmong": "hmn", "Hungarian": "hu", "Icelandic": "is",
            "Igbo": "ig", "Iloko": "ilo", "Indonesian": "id", "Irish": "ga", "Italian": "it",
            "Japanese": "ja", "Javanese": "jw", "Kannada": "kn", "Kazakh": "kk", "Khmer": "km",
            "Kinyarwanda": "rw", "Konkani": "gom", "Korean": "ko", "Krio": "kri", "Kurdish": "ku",
            "Kyrgyz": "ky", "Lao": "lo", "Latin": "la", "Latvian": "lv", "Lingala": "ln",
            "Lithuanian": "lt", "Luganda": "lg", "Luxembourgish": "lb", "Macedonian": "mk", "Maithili": "mai",
            "Malagasy": "mg", "Malay": "ms", "Malayalam": "ml", "Maltese": "mt", "Maori": "mi",
            "Marathi": "mr", "Meiteilon (Manipuri)": "mni-Mtei", "Mizo": "lus", "Mongolian": "mn", "Nepali": "ne",
            "Norwegian": "no", "Odia (Oriya)": "or", "Oromo": "om", "Pashto": "ps", "Persian": "fa",
            "Polish": "pl", "Portuguese": "pt", "Punjabi": "pa", "Quechua": "qu", "Romanian": "ro",
            "Russian": "ru", "Samoan": "sm", "Sanskrit": "sa", "Scots Gaelic": "gd", "Sepedi": "nso",
            "Serbian": "sr", "Sesotho": "st", "Shona": "sn", "Sindhi": "sd", "Sinhala": "si",
            "Slovak": "sk", "Slovenian": "sl", "Somali": "so", "Spanish": "es", "Sundanese": "su",
            "Swahili": "sw", "Swedish": "sv", "Tagalog": "tl", "Tajik": "tg", "Tamil": "ta",
            "Tatar": "tt", "Telugu": "te", "Thai": "th", "Tigrinya": "ti", "Tsonga": "ts",
            "Turkish": "tr", "Turkmen": "tk", "Twi": "ak", "Ukrainian": "uk", "Urdu": "ur",
            "Uyghur": "ug", "Uzbek": "uz", "Vietnamese": "vi", "Welsh": "cy", "Xhosa": "xh",
            "Yiddish": "yi", "Yoruba": "yo", "Zulu": "zu"
        };
    
        const fragment = document.createDocumentFragment();
        
        for (const [name, code] of Object.entries(languages)) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = name;
            fragment.appendChild(option);
        }
        this.selectElement.appendChild(fragment);
    }

    bindEvents() {
        this.selectElement.addEventListener('change', () => {
            this.saveLanguage();
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
    
    async generateCacheKey(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return `${this.activeSection}-${this.currentNoteId}-${hashHex.substring(0, 16)}-${
            this.activeSection === 'translation' ? this.translationManager.getSelectedLanguage() : ''}`;
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
        if (!apiKey) {
            this.apiKeyManager.showModal();
            return;
        }

        const noteContent = document.getElementById('note').innerText.trim();
        if (!noteContent) {
            alert('Please write some content in the main notepad first.');
            return;
        }
        
        const cacheKey = await this.generateCacheKey(noteContent);

        if (this.apiCache[cacheKey]) {
            this.setContent(this.currentSectionElement, this.apiCache[cacheKey]);
            this.saveSectionContent();
            return;
        }
        
        this.currentSectionElement.innerText = 'Loading...';

        try {
            let apiPath;
            let requestBody = { content: noteContent };

            switch (this.activeSection) {
                case 'summary':
                    apiPath = '/v1/content/summarize';
                    break;
                case 'translation':
                    apiPath = '/v1/content/translate';
                    requestBody.language = this.translationManager.getSelectedLanguage();
                    break;
                case 'grammar':
                    apiPath = '/v1/content/proofread';
                    break;
                case 'rewriting':
                    apiPath = '/v1/content/paraphrase';
                    break;
                case 'keywords':
                    apiPath = '/v1/content/keywords';
                    break;
                default:
                    this.currentSectionElement.innerText = 'Function not implemented for this section.';
                    return;
            }
            
            const response = await this.callSharpApi('POST', apiPath, apiKey, requestBody);
            
            if (response.status_url) {
                this.currentSectionElement.innerText = 'Job accepted. Waiting for result...';
                this.pollForStatus(response.status_url, apiKey, cacheKey);
            }

        } catch (error) {
            this.currentSectionElement.innerText = `Error: ${error.message}`;
        }
    }

    async pollForStatus(statusUrl, apiKey, cacheKey, retries = 0) {
        const maxRetries = 10;
        const pollInterval = 3000;

        if (retries >= maxRetries) {
            this.currentSectionElement.innerText = 'Job timed out. Please try again.';
            return;
        }
        
        try {
            const response = await this.callSharpApi('GET', statusUrl, apiKey);

            if (response.data.attributes.status === 'completed' || response.data.attributes.status === 'success') {
                const result = JSON.parse(response.data.attributes.result);
                
                let finalResult = 'No result found.';
                if (this.activeSection === 'summary') {
                    finalResult = result.summary || 'No summary found.';
                } else if (this.activeSection === 'translation') {
                    finalResult = result.content || 'No translation found.';
                } else if (this.activeSection === 'grammar') {
                    finalResult = result.proofread || 'No proofread result found.';
                } else if (this.activeSection === 'rewriting') {
                    finalResult = result.paraphrase || 'No rewritten text found.';
                } else if (this.activeSection === 'keywords') {
                    if (Array.isArray(result)) {
                        finalResult = result.join(', ');
                    } else {
                        finalResult = 'No keywords found.';
                    }
                }

                this.setContent(this.currentSectionElement, finalResult);
                this.apiCache[cacheKey] = finalResult;
                this.saveSectionContent();
                return;
            } else if (response.data.attributes.status === 'failed') {
                this.currentSectionElement.innerText = `Job failed: ${response.data.attributes.message || 'Unknown error'}`;
                return;
            }
            
            this.pollingTimeout = setTimeout(() => this.pollForStatus(statusUrl, apiKey, cacheKey, retries + 1), pollInterval);

        } catch (error) {
            this.currentSectionElement.innerText = `Polling failed: ${error.message}`;
        }
    }
    
    setContent(element, newText) {
        element.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, newText);
        this.placeCursorAtEnd(element);
    }

    async callSharpApi(method, path, apiKey, body = null) {
        const url = path.startsWith('http') ? path : `https://sharpapi.com/api${path}`;
        
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
        
        try {
            const response = await fetch(url, requestOptions);
            const result = await response.json();

            if (!response.ok && response.status !== 202) {
                throw new Error(result.message || `API call failed with status ${response.status}`);
            }
            
            return result;
        } catch (error) {
            throw error;
        }
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
            this.setContent(element, content);
        }
    }
    
    clearContent(noteId) {
        if (this.currentNoteId === noteId) {
            if (this.currentSectionElement) {
                this.setContent(this.currentSectionElement, '');
            }
        }
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
}

// UploadManager Class: Handles file uploads
class UploadManager {
    constructor(noteElement, uploadBtnId) {
        this.noteElement = noteElement;
        this.uploadBtn = document.getElementById(uploadBtnId);
        this.bindEvents();
    }

    bindEvents() {
        this.uploadBtn.addEventListener('click', () => this.triggerUpload());
    }

    triggerUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt'; // Restrict to text files
        input.onchange = (e) => this.handleFileSelect(e);
        input.click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            this.noteElement.innerText = content;
            // You may want to trigger a save or update here if needed.
            // For example, this.tabManager.saveCurrentTabContent();
        };
        reader.readAsText(file);
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
        this.lintingManager = new LintingManager(this.note, this.lineNumbers);
        this.sectionManager = new SectionManager();
        this.tabManager = new TabManager(this.note, this.lineNumbers, this.sectionManager);
        this.fontManager = new FontManager(this.note, this.lineNumbers);
        this.aiTabs = new AiTabs(".rightTab", ".rightTabContent", this.sectionManager);
        this.translationManager = new TranslationManager(this.sectionManager);
        this.apiKeyManager = new ApiKeyManager();
        this.uploadManager = new UploadManager(this.note, 'uploadBtn');

        this.sectionManager.setTranslationManager(this.translationManager);
        this.sectionManager.setApiKeyManager(this.apiKeyManager);

        this.debouncedInputHandler = debounce(() => {
            this.tabManager.saveCurrentTabContent();
            this.lintingManager.updateLineNumbers();
        }, 500);

        this.pasteHandler = (e) => this.handlePaste(e);
        this.dropHandler = (e) => this.handleDrop(e);
        this.increaseFontClickHandler = () => this.fontManager.adjustFontSize(2);
        this.decreaseFontClickHandler = () => this.fontManager.adjustFontSize(-2);
        this.increaseFontMousedownHandler = () => this.fontManager.startIncrease();
        this.decreaseFontMousedownHandler = () => this.fontManager.startDecrease();
        this.mouseUpHandler = () => this.fontManager.stopFontChange();
        this.downloadClickHandler = () => this.download();
        this.printClickHandler = () => this.print();
        this.aiWriteClickHandler = () => this.sectionManager.handleAiWrite();

        this.bindEvents();
    }

    bindEvents() {
        this.note.addEventListener('input', this.debouncedInputHandler);
        this.note.addEventListener('paste', this.pasteHandler);
        this.note.addEventListener('drop', this.dropHandler);

        this.increaseFont.addEventListener('click', this.increaseFontClickHandler);
        this.decreaseFont.addEventListener('click', this.decreaseFontClickHandler);
        this.increaseFont.addEventListener('mousedown', this.increaseFontMousedownHandler);
        this.decreaseFont.addEventListener('mousedown', this.decreaseFontMousedownHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);

        this.downloadBtn.addEventListener('click', this.downloadClickHandler);
        this.printBtn.addEventListener('click', this.printClickHandler);

        document.getElementById('aiWriteButton').addEventListener('click', this.aiWriteClickHandler);
    }

    cleanup() {
        this.note.removeEventListener('input', this.debouncedInputHandler);
        this.note.removeEventListener('paste', this.pasteHandler);
        this.note.removeEventListener('drop', this.dropHandler);

        this.increaseFont.removeEventListener('click', this.increaseFontClickHandler);
        this.decreaseFont.removeEventListener('click', this.decreaseFontClickHandler);
        this.increaseFont.removeEventListener('mousedown', this.increaseFontMousedownHandler);
        this.decreaseFont.removeEventListener('mousedown', this.decreaseFontMousedownHandler);
        document.removeEventListener('mouseup', this.mouseUpHandler);

        this.downloadBtn.removeEventListener('click', this.downloadClickHandler);
        this.printBtn.removeEventListener('click', this.printClickHandler);

        document.getElementById('aiWriteButton').removeEventListener('click', this.aiWriteClickHandler);

        this.lintingManager.cleanup();
        this.tabManager.cleanup();
        this.fontManager.stopFontChange();
    }

    handlePaste(event) {
        event.preventDefault();
        const plainText = (event.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, plainText);
        this.tabManager.saveCurrentTabContent();
    }

    handleDrop(event) {
        event.preventDefault();
        const plainText = event.dataTransfer.getData('text');
        document.execCommand('insertText', false, plainText);
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