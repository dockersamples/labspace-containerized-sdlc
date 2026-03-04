# Deploying to Kubernetes

The CI pipeline pushed a container image to the local registry. Now you'll deploy that image — along with a PostgreSQL database — to the k3s Kubernetes cluster running in this lab environment.

Kubernetes manifests are YAML files that declare the desired state of your cluster. You'll write three resources and then wire up the CI pipeline to deploy them automatically:

- **PostgreSQL Deployment + Service** — the database for the production environment
- **TaskFlow Deployment** — your app, pulling the image from `registry.dockerlabs.xyz`
- **Service + Ingress** — to expose the app at `http://app.dockerlabs.xyz` via Traefik

## Verify the cluster

1. Confirm the cluster is running:

    ```bash
    kubectl get nodes
    ```

    You should see a node with status `Ready`.

2. Check what's already running in the cluster:

    ```bash
    kubectl get pods -A
    ```

    You'll see system pods for Traefik (the ingress controller), CoreDNS, and other k3s components. The cluster is ready for your workloads.

## Write the database manifest

3. Create a file named `k8s/postgres.yaml` with the following contents:

    ```yaml save-as=k8s/postgres.yaml
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: taskflow-db
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: taskflow-db
      template:
        metadata:
          labels:
            app: taskflow-db
        spec:
          containers:
            - name: postgres
              image: postgres:18-alpine
              env:
                - name: POSTGRES_DB
                  value: taskflow
                - name: POSTGRES_USER
                  value: postgres
                - name: POSTGRES_PASSWORD
                  value: postgres
              ports:
                - containerPort: 5432
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: taskflow-db
    spec:
      selector:
        app: taskflow-db
      ports:
        - port: 5432
          targetPort: 5432
    ```

## Write the application manifest

4. Create a file named `k8s/app.yaml` with the following contents:

    ```yaml save-as=k8s/app.yaml
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: taskflow
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: taskflow
      template:
        metadata:
          labels:
            app: taskflow
        spec:
          containers:
            - name: taskflow
              image: registry.dockerlabs.xyz/moby/demo-app:latest
              ports:
                - containerPort: 3000
              env:
                - name: DB_HOST
                  value: taskflow-db
                - name: DB_NAME
                  value: taskflow
                - name: DB_USER
                  value: postgres
                - name: DB_PASSWORD
                  value: postgres
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: taskflow
    spec:
      selector:
        app: taskflow
      ports:
        - port: 80
          targetPort: 3000
    ---
    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: taskflow
      annotations:
        traefik.ingress.kubernetes.io/router.entrypoints: web
    spec:
      rules:
        - host: app.dockerlabs.xyz
          http:
            paths:
              - path: /
                pathType: Prefix
                backend:
                  service:
                    name: taskflow
                    port:
                      number: 80
    ```

    Notice that:
    - `DB_HOST` is `taskflow-db` — the Kubernetes Service name. Kubernetes provides DNS resolution for Services within the cluster.
    - The Ingress routes traffic from `app.dockerlabs.xyz` (via Traefik) to the `taskflow` Service on port 80, which forwards to the container's port 3000.

## Deploy to the cluster

5. Apply both manifests:

    ```bash
    kubectl apply -f k8s/
    ```

6. Watch the pods come up:

    ```bash
    kubectl get pods -w
    ```

    Wait until both `taskflow-db-*` and `taskflow-*` pods show `Running` status. Press `Ctrl+C` to stop watching.

    > [!NOTE]
    > The `taskflow-*` pod may cycle through `Error` or `CrashLoopBackOff` a time or two while the database is still initializing. Kubernetes will automatically restart it — once `taskflow-db-*` is fully ready, the app pod will come up cleanly on the next attempt.

7. Check that the app's pod started cleanly:

    ```bash
    kubectl logs -l app=taskflow
    ```

    You should see: `TaskFlow API listening on port 3000`

## Access the deployed app

8. Try the API through Traefik:

    ```bash
    curl -s http://app.dockerlabs.xyz/health
    ```

    ```bash
    curl -s -X POST http://app.dockerlabs.xyz/api/tasks \
      -H "Content-Type: application/json" \
      -d '{"title":"Deploy to Kubernetes","description":"Successfully deployed the containerized SDLC demo"}'
    ```

    ```bash
    curl -s http://app.dockerlabs.xyz/api/tasks
    ```

9. Go to :tabLink[http://app.dockerlabs.xyz/api/tasks]{href="http://app.dockerlabs.xyz/api/tasks" title="Deployed App" id="deployed-app"} to view the app in the browser.


## Automate deployments via CI

The app is running — but right now you'd have to re-run `kubectl apply` manually every time a new image is pushed. You can close that gap by adding a `deploy` job to the CI pipeline that runs automatically after a successful build.

10. Update `.gitea/workflows/ci.yaml` with the following, which adds the `deploy` job:

    ```yaml save-as=.gitea/workflows/ci.yaml highlight=49-69
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

      deploy:
        needs: test-and-build
        runs-on: ubuntu-latest

        steps:
          - name: Checkout code
            uses: actions/checkout@v4

          - name: Set up kubectl
            uses: azure/setup-kubectl@v4

          - name: Set kubectl context
            uses: azure/k8s-set-context@v4
            with:
              kubeconfig: ${{ secrets.KUBECONFIG }}

          - name: Apply manifests
            run: kubectl apply -f k8s/app.yaml

          - name: Restart deployment to pull new image
            run: kubectl rollout restart deployment/taskflow
    ```

    The `deploy` job:
    - Runs only after `test-and-build` succeeds (`needs: test-and-build`)
    - Uses the pre-configured `KUBECONFIG` secret to authenticate with the k3s cluster
    - Applies the manifest (in case anything changed) then triggers a rollout restart — since the image is tagged `latest`, Kubernetes always pulls on pod creation, so the restart guarantees the new image is used

11. Commit everything — the manifests and the updated pipeline:

    ```bash
    git add k8s/ .gitea/workflows/ci.yaml
    git commit -m "feat: add k8s manifests and automated deployment"
    git push
    ```

12. :tabLink[Open Gitea Actions]{href="http://git.dockerlabs.xyz/moby/demo-app/actions" title="Gitea" id="gitea"} and watch the pipeline run. This time you'll see two jobs: `test-and-build` followed by `deploy`.

13. Once `deploy` completes, confirm the rollout finished cleanly:

    ```bash
    kubectl rollout status deployment/taskflow
    ```

## What you've got

TaskFlow is running on Kubernetes and every push to `main` now automatically tests, builds, and deploys — no manual `kubectl` commands required. The manifests live alongside the application code, making the deployment version-controlled and reproducible by anyone with cluster access.

In the final section, you'll step back and look at what the complete containerized SDLC actually means.
