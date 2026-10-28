# QuickNotes Architecture

This document describes how QuickNotes can grow from a browser-only app to an online service for 1 million users.

## 1. Requirements

### Functional requirements

- Users can register and log in.
- Users can create, read, update and delete their own notes.
- Notes have a category (personal, work, study) and can have tags.
- Users can search and filter their notes.
- Notes are available from any device after logging in.

### Non-functional requirements

- **Latency:** loading the note list takes under 200 ms for 95% of requests.
- **Availability:** 99.9% uptime, with no single point of failure.
- **Scalability:** handles 1 million registered users, and can grow by adding servers.
- **Durability:** no note is lost once saved, and the database is backed up every night.
- **Security:** HTTPS only, hashed passwords, and every user can only access their own notes.
- **Consistency:** a note list that is a few seconds out of date is acceptable.

## 2. Load estimate for 1 million users

Assumptions:

- 1,000,000 registered users, and 20% are active on a given day, so **200,000 daily active users (DAU)**.
- Each active user creates 5 notes per day and loads their notes 20 times per day.
- An average note, with its extra fields, is about 500 bytes.
- One day is rounded to 100,000 seconds, and peak traffic is 5 times the average.

| Item | Working | Result |
|------|---------|--------|
| Writes per day | 200,000 × 5 | 1,000,000 |
| **Writes per second** | 1,000,000 ÷ 100,000 | **10 average, 50 peak** |
| Reads per day | 200,000 × 20 | 4,000,000 |
| **Reads per second** | 4,000,000 ÷ 100,000 | **40 average, 200 peak** |
| Storage per day | 1,000,000 × 500 bytes | 500 MB |
| **Storage per year** | 500 MB × 365 | **about 180 GB** |

**What this tells us:** the system is **read-heavy** (4 reads for every write), so caching and read replicas will help a lot. 200 requests per second at peak is manageable for a few ordinary servers, and 180 GB per year fits in one well-configured database, so we do not need sharding yet.

## 3. Architecture diagram

```
                         ┌─────────┐
          ┌─────────────>│   DNS   │  (quicknotes.com -> IP addresses)
          │              └─────────┘
 ┌────────┴──────┐  static files  ┌──────────────────────┐
 │ Browser /     │ ─────────────> │ CDN (HTML, CSS, JS)  │
 │ mobile client │                └──────────────────────┘
 └────────┬──────┘
          │ API calls (HTTPS, JSON)
          v
   ┌───────────────┐
   │ Load balancer │  (health checks)
   └──────┬────────┘
     ┌────┴─────┬──────────┐
     v          v          v
 ┌───────┐  ┌───────┐  ┌───────┐        ┌───────────────┐
 │ App 1 │  │ App 2 │  │ App 3 │ ─────> │ Cache (Redis) │
 └───┬───┘  └───┬───┘  └───┬───┘        └───────────────┘
     │ writes   │ reads    │ jobs
     v          v          v
 ┌─────────┐ ┌──────────┐ ┌───────┐   ┌────────┐
 │ Primary │>│ Read     │ │ Queue │──>│ Worker │ (emails, exports)
 │   DB    │ │ replica  │ └───────┘   └────────┘
 └─────────┘ └──────────┘

 Load estimate: 10 writes/s (50 peak), 40 reads/s (200 peak), about 180 GB per year.
```

## 4. What each component does

- **Client (browser or mobile app):** shows the notes and sends API requests, so users can see and change their notes from any device.
- **DNS:** turns `quicknotes.com` into an IP address, so users can find the service by name.
- **CDN:** keeps copies of `index.html`, CSS and JavaScript on edge servers near users, which cuts latency and takes static traffic off our servers.
- **Load balancer:** spreads API requests across the app servers and skips any that fail a health check, so no server is overloaded and one crash does not cause an outage.
- **App servers (two or more):** run the API code (login, notes, tags) and keep no data of their own, so we can add or replace servers freely.
- **Cache (Redis):** keeps each user's note list in memory, so most reads are answered in about 1 ms without touching the database.
- **Primary database:** the one place that accepts writes, which keeps the data correct and consistent.
- **Read replica:** a copy of the primary that answers read queries, which spreads heavy read traffic away from the primary and gives us a spare copy if the primary fails.
- **Message queue:** holds slow jobs such as emails and exports, so the app server can reply to the user immediately.
- **Worker:** takes jobs from the queue and processes them in the background, so slow work never delays a user's request.

## 5. Request flows

### GET /notes

1. The browser has already loaded the app from the CDN. It sends `GET /notes` with its token over HTTPS.
2. The load balancer picks a healthy app server (about 1 ms).
3. The app server checks the token and identifies the user (1 to 2 ms).
4. It looks for the key `notes:user:1` in Redis.
5. **Cache hit:** the notes are returned from memory in about 1 ms. Total time at the server is under 10 ms.
6. **Cache miss:** the app server queries a **read replica** (5 to 20 ms thanks to the index), stores the result in Redis with a TTL of 5 minutes, and returns it.
7. The server responds with `200 OK` and the JSON list. With 80 to 90% of reads served from the cache, the database sees only a small fraction of the traffic.

### POST /notes

1. The browser sends `POST /notes` with the note in the body and its token.
2. The load balancer forwards it to any healthy app server.
3. The app server validates the token and the data (1 to 200 characters, valid category).
4. It writes the note to the **primary database** (5 to 10 ms), because only the primary accepts writes.
5. It deletes `notes:user:1` from Redis so the next read is fresh.
6. It responds with `201 Created` and the new note.
7. Within a few milliseconds the primary copies the new row to the read replica. If the note triggers a slow job, the app server adds it to the queue and the worker handles it later.

## 6. Trade-offs

### Speed versus freshness

The cache and the read replica make reads very fast, but data can be slightly stale. A replica can lag the primary by a few milliseconds, and cached lists can be out of date until the next invalidation or TTL expiry. For notes this is acceptable, because a list that is one second old harms nobody. It would not be acceptable for something like a bank balance. We reduce the risk by deleting the user's cache entry on every write.

### Simplicity versus scalability

A single server is easy to build and understand, but it cannot grow and is a single point of failure. We chose a stateless monolith behind a load balancer: a few identical servers running the same code. This scales to our estimated load without the extra network failures, debugging effort and infrastructure that microservices bring. We would only split out services (for example search) when a clear need appears.

### Cost versus reliability

Extra app servers, a replica and a queue improve uptime and speed but cost more money. We start with three app servers and one replica, and add more only when monitoring shows they are needed.

## 7. Avoiding single points of failure

| Part | If it fails | How we avoid a total outage |
|------|-------------|-----------------------------|
| App server | Requests to it fail | Three or more identical stateless servers. The load balancer's health check removes the dead one within seconds, and clients retry. |
| Load balancer | No traffic reaches the servers | Use a managed cloud load balancer, which runs on several machines, or run two in an active and standby pair. |
| Primary database | Writes stop | The read replica is promoted to primary (failover), with nightly backups as a last resort. |
| Read replica | Reads fall back to the primary | The app falls back to the primary, and a new replica is created. |
| Cache | Reads are slower | A cache miss simply queries the database, so the app keeps working with higher latency (graceful degradation). |
| CDN | Static files load slowly | The CDN fetches from the origin, and the API continues to work. |
| Queue or worker | Background jobs are delayed | Jobs wait safely in the queue and run when a replacement worker starts. Users can still read and write notes. |

Servers keep no state, so no data is lost when a server crashes. Monitoring (logs, metrics such as error rate, latency and cache hit rate, and alerts) tells engineers about problems before most users notice.
