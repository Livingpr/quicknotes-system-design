# QuickNotes System Design

QuickNotes is moving from a browser-only app to an online service for 1 million users. This repository has two parts: a working front-end **API client** that talks to the JSONPlaceholder practice API (GET, POST and DELETE), and three **design documents** that the backend team can build from: the REST API, the database model and the system architecture.

## API client

The client is `index.html`, `style.css` and `api.js`. It can:

- Load 10 notes from the server (GET), with loading, success, error and empty states
- Create a note with a required title of up to 100 characters (POST)
- Delete a note (DELETE)
- Disable buttons while a request is running
- Show every note using `textContent` only, so user text can never run as code

JSONPlaceholder does not really save changes. Created notes always get id 101, and deleted notes come back when you click "Load notes" again. This is explained in a comment in `api.js`.

## How to run the API client

1. Clone the repository: `git clone https://github.com/Livingpr/quicknotes-system-design.git`
2. Go into the folder: `cd quicknotes-system-design`
3. Start a local server: `python3 -m http.server 8000`
4. Open `http://localhost:8000` in your browser and click "Load notes".

You need an internet connection, because the client calls `https://jsonplaceholder.typicode.com/posts`.

## Design documents

- [API design](docs/api-design.md): eight REST endpoints, request and response examples, and error codes
- [Data model](docs/data-model.md): users, notes, tags and note_tags, with SQL, example queries, indexes and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, load estimate for 1 million users, diagram, request flows, trade-offs and single points of failure

## What I learned

- How to use `fetch` with `async` and `await`, and why every request needs `try`, `catch` and a `response.ok` check, because fetch does not throw on 404 or 500 errors.
- How to show loading, success, error and empty states, and why disabling buttons during a request stops duplicate submissions.
- How to design a RESTful API with plural nouns, the right HTTP methods and status codes, and a consistent error format.
- How to model data with primary keys, foreign keys and a join table for many-to-many relationships, and how an index speeds up the queries the app runs most.
- How to estimate load with rough numbers, and how caching, a load balancer, read replicas and a queue remove single points of failure.
- How to write clear Git commits for each stage of a project.
