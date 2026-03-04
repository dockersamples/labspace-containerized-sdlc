# Continuous Integration with Gitea Actions

You have a working local dev environment and a test suite that verifies the app against a real database. Now it's time to automate all of that and produce a container image that can be deployed anywhere.

This lab environment includes **Gitea** — a self-hosted Git service with built-in Actions (compatible with GitHub Actions syntax). It also includes a local **container registry** at `registry.dockerlabs.xyz`. Your code is already checked into Gitea; you just need to write the pipeline.

## Verify the Gitea remote

1. Confirm the git remote is already configured:

    ```bash
    git remote -v
    ```

    You should see `origin` pointing to `http://git.dockerlabs.xyz/moby/demo-app.git`.

2. :tabLink[Open Gitea]{href="http://git.dockerlabs.xyz/moby/demo-app" title="Gitea" id="gitea"} to see the current state of the repository:

    Log in with **moby** / **moby1234** if prompted.

## Write the CI workflow

The pipeline will:
1. Check out the code
2. Install dependencies
3. Run the integration tests (Testcontainers will start a real Postgres inside the CI runner)
4. Build the container image using `docker/build-push-action`
5. Push the image to the local registry

3. Create a file named `.gitea/workflows/ci.yaml` with the following contents:

    ```yaml save-as=.gitea/workflows/ci.yaml
    name: CI/CD Pipeline

    on:
      push:
        branches:
          - main

    jobs:
      test-and-build:
        runs-on: ubuntu-latest

        steps:
          - name: Checkout code
            uses: actions/checkout@v4

          - name: Set up Node.js
            uses: actions/setup-node@v4
            with:
              node-version: '24'

          - name: Install dependencies
            run: npm ci

          - name: Run integration tests
            run: npm test

          - name: Set up Docker Buildx
            uses: docker/setup-buildx-action@v3
            with:
              config-inline: |
                # Skip TLS verification for the lab's local registry — not needed for real registries
                [registry."registry.dockerlabs.xyz"]
                  insecure = true

          - name: Log in to container registry
            uses: docker/login-action@v3
            with:
              registry: ${{ secrets.DOCKER_REGISTRY }}
              username: ${{ secrets.DOCKER_USERNAME }}
              password: ${{ secrets.DOCKER_PASSWORD }}

          - name: Build and push container image
            uses: docker/build-push-action@v5
            with:
              push: true
              target: production
              tags: ${{ secrets.DOCKER_REGISTRY }}/moby/demo-app:latest
    ```

    > [!NOTE]
    > The `DOCKER_REGISTRY`, `DOCKER_USERNAME`, and `DOCKER_PASSWORD` secrets are pre-configured in Gitea for the `moby/demo-app` repository. They point at the local registry (`registry.dockerlabs.xyz`).

## Commit and push

Now you'll commit everything you've created — the Compose file, the tests, the workflow, and the lock file — and push to Gitea.

4. Check what's new:

    ```bash
    git status
    ```

    You should see `compose.yaml`, `test/tasks.test.js`, `.gitea/workflows/ci.yaml`, and `package-lock.json` as untracked or modified files.

5. Stage all files:

    ```bash
    git add .
    ```

6. Commit:

    ```bash
    git commit -m "feat: add compose, integration tests, and CI pipeline"
    ```

7. Push to Gitea:

    ```bash
    git push
    ```

## Watch the pipeline run

8. :tabLink[Open Gitea Actions]{href="http://git.dockerlabs.xyz/moby/demo-app/actions" title="Gitea" id="gitea"}. You should see a workflow run triggered by your push. 

    Click into it to watch the steps execute in real time.

    > [!NOTE]
    > The `Run integration tests` step starts a PostgreSQL container inside the CI runner — the same Testcontainers code you just wrote runs unchanged in CI. That's the portability of the approach.

9. Wait for the pipeline to complete successfully (all steps green ✅). This may take a few 3-5 minutes.

## Confirm the image was pushed

10. Once the pipeline succeeds, verify the image is in the registry:

    ```bash
    curl -s http://registry.dockerlabs.xyz/v2/moby/demo-app/tags/list
    ```

    Expected output:
    ```json no-copy-button
    {"name":"moby/demo-app","tags":["latest"]}
    ```

## What you've got

Every push to `main` now:
- Runs your full integration test suite against a real database
- Builds a container image from the `Dockerfile`
- Pushes that image to a registry where Kubernetes can pull it

The image is the artifact of your SDLC. Next: deploy it.
