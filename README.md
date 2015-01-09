## Google I/O 2015 web app

### Setup

1. `git clone https://github.com/GoogleChrome/ioweb2015.git`
2. `cd ioweb2015`
3. `npm install`
4. `gulp setup`

If you plan on modifying source code, be a good citizen and:

1. Install [EditorConfig plugin](http://editorconfig.org/#download) for your favourite browser.
   The plugin should automatically pick up the [.editorconfig](.editorconfig) settings.
2. Obey the pre-commit hook that's installed as part of `gulp setup`.
   It will check for JavaScript and code style errors before committing to the `master` branch.

To run a backend server you'll need:

1. [Go 1.4](https://golang.org/dl/).
2. Optional: [gcloud tool](https://cloud.google.com/sdk/#Quick_Start)
   and [app](https://cloud.google.com/sdk/gcloud-app#Installation) component
   to run and deploy GAE-based backend (hint: `gcloud components update app`).

### Running

Run `gulp serve` to start a standalone backend, while still enjoying live-reload.
You'll need Go for that.

You can also use GAE dev appserver by running `gulp serve:gae`. This is closer to what
we're using in our webapp environment but a bit slower on startup.
You'll need `gcloud` tool and `app` component to do this.

Both gulp tasks accept optional `--no-watch` argument in case you need to disable
file watchers and live reload.

### Building

Run `gulp`. This will create `dist` directory with both front-end and backend parts, ready for deploy.

You can also serve the build from `dist` by running `gulp serve:dist`,
and navigating to http://localhost:8080.

**Note**: Build won't succeed if either `gulp jshint` or `gulp jscs` reports errors.

### Deploying

To deploy complete application on App Engine:

1. Run `gulp` which will build both frontend and backend in `dist` directory.
2. Run `gcloud preview app deploy [--version <v>] dist/backend`.

## Backend

Backend is written in Go. It can run on either Google App Engine or any other platform as a standalone
binary program.

`gulp backend` will build a self-sufficient backend server and place the binary in `backend/bin/server`.

`gulp backend:test` will run backend server tests. If, while working on the backend, you feel tired
of running the command again and again, use `gulp backend:test --watch` to watch for file changes
and re-run tests automatically.


