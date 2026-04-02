# Labspace - Containers Across the SDLC

Build a real Node.js API, then containerize every stage of your software development lifecycle — local development, integration testing, CI/CD, and Kubernetes deployment. Experience the power that containers provide across the entire SDLC.

## Learning objectives

This Labspace will have you do the following:

- Set up a containerized development environment
- Use Testcontainers to use containers in integration testing
- Setup a CI/CD pipeline that will run your tests and build your image
- Define Kubernetes manifest files 

## Launch the Labspace

To launch the Labspace, run the following command:

```bash
docker compose -f oci://dockersamples/labspace-containerized-sdlc up -d
```

And then open your browser to http://dockerlabs.xyz.

### Using the Docker Desktop extension

If you have the Labspace extension installed (`docker extension install dockersamples/labspace-extension` if not), you can also [click this link](https://open.docker.com/dashboard/extension-tab?extensionId=dockersamples/labspace-extension&location=dockersamples/labspace-containerized-sdlc&title=Containerized%20SDLC%20Demo) to launch the Labspace.

## Contributing

If you find something wrong or something that needs to be updated, feel free to submit a PR. If you want to make a larger change, feel free to fork the repo into your own repository.

**Important note:** If you fork it, you will need to update the GHA workflow to point to your own Hub repo.

1. Clone this repo

2. Start the Labspace in content development mode:

    ```bash
    # On Mac/Linux
    CONTENT_PATH=$PWD docker compose up --watch

    # On Windows with PowerShell
    $Env:CONTENT_PATH = (Get-Location).Path; docker compose up --watch
    ```

3. Open the Labspace at http://dockerlabs.xyz.

4. Make the necessary changes and validate they appear as you expect in the Labspace

    Be sure to check out the [docs](https://github.com/dockersamples/labspace-infra/tree/main/docs) for additional information and guidelines.
