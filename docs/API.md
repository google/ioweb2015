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
  "subscribers": ["123456789", "987654321"],
  "ioext": {
    "name": "Amsterdam",
    "lat": 52.37607,
    "lng": 4.886114
  }
}
```

`ioext` will be `null` or not present at all if I/O Extended notifications are not enabled.


### PUT /api/v1/user/notify

*Requires authentication*

* Toggle global notification state on/off: `notify`.
* Add to the subscriber IDs list of a user: `subscriber` and `endpoint`.
* Subscribe/unsubscribe from "I/O Extended events near me": `ioext`.

```json
{
  "notify": true,
  "subscriber": "subscriber ID",
  "endpoint": "https://push/notifications/endpoint",
  "ioext": {
    "name": "Amsterdam",
    "lat": 52.37607,
    "lng": 4.886114
  }
}
```

All fields are optional. Endpoint defaults to [GCM][gcm].
Subscriber and endpoint are usually obtained from the [PushRegistration][push-api-reg].

`ioext` will notify users about I/O Extended events happening within 80km of the specified location.
To turn off these notifications, nullify the `ioext` field:

```json
{"ioext": null}
```

Note that `notify` always refers to the global notification state scoped to a user,
not a specific subscriber ID.


### GET /api/v1/user/updates

*Authorization: Bearer _OAUTH2_ACCESS_TOKEN_* or *Authorization: _SW_TOKEN_*

Response body sample:

```json
{
  "sessions": {
    "0486a8f4-4acb-e311-b297-00155d5066d7": {
      "id": "0486a8f4-4acb-e311-b297-00155d5066d7",
      "title": "Making your cloud apps Google-fast",
      "description": "How do you make your cloud applications fast?",
      "startTimestamp": "2014-06-25T20:00:00Z",
      "endTimestamp": "2014-06-25T20:45:00Z",
      "isLivestream": false,
      "photoUrl": "http://storage.googleapis.com/iosched-updater-dev.appspot.com/images/sessions/__w-200-400-600-800-1000__/0486a8f4-4acb-e311-b297-00155d5066d7.jpg",
      "room": "Room 42",
      "speakers": [
        "afb30576-a1cc-e311-b297-00155d5066d7",
        "b7139c80-8de2-e311-b297-00155d5066d7"
      ],
      "tags": [
        "TYPE_SESSIONS",
        "THEME_DEVELOP",
        "TOPIC_CLOUDSERVICES"
      ],
      "youtubeUrl": "https://youtu.be/7jm6wINhWDI",
      "update": "details"
    }
  },
  "videos": {
    "naf_WbtFAlY": {
      "thumbnailUrl": "http://img.youtube.com/vi/naf_WbtFAlY/hqdefault.jpg",
      "id": "naf_WbtFAlY",
      "title": "Fullscreen Apps for Android Wear",
      "desc": "Learn how to write beautiful apps outside the stream on Android Wear, with a focus on how users leave apps and how to design for a round screen.",
      "year": 2014,
      "topic": "Android",
      "speakers": "Michael Kolb, Will Brown"
    }
  },
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

`update` field in the session objects can have one of the following values:

* `details`: any/all session fields have changed.
* `video`: `youtubeUrl` field is changed.
* `start`: the session is about to start. this includes the keynote.

`videos` section contains other videos, potentially not related to sessions, e.g. dev bytes.

`ioext` section contains new locations for I/O Extended events.

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

Add a session to the bookmarks list. Response is the altered bookmarks list:

```json
[
  "6D752F30-3EB9-4014-8281-CBD28FD33B5A",
  "05012279-E037-46D1-AD91-C0892277B01B",
  "newly-added-session-id"
]
```


### DELETE /api/v1/user/schedule/:session_id

*Requires authentication*

Delete a session from the list. Response is the altered bookmarks list:

```json
[
  "6D752F30-3EB9-4014-8281-CBD28FD33B5A"
]
```



[signin-guide]: https://developers.google.com/identity/sign-in/web/server-side-flow
[sign-in-the-user]: https://developers.google.com/identity/sign-in/web/server-side-flow#step_5_sign_in_the_user
[push-api-reg]: http://www.w3.org/TR/push-api/#idl-def-PushRegistration
[gcm]: https://developer.android.com/google/gcm/index.html
