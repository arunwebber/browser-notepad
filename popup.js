const noteArea = document.getElementById('note');
const lineNumbers = document.getElementById('lineNumbers');
const increaseFontBtn = document.getElementById('increaseFont');
const decreaseFontBtn = document.getElementById('decreaseFont');

let increaseInterval;
let decreaseInterval;

// Load saved note and font size when the page loads
window.onload = () => {
  noteArea.innerText = localStorage.getItem('savedNote') || '';
  const fontSize = localStorage.getItem('fontSize') || '16px';
  noteArea.style.fontSize = fontSize;
  lineNumbers.style.fontSize = fontSize;  // Sync font size with line numbers
  updateLineNumbers();  // Update line numbers when the page loads
};

// Save note content on every input
noteArea.addEventListener('input', () => {
  localStorage.setItem('savedNote', noteArea.innerText);
  updateLineNumbers(); // Update line numbers on each input
});

// Update line numbers based on the actual number of line breaks in the text area
function updateLineNumbers() {
  const lines = noteArea.innerText.split('\n').length;
  let lineNumberText = '';
  for (let i = 1; i <= lines; i++) {
    lineNumberText += i + '\n';
  }
  lineNumbers.innerText = lineNumberText;
}

// Sync scrolling between the text area and the line numbers
noteArea.addEventListener('scroll', function () {
  lineNumbers.scrollTop = noteArea.scrollTop;
});

// Function to increase font size
function increaseFontSize() {
  const currentSize = parseInt(window.getComputedStyle(noteArea).fontSize);
  const newSize = currentSize + 2; // Increase by 2px each time
  noteArea.style.fontSize = `${newSize}px`;
  lineNumbers.style.fontSize = `${newSize}px`; // Adjust line number size
  localStorage.setItem('fontSize', `${newSize}px`);
}

// Function to decrease font size
function decreaseFontSize() {
  const currentSize = parseInt(window.getComputedStyle(noteArea).fontSize);
  const newSize = Math.max(10, currentSize - 2); // Decrease by 2px but not less than 10px
  noteArea.style.fontSize = `${newSize}px`;
  lineNumbers.style.fontSize = `${newSize}px`; // Adjust line number size
  localStorage.setItem('fontSize', `${newSize}px`);
}

// Start increasing font size when the button is pressed
increaseFontBtn.addEventListener('mousedown', () => {
  increaseInterval = setInterval(increaseFontSize, 100); // Increase every 100ms while held down
});

// Stop increasing font size when the button is released
increaseFontBtn.addEventListener('mouseup', () => {
  clearInterval(increaseInterval);
});

// Start decreasing font size when the button is pressed
decreaseFontBtn.addEventListener('mousedown', () => {
  decreaseInterval = setInterval(decreaseFontSize, 100); // Decrease every 100ms while held down
});

// Stop decreasing font size when the button is released
decreaseFontBtn.addEventListener('mouseup', () => {
  clearInterval(decreaseInterval);
});

// Ensure the font size stops when the mouse leaves the button
increaseFontBtn.addEventListener('mouseleave', () => {
  clearInterval(increaseInterval);
});

decreaseFontBtn.addEventListener('mouseleave', () => {
  clearInterval(decreaseInterval);
});
