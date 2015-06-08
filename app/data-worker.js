/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Scripts required for execution (included by generate-data-worker gulp tasks):
// bower_components/es6-promise/dist/es6-promise.min.js
// scripts/helper/request.js
// scripts/helper/schedule.js

var schedulePromise = IOWA.Schedule.fetchSchedule();

addEventListener('message', function(e) {

  switch (e.data.cmd) {
    case 'FETCH_SCHEDULE':
      schedulePromise.then(function(scheduleData) {
        var tags = IOWA.Schedule.generateFilters(scheduleData.tags);

        // Mark the first session in each block.
        var currentBlock;
        var currentBlockForLivestream;
        for (var i = 0, session; session = scheduleData.sessions[i]; ++i) {
          if (session.block !== currentBlock) {
            session.firstOfBlock = true;
            currentBlock = session.block;
          }
          if (session.block !== currentBlockForLivestream && session.isLivestream) {
            session.firstOfBlockForLivestream  = true;
            currentBlockForLivestream = session.block;
          }
        }

        postMessage({scheduleData: scheduleData, tags: tags});

        self.close(); // Terminate worker.
      });

      break;

    default:
      break;
  }

});
