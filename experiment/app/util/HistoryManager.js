module.exports = (function() {
  'use strict';

  /**
   * Central point for app-wide serializable state.
   * @constructor
   */
  return function HistoryManager() {
    var onOpenInstrumentCallback_;
    var onReturnToRootCallback_;
    var onCloseExperimentCallback_;

    var self = {
      onOpenInstrument,
      onReturnToRoot,
      onCloseExperiment,
      setState,
      pushState,
      init,
      tearDown,
      goBack
    };

    function onOpenInstrument(cb) {
      onOpenInstrumentCallback_ = cb;
    }

    function onReturnToRoot(cb) {
      onReturnToRootCallback_ = cb;
    }

    function onCloseExperiment(cb) {
      onCloseExperimentCallback_ = cb;
    }

    function setState(state) {
      history.replaceState({
        fromHashChange: true
      }, null, state);
    }

    function pushState(state) {
      history.pushState({
        fromHashChange: true
      }, null, state);
    }

    function goBack() {
      history.back();
    }

    function onHistoryChange() {
      if (document.location.hash === '#playing') {
        if ('function' === typeof onReturnToRootCallback_) {
          setTimeout(onReturnToRootCallback_, 50);
        }

        return;
      }

      var editingRegex = document.location.hash.match(/\#editing-(.*)/);

      if (editingRegex) {
        var editingPid = parseInt(editingRegex[1], 10);

        if (!isNaN(editingPid)) {
          setTimeout(onOpenInstrumentCallback_.bind(null, editingPid), 50);
        }

        return;
      }

      if (document.location.hash === '') {
        if ('function' === typeof onCloseExperimentCallback_) {
          setTimeout(onCloseExperimentCallback_, 50);
        }
      }
    }

    function init() {
      window.addEventListener('popstate', onHistoryChange);
    }

    function tearDown() {
      window.removeEventListener('popstate', onHistoryChange);
    }

    return self;
  };
})();
