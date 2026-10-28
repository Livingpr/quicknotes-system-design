// ---------- 1. Constants and elements ----------
const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusEl = document.querySelector("#status");
const list = document.querySelector("#notes-list");

// ---------- 2. Helpers ----------
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type; // "info", "success" or "error"
}

// One reusable function for every request: calls fetch, checks
// response.ok and throws on errors so each caller can use try/catch.
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const data = response.status === 204 ? null : await response.json();
  return { data, status: response.status };
}

// ---------- 3. Rendering (user text only via textContent) ----------
function createNoteItem(note) {
  const li = document.createElement("li");
  li.classList.add("note");

  const content = document.createElement("div");
  content.classList.add("note-content");

  const title = document.createElement("strong");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body;

  content.appendChild(title);
  content.appendChild(body);
  li.appendChild(content);

  // (delete button is added in Task 3)
  return li;
}

function removeEmptyState() {
  const empty = list.querySelector(".empty");
  if (empty) empty.remove();
}

function showEmptyIfNeeded() {
  if (list.querySelectorAll(".note").length === 0 && !list.querySelector(".empty")) {
    const li = document.createElement("li");
    li.classList.add("empty");
    li.textContent = "No notes to show.";
    list.appendChild(li);
  }
}

function renderNotes(notes) {
  list.replaceChildren(); // clears the list
  notes.forEach((note) => list.appendChild(createNoteItem(note)));
  showEmptyIfNeeded();
}

// ---------- 4. GET: load notes ----------
async function loadNotes() {
  loadBtn.disabled = true;
  setStatus("Loading notes...", "info");
  list.replaceChildren();

  try {
    const { data } = await request(`${API_URL}?_limit=10`);
    renderNotes(data);
    if (data.length === 0) {
      setStatus("The server returned no notes.", "info");
    } else {
      const word = data.length === 1 ? "note" : "notes";
      setStatus(`Loaded ${data.length} ${word} from the server.`, "success");
    }
  } catch (error) {
    setStatus("Could not load notes. Please try again.", "error");
    console.error("Load failed:", error);
  } finally {
    loadBtn.disabled = false;
  }
}

// ---------- 5. Events ----------
loadBtn.addEventListener("click", loadNotes);
