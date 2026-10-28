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

  addDeleteButton(li, note);
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

// ---------- 6. POST: create a note ----------
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");

async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validation: title required, maximum 100 characters, body optional
  if (title === "") {
    setStatus("Please enter a title.", "error");
    return;
  }
  if (title.length > 100) {
    setStatus("Title must be 100 characters or fewer.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Creating note...", "info");

  try {
    const { data, status } = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, body: body, userId: 1 }),
    });

    removeEmptyState();
    list.prepend(createNoteItem(data)); // newest note goes to the top
    setStatus(`Note created (status ${status}, id ${data.id}).`, "success");
    form.reset();
    titleInput.focus();
  } catch (error) {
    setStatus("Could not create the note. Please try again.", "error");
    console.error("Create failed:", error);
  } finally {
    submitBtn.disabled = false;
  }
}

form.addEventListener("submit", createNote);

// ---------- 7. DELETE: remove a note ----------
function addDeleteButton(li, note) {
  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "Delete";
  del.classList.add("delete-btn");
  del.addEventListener("click", () => deleteNote(li, note, del));
  li.appendChild(del);
}

// NOTE ABOUT THE PRACTICE API: JSONPlaceholder does not really store
// anything. Notes we create always come back with id 101 and are never
// saved, and a DELETE is accepted but changes nothing on the server.
// So our approach is: send the real DELETE request, and if the server
// answers with a 2xx status, remove that note from the page. We remove
// the exact <li> we were given (not "the note with this id") because
// every note we create has the same id, 101. Clicking "Load notes"
// again brings back the original 10 server notes. With a real backend,
// the same code would work and the deletion would be permanent.
async function deleteNote(li, note, button) {
  button.disabled = true;
  setStatus(`Deleting note ${note.id}...`, "info");

  try {
    const { status } = await request(`${API_URL}/${note.id}`, {
      method: "DELETE",
    });
    li.remove();
    showEmptyIfNeeded();
    setStatus(`Note deleted (status ${status}).`, "success");
  } catch (error) {
    setStatus("Could not delete the note. Please try again.", "error");
    console.error("Delete failed:", error);
    button.disabled = false; // let the user try again
  }
}
