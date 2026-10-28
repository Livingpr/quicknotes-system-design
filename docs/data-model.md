# QuickNotes Data Model

QuickNotes stores its data in a relational database. There are four tables: `users`, `notes`, `tags` and `note_tags`.

## Entities

### users

| Column | Type | Key / rules |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL, UNIQUE |
| `password_hash` | TEXT | NOT NULL (never the plain password) |
| `created_at` | TEXT | Defaults to the current time |

### notes

| Column | Type | Key / rules |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | Foreign key to `users(id)`, NOT NULL |
| `text` | TEXT | NOT NULL, at most 200 characters |
| `category` | TEXT | NOT NULL, one of personal, work, study |
| `created_at` | TEXT | Defaults to the current time |

### tags

| Column | Type | Key / rules |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `name` | TEXT | NOT NULL, UNIQUE |

### note_tags (join table)

| Column | Type | Key / rules |
|--------|------|-------------|
| `note_id` | INTEGER | Foreign key to `notes(id)` |
| `tag_id` | INTEGER | Foreign key to `tags(id)` |

The primary key is the pair `(note_id, tag_id)`, so the same tag cannot be attached to the same note twice.

## Relationships

- **One-to-many (users to notes):** one user has many notes, and each note belongs to exactly one user. The `notes` table holds the foreign key `user_id`.
- **Many-to-many (notes to tags):** a note can have many tags, and a tag can be on many notes. A single column cannot hold several ids without breaking the rule that each column holds one value, so we use the join table `note_tags`. Each row stores one pair of ids, so any note can link to any tag.
- **Cascade deletes:** the foreign keys use `ON DELETE CASCADE`. Deleting a user deletes their notes, and deleting a note removes its rows in `note_tags`.

## CREATE TABLE statements

```sql
CREATE TABLE users (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  text        TEXT NOT NULL CHECK (length(text) <= 200),
  category    TEXT NOT NULL DEFAULT 'personal'
              CHECK (category IN ('personal', 'work', 'study')),
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id  INTEGER NOT NULL,
  tag_id   INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

## Sample data

```sql
INSERT INTO users (name, email, password_hash) VALUES
  ('Amina Otieno', 'amina@example.com', 'hash-1'),
  ('Brian Kamau', 'brian@example.com', 'hash-2');

INSERT INTO notes (user_id, text, category) VALUES
  (1, 'Revise HTTP methods', 'study'),
  (1, 'Buy milk', 'personal'),
  (2, 'Finish report', 'work');

INSERT INTO tags (name) VALUES ('exams'), ('urgent');

INSERT INTO note_tags (note_id, tag_id) VALUES (1, 1), (1, 2), (2, 2);
```

## Example queries

The server fills in user values with placeholders, never by joining strings, to prevent SQL injection. Literal values are used here for readability.

**1. All of Amina's notes, newest first** (this is what `GET /notes` runs):

```sql
SELECT id, text, category, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC;
```

**2. All notes tagged "urgent"** (two JOINs across the many-to-many relationship):

```sql
SELECT notes.text, users.name
FROM notes
JOIN note_tags ON note_tags.note_id = notes.id
JOIN tags ON tags.id = note_tags.tag_id
JOIN users ON users.id = notes.user_id
WHERE tags.name = 'urgent';
```

**3. Number of notes per user** (LEFT JOIN keeps users with zero notes):

```sql
SELECT users.name, COUNT(notes.id) AS note_count
FROM users
LEFT JOIN notes ON notes.user_id = users.id
GROUP BY users.id;
```

**4. Delete one of the user's own notes** (this is what `DELETE /notes/42` runs; the `user_id` check stops users deleting other people's notes):

```sql
DELETE FROM notes WHERE id = 3 AND user_id = 2;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_id_created ON notes(user_id, created_at);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

- **`notes(user_id, created_at)`:** almost every request is "this user's notes, newest first". Without an index, the database scans every note of every user. With it, the database jumps straight to one user's notes, already in date order. At 1 million users this is the most important index in the system.
- **`note_tags(tag_id)`:** the primary key `(note_id, tag_id)` already helps when searching by note, but "all notes with this tag" searches by `tag_id`, so it needs its own index.
- **Trade-off:** every insert, update and delete must also update the indexes, and they use extra storage. QuickNotes reads far more than it writes, so the trade is worth it.

## SQL or NoSQL?

I choose **SQL** (for example PostgreSQL). The data is clearly structured, with users, notes, tags and the links between them, and the questions we ask need relationships, such as "all urgent notes for this user" or "how many notes each user has". A relational database handles these with JOINs and enforces our rules itself: unique emails, notes that must belong to a real user, the 200-character limit and no duplicate tag links. A document database would store each note with its tags embedded, which makes tag searches and renaming a tag harder and risks inconsistent copies. At our estimated size of about 180 GB per year, a single primary with read replicas is enough, so we do not need NoSQL's main strength of spreading across many servers. If notes later become very flexible (drawings, checklists, attachments), we could revisit this.
