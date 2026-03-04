# Containerizing Your Dev Environment

Running the database in a container is a great start, but the app still runs natively. That means developers need the right Node.js version installed locally, and the app's runtime can silently differ from production.

The next step is putting the app itself into a container — with one important twist for developer experience: **Compose Watch**. When you save a source file, Compose Watch syncs it into the running container and nodemon restarts the app automatically. You get the consistency of containers with the tight feedback loop of native development.

As a bonus, once the app joins the Docker network it can reach the database via the service name `db`, so you no longer need to publish the database port to the host.

## Set up hot-reloading

1. Install nodemon as a dev dependency:

    ```bash
    npm install --save-dev nodemon
    ```

## Add a development stage to the Dockerfile

The existing `Dockerfile` builds a lean production image. You'll add a `development` stage on top that installs all dependencies (including devDependencies) and uses nodemon as the entry point.

2. Update `Dockerfile` with the following:

    ```dockerfile save-as=Dockerfile
    # Development stage — includes devDependencies for hot-reloading with nodemon
    FROM node:24-alpine AS development
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci
    COPY src/ ./src/
    CMD ["npx", "nodemon", "src/app.js"]

    # Production stage — lean image with only runtime dependencies
    FROM node:24-alpine AS production
    WORKDIR /app
    COPY package*.json ./
    RUN npm ci --omit=dev
    COPY src/ ./src/
    EXPOSE 3000
    CMD ["node", "src/app.js"]
    ```

    Having two named stages means you can target `development` locally and `production` in CI — using the same `Dockerfile` throughout.

## Update the Compose file

3. Update `compose.yaml` to add the app service with Compose Watch and remove the database's host port mapping:

    ```yaml save-as=compose.yaml highlight=2-22
    services:
      app:
        build:
          context: .
          target: development
        ports:
          - "3000:3000"
        environment:
          DB_HOST: db
          DB_NAME: taskflow
          DB_USER: postgres
          DB_PASSWORD: postgres
        depends_on:
          db:
            condition: service_healthy
        develop:
          watch:
            - action: sync
              path: ./src
              target: /app/src
            - action: rebuild
              path: package.json

      db:
        image: postgres:18-alpine
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

    A few things to notice:
    - `build.target: development` selects the `development` stage, which has nodemon.
    - The `develop.watch` block has two rules: `sync` copies changes from `./src` into `/app/src` in the running container (triggering nodemon); `rebuild` rebuilds the image when `package.json` changes (since that requires a fresh `npm ci`).
    - `db` no longer has a `ports` mapping — app-to-db traffic stays on the Docker network via the hostname `db`.

## Start the dev environment with Watch mode

4. Click into the **taskflow-app** terminal (where `node src/app.js` is running) and press `Ctrl+C` to stop the process.

5. Stop the remaining Compose services:

    ```bash
    docker compose down
    ```

5. Start the full stack with Compose Watch:

    ```bash terminal-id=compose-watch
    docker compose watch
    ```

    Compose builds the `development` image (first run takes a moment), starts all three services, and enters watch mode. Once you see `TaskFlow API listening on port 3000`, the environment is ready.

## See the live sync in action

6. Open :fileLink[src/app.js]{path="src/app.js" line=7} in the editor and add a `version` field to the health response:

    Change:
    ```javascript no-run-button
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    ```

    To:
    ```javascript no-run-button
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', version: '1.0.0' });
    });
    ```

    Save the file. Watch the `compose-watch` terminal — you'll see Compose sync the file and nodemon restart the app in a matter of seconds, without any manual intervention.

7. Verify the change is live:

    ```bash terminal-id=shell
    curl -s http://localhost:3000/health
    ```

    Expected output:
    ```json no-copy-button
    {"status":"ok","version":"1.0.0"}
    ```

## What you've got

The entire development stack — app, database, and visualizer — now runs in containers. Your local environment is a faithful replica of production. Any developer who clones the repo and runs `docker compose watch` gets the same environment immediately, with live-reload included.

In the next section, you'll write integration tests that spin up their own isolated database — no shared state, no manual setup required.
