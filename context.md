# stockpile 

## description
Stockpile is a electron app that is designed to automate website actions during CTF cybersecurity learning events. the expectations is that the end result will allow students to have an app with two windows, one of playwright, and the other of the electron window with AI chat features, allowing the student to promt AI to interact with the page agentically.

The websites being used by the app are simple and are setup specifically to be explored in a cyber security manner so that ethics are not violated.

Stockpile achieves (or will eventually achieve) this exploration through the following libraries and frameworks,

* playwright MCP (JS)
* electron
* ollama


## expected end-user workflow
The following is the expectation of how students will use this app,
Student: "inputs a URL on a start screen", then clicks start.
Student: prompts: "search the DOM for hidden buttons, if they exist, make them visible".
AI Model: (uses playwright MCP to search the DOM and change CSS for buttons).
Student: "Now sees the buttons, inturn allowing the student to return to their homework and talk about the security risks of hidding HTML with CSS like demonstrated".

## All menus in order from bootup to full useable-session
* gate.html = the file that electron boots up to, responsible for checking if ollama is present, then if models are present, display a "start" button, which advances to index.html

* index.html = the file with the settings, web URL and a "begin" button on it, this is responsible for initializing session settings prior to chatting with an AI or using playwright. After the user sets a URL and clicks the "Begin" button, we advance to the next page, session.html

* session.html = The file that holds the actual session that includes the playwright. When this page loads, thats when playwright should open its window. Thats also when AI chatting becomes possible since session.html also has the ollama integration with a chatbox.

## Expected User-Installation
Users will need to have ollama installed, and there will have to be atleast 1 AI model present for the npm ollama package to use.

The app will need to check whether or not ollama is installed by using the 127.0.0.1:{port} API to confirm
If ollama is not present, allow the user to download from in the app, or close the app to manually download.

Regardless, when the