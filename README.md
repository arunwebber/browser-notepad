<p align="center">
  <img src="https://raw.githubusercontent.com/arunwebber/browser-notepad/refs/heads/main/images/icon_128.png" alt="Browser Notepad Icon" width="128" height="128">
</p>

# Simple Browser Notepad

A lightweight and simple notepad built with HTML, CSS, and JavaScript that runs directly in your browser. It allows you to create, edit, and save notes, with basic controls to adjust font size, track cursor position, and display line numbers.

## Features

- **Editable Text Area**: A contenteditable div allows users to input and edit text easily.
- **Font Size Controls**: Buttons to increase or decrease the font size of the text.
- **Line Numbers**: Automatically updates the line numbers as you type.
- **Persistent Notes**: Notes are saved in the browser's local storage, so they persist even after refreshing the page.
- **No Installation Required**: Simply open the `index.html` file in your browser and start typing.
- **Lightweight & Fast**: Runs entirely in the browser without needing any server-side components.

## Demo

To try the browser notepad, open the `index.html` file in any modern web browser.

## Installation

Since this is a browser-based application, there is no installation required.

1. Clone this repository 
2. cd browser-notepad
3. Load as an Unpacked Extension:
    * Open Chrome and go to chrome://extensions/
    * Enable Developer mode (top right corner)
    * Click "Load unpacked" and select the folder


## Usage

1. **Edit Notes**: Click into the editable text area and start typing your notes.
2. **Font Size Control**: Use the "+" and "-" buttons to increase or decrease the font size of your text.
3. **Line Numbers**: The notepad automatically displays line numbers on the left side of the text area and updates them as you type.

## JavaScript Features

### Font Size Control

The notepad allows users to increase or decrease the font size with the following functionality:

- **Increase Font Size**: Hold the "+" button to increase the font size incrementally.
- **Decrease Font Size**: Hold the "-" button to decrease the font size, with a minimum font size of 10px.

Both font size changes are saved to the browser's local storage to persist between sessions.


### Line Numbers

The notepad dynamically generates line numbers based on the number of lines in the text area. It updates whenever the user types or presses Enter.



### Persistent Notes

The notepad saves the content and font size in **localStorage**, ensuring that your notes persist even after you refresh the page.


### Syncing Scrolling

The line numbers scroll along with the text area, so users can always see the line numbers in sync with the text.



## Files

- **index.html**: The main HTML structure for the notepad app.
- **style.css**: The CSS file that styles the notepad layout, including fonts, buttons, and text area.
- **popup.js**: The JavaScript file that adds functionality to the app, such as font size controls and line number generation.



## Contributing

Feel free to fork, modify, and submit pull requests to improve this project. Contributions are welcome, especially for adding more features or enhancing the design.

## License

This project is open-source and available under the MIT License.
