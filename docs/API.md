# IOWA 2015 API

Backend API for I/O 2015 web app.


## Authentication

All endpoints which require authentication expect the following request header:

```
Authorization: Bearer <ID or access token>
```

ID/access token in the header is what uniquely identifies a user.
It should be obtained by following [Google Sign In 2.0 guide][signin-guide]
for hybrid server-side flow.

As soon as a [user signs in][sign-in-the-user], the front-end makes the following request:

```
POST /api/v1/auth

Authorization: Bearer <ID or access token>
Content-Type: application/json

{"code": "one-time authorization code from hybrid server-side flow"}
```

This completes the authentication flow.


## Handling responses

All API endpoints expect and respond with `application/json` mime type.

Successful calls always result in a `2XX` response status code and an optional body,
if so indicated in the method description.

Unsuccessful calls are indicated by a response status code `4XX` or higher,
and may contain the following body:

```json
{"error": "A (hopefully) useful description of the error"}
```


## API endpoints

Unless specified, endpoints do not require authentication.


### GET /api/v1/social

Tweets from @googedevs, with the hash tag #io15. Response body sample:

```json
[
  {
    "kind":"tweet",
    "author":"@googledevs",
    "url":"https://twitter.com/googledevs/status/560575018925436931",
    "text":"Today on #Polycasts <with> @rob_dodson, con\nnect your UI to data...\nautomagically! https://t.co/0z0gUsWB2G",
    "when":"2015-02-04T20:07:54Z"
  },
  {
    "kind":"tweet",
    "author":"@googledevs",
    "url":"https://twitter.com/googledevs/status/540602593253142528",
    "text":"<script>Check out the new episode of #HTTP203, where @aerotwist & @jaffathecake talk about the horrors of font downloading. http://example.com",
    "when":"2015-01-17T20:24:36Z"
  }
]
```


### GET /api/v1/extended

I/O Extended event entries. Response body sample:

```json
[
  {
    "name": "I/O Extended 2015 - San Francisco",
    "link": "https://plus.google.com/events/cviqm849n5smqepqgqn2lut99bk",
    "city": "San Francisco",
    "lat": 37.7552464,
    "lng": -122.4185384
  },
  {
    "name": "I/O Extended 2015 - Amsterdam",
    "link": "https://plus.google.com/u/0/events/c5pv82ob8ihivlof4bu81s5f64c?e=-RedirectToSandbox",
    "city": "Amsterdam",
    "lat": 52.37607,
    "lng": 4.886114
  }
]

```


### GET /api/v1/schedule

Event full schedule. Response body sample:

```json
TBD
```


### PUT /api/v1/user/notify

*Requires authentication*

This serves double purpose:

* Toggle global notification state on/off for a single user.
  Request body:

  ```json
  {"notify": true}
  ```

* Add to the subscriber IDs list of a user.
  Request body:

  ```json
  {"subscriber": "subscriber ID"}
  ```

You can also do both in a single API call:

```json
{
  "notify": true,
  "subscriber": "subscriber ID"
}
```

Note that in the latter case `notify` parameter still refers to
the global notification state scoped to a user, not a specific subscriber ID.


### PUT /api/v1/user/schedule/:session_id

*Requires authentication*

Add a session to the bookmarks list.


### DELETE /api/v1/user/schedule/:session_id

*Requires authentication*

Delete a session from the list.


[signin-guide]: https://developers.google.com/identity/sign-in/web/server-side-flow
[sign-in-the-user]: https://developers.google.com/identity/sign-in/web/server-side-flow#step_5_sign_in_the_user
