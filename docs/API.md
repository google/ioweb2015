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

Event full schedule and other data.
See `app/temporary_api/schedule.json` for a sample response.


### GET /api/v1/user/notify

*Requires authentication*

Current notification state. Response body sample:

```json
{
  "notify": true,
  "subscribers": ["123456789", "987654321"]
}
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


### GET /api/v1/user/updates

*Authorization: Bearer _OAUTH2_ACCESS_TOKEN_* or *Authorization: _SW_TOKEN_*

Response body sample:

```json
{
  "sessions": {
    "0486a8f4-4acb-e311-b297-00155d5066d7": {
      "captionsUrl": "http://io-captions.appspot.com/?event=e1\u0026android=t",
      "color": "#0288d1",
      "description": "How do you make your cloud applications fast?",
      "endTimestamp": "2014-06-25T20:45:00Z",
      "hashtag": "Cloud",
      "id": "0486a8f4-4acb-e311-b297-00155d5066d7",
      "isLivestream": false,
      "mainTag": "TOPIC_CLOUDSERVICES",
      "photoUrl": "http://storage.googleapis.com/iosched-updater-dev.appspot.com/images/sessions/__w-200-400-600-800-1000__/0486a8f4-4acb-e311-b297-00155d5066d7.jpg",
      "relatedContent": "4y4-xn4Vi04 Command Your Cloud with gCloud\nqdyNKNt2XLY Optimizing disk I/O in the cloud\nDWpBNm6lBU4 Putting Google's Network to work for You\nQ8jZHc0NS6A Building node.js applications with App Engine and Custom Runtimes\n",
      "room": "room1",
      "speakers": [
        "afb30576-a1cc-e311-b297-00155d5066d7",
        "b7139c80-8de2-e311-b297-00155d5066d7"
      ],
      "startTimestamp": "2014-06-25T20:00:00Z",
      "tags": [
        "TYPE_SESSIONS",
        "THEME_DEVELOP",
        "TOPIC_CLOUDSERVICES"
      ],
      "title": "Making your cloud apps Google-fast",
      "url": "https://www.google.com/events/io/schedule/session/0486a8f4-4acb-e311-b297-00155d5066d7",
      "youtubeUrl": "https://youtu.be/7jm6wINhWDI"
    }
  },
  "videos": {... new/updated video objects? ...},
  "ioext": [
    {
      "name": "I/O Extended 2015 - San Francisco",
      "link": "https://plus.google.com/events/cviqm849n5smqepqgqn2lut99bk",
      "city": "San Francisco",
      "lat": 37.7552464,
      "lng": -122.4185384
    }
  ],
  "token": "use this token for the next request"
}
```

If the `Authorization` header is set to a valid OAuth 2 token, then the response will come back with
just the `token` field populated, for use in the next request.
If `Authorization` header is set to an SW token, then the response will come back with fields
set for all the updated resources. Additionally, the `token` field will be populated, for use in
the next request.


### GET /api/v1/user/schedule

*Requires authentication*

Returns bookmarked sessions list of a user.

```json
[
  "6D752F30-3EB9-4014-8281-CBD28FD33B5A",
  "05012279-E037-46D1-AD91-C0892277B01B"
]
```


### PUT /api/v1/user/schedule/:session_id

*Requires authentication*

Add a session to the bookmarks list.


### DELETE /api/v1/user/schedule/:session_id

*Requires authentication*

Delete a session from the list.


[signin-guide]: https://developers.google.com/identity/sign-in/web/server-side-flow
[sign-in-the-user]: https://developers.google.com/identity/sign-in/web/server-side-flow#step_5_sign_in_the_user
