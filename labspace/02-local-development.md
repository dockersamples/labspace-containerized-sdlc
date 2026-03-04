# Local Dev with Docker Compose

The app needs PostgreSQL. You could install Postgres directly on your machine, but then every developer on your team needs to do the same — and they need the same version, the same credentials, the same config. That's error-prone and slow.

Docker Compose solves this cleanly: define your dev infrastructure as code, and anyone can start it with a single command.

## What you'll create

Your `compose.yaml` will start two containers:

- **`db`** — PostgreSQL 18 (the database the app connects to)
- **`adminer`** — a lightweight database GUI so you can see your data visually

The application itself will run natively with `node src/app.js`, connecting to the Compose-managed database. This is a common pattern: containers provide the infrastructure; the app runs locally for faster iteration.

## Write the Compose file

1. Create a file named `compose.yaml` with the following contents:

    ```yaml save-as=compose.yaml
    services:
      db:
        image: postgres:18-alpine
        ports:
          - "5432:5432"
        environment:
          POSTGRES_DB: taskflow
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        healthcheck:
          test: ["CMD-SHELL", "pg_isready -U postgres"]
          interval: 5s
          timeout: 5s
          retries: 5
        volumes:
          - db_data:/var/lib/postgresql/data

      adminer:
        image: adminer
        ports:
          - "8081:8080"
        environment:
          ADMINER_PLUGINS: frames
        depends_on:
          - db

    volumes:
      db_data:
    ```

    A few things worth noting:
    - The `healthcheck` on `db` ensures PostgreSQL is actually ready to accept connections before other services try to use it.
    - The named volume `db_data` persists your data across `docker compose down` / `up` cycles.
    - Adminer maps container port 8080 → host port 8081 (port 8080 is reserved by the lab infrastructure).

2. Start the infrastructure:

    ```bash
    docker compose up -d
    ```

3. Confirm both containers are running:

    ```bash
    docker compose ps
    ```

    You should see `db` with a status of `healthy` and `adminer` as `running`.

## Start the app

The app's `src/db.js` defaults match exactly what Compose set up (`localhost:5432`, user `postgres`, password `postgres`). No extra environment variables needed.

4. Start the app in a dedicated terminal tab:

    ```bash terminal-id=taskflow-app
    node src/app.js
    ```

    You should see: `TaskFlow API listening on port 3000`

## Test the API

With the app running in its own terminal, use a second terminal to try the API:

5. Check the health endpoint:

    ```bash terminal-id=shell
    curl -s http://localhost:3000/health
    ```

    Expected output:
    ```json no-copy-button
    {"status":"ok"}
    ```

6. Create a couple of tasks:

    ```bash terminal-id=shell
    curl -s -X POST http://localhost:3000/api/tasks \
      -H "Content-Type: application/json" \
      -d '{"title":"Learn Docker Compose","description":"Set up the local dev environment"}'
    ```

    ```bash terminal-id=shell
    curl -s -X POST http://localhost:3000/api/tasks \
      -H "Content-Type: application/json" \
      -d '{"title":"Write integration tests","description":"Use Testcontainers for isolated testing"}'
    ```

7. Retrieve your task list:

    ```bash terminal-id=shell
    curl -s http://localhost:3000/api/tasks | jq .
    ```

## Explore the data in Adminer

Adminer gives you a visual view of the database — no local Postgres tools needed.

8. :tabLink[Open Adminer]{href="http://localhost:8081" title="Database (Adminer)" id="adminer"} and log in with these credentials: 

    | Field | Value |
    |---|---|
    | System | PostgreSQL |
    | Server | `db` |
    | Username | `postgres` |
    | Password | `postgres` |
    | Database | `taskflow` |

    Click **tasks** in the left panel to see the rows you just created through the API.

9. Try deleting a task via the API and refreshing Adminer — you'll see the row disappear in real time.

    ```bash terminal-id=shell
    # Replace 1 with the actual task ID from your task list
    curl -s -X DELETE http://localhost:3000/api/tasks/1
    ```

## What you've got

With a single `compose.yaml`, any developer on your team can clone the repo, run `docker compose up -d`, and have a fully working local database in seconds — no installation guide required. That's the first win of the containerized SDLC.

In the next section, you'll bring that same consistency to your automated tests.
