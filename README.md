## Google I/O 2015 web app

### Setup

1. `git clone https://github.com/GoogleChrome/ioweb2015.git`
2. `cd ioweb2015/app`
3. `bower install`
4. `npm install`

### Running

Start a web server in `app/` or server via App Engine dev server.

**Note**: You have to run `gulp` or `gulp compass` at least once to generate CSS from the .scss files.

### Building

Run `gulp`. Then hit `http://localhost:<PORT>/dist/app/`. The unbuilt version is still viewable at `http://localhost:<PORT>/app/` but will not contain minfied JS or vulcanized HTML Imports. 
