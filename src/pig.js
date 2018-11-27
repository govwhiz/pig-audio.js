(function(global) {
  'use strict';

  /**
   * This is a manager for our resize handlers. You can add a callback, disable
   * all resize handlers, and re-enable handlers after they have been disabled.
   *
   * optimizedResize is adapted from Mozilla code:
   * https://developer.mozilla.org/en-US/docs/Web/Events/resize
   */
  var optimizedResize = (function() {
    var callbacks = [];
    var running = false;

    // fired on resize event
    function resize() {
      if (!running) {
        running = true;
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(runCallbacks);
        } else {
          setTimeout(runCallbacks, 66);
        }
      }
    }

    // run the actual callbacks
    function runCallbacks() {
      callbacks.forEach(function(callback) {
        callback();
      });

      running = false;
    }

    return {
      /**
       * Add a callback to be run on resize.
       *
       * @param {function} callback - the callback to run on resize.
       */
      add: function(callback) {
        if (!callbacks.length) {
          window.addEventListener('resize', resize);
        }

        callbacks.push(callback);
      },

      /**
       * Disables all resize handlers.
       */
      disable: function() {
        window.removeEventListener('resize', resize);
      },

      /**
       * Enables all resize handlers, if they were disabled.
       */
      reEnable: function() {
        window.addEventListener('resize', resize);
      },
    };
  }());


  function _injectStyle(containerId, classPrefix, transitionSpeed, trackHeight) {
    var css = (
      '#' + containerId + ' {' +
      '  position: relative;' +
      '}' +
      '.' + classPrefix + '-figure {' +
      '  overflow: hidden;' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  margin: 0;' +
      '}' +
      '.' + classPrefix + '-figure .track-list-item {' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  line-height: ' + trackHeight + 'px;' +
      '  height: '+ trackHeight + 'px;' +
      '  width: 100%;' +
      '  transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '  -webkit-transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '}'
    );

    var head = document.head || document.getElementsByTagName("head")[0];
    var style = document.createElement("style");

    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    head.appendChild(style);
  }


  function _extend(obj1, obj2) {
    for (var i in obj2) {
      if (obj2.hasOwnProperty(i)) {
        obj1[i] = obj2[i];
      }
    }
  }


  function PigAudio(audioData, options) {
    // Global State
    this.inRAF = false;
    this.isTransitioning = false;
    this.latestYOffset = 0;
    this.scrollDirection = 'down';

    // List of audios that are loading or completely loaded on screen.
    this.visibleAudios = [];

    // These are the default settings, which may be overridden.
    this.settings = {
      containerId:                'pig-audio',
      classPrefix:                'pig-audio',
      figureTagName:              'figure',
      trackHeight:                50,
      spaceBetweenAudios:         1,
      transitionSpeed:            500,
      primaryAudioBufferHeight:   1000,
      secondaryAudioBufferHeight: 300,


      urlForAudio: function(fileUrl) {
        return fileUrl;
      }
    };

    // We extend the default settings with the provided overrides.
    _extend(this.settings, options || {});

    // Our global reference for audios in the grid.  Note that not all of these
    // audios are necessarily in view or loaded.
    this.elements = this._parseAudioData(audioData);

    // Inject our boilerplate CSS.
    _injectStyle(
      this.settings.containerId,
      this.settings.classPrefix,
      this.settings.transitionSpeed,
      this.settings.trackHeight
    );

    // Allows for chaining with `enable()`.
    return this;
  }


  PigAudio.prototype._getTransitionTimeout = function() {
    var transitionTimeoutScaleFactor = 1.5;
    return this.settings.transitionSpeed * transitionTimeoutScaleFactor;
  };


  PigAudio.prototype._getTransitionString = function() {
    if (this.isTransitioning) {
      return (this.settings.transitionSpeed / 1000) + 's transform ease';
    }

    return 'none';
  };


  PigAudio.prototype._parseAudioData = function (audioData) {
    var progressiveElements = [],
        titleIndex = 0;

    audioData.forEach(function (audio, index) {
      var progressiveAudio = new ProgressiveAudio(audio, index, this);
      progressiveElements.push(progressiveAudio);
    }.bind(this));

    return progressiveElements;
  };


  PigAudio.prototype._computeLayout = function() {
    // Constants
    var wrapperWidth = parseInt(this.container.clientWidth);

    var translateX = 0;
    var offsetTop = this.container.offsetTop - this.container.parentElement.offsetTop;
    var translateY = 0; // The current translateY value that we are at

    if (!this.isTransitioning) {
      this.isTransitioning = true;
      setTimeout(function() {
        this.isTransitioning = false;
      }, this._getTransitionTimeout());
    }

    // Get the valid-CSS transition string.
    var transition = this._getTransitionString();

    [].forEach.call(this.elements, function(el, index) {
      // This is NOT DOM manipulation.
      el.style = {
        width:      parseInt(wrapperWidth),
        height:     this.settings.trackHeight,
        translateX: translateX,
        translateY: translateY,
        scrollTo:   translateY + offsetTop,
        transition: transition,
      };

      translateY += this.settings.trackHeight + this.settings.spaceBetweenAudios;
    }.bind(this));

    // No space below the last audio
    this.totalHeight = translateY - this.settings.spaceBetweenAudios;
  };


  /**
   * get container total height
  **/
  PigAudio.prototype._setTotalHeight = function () {
    var translateY = 0; // The current translateY value that we are at

    [].forEach.call(this.elements, function (el, index) {
      translateY += this.settings.trackHeight + this.settings.spaceBetweenAudios;
    }.bind(this));

    // No space below the last audio
    this.totalHeight = translateY - this.settings.spaceBetweenAudios;
  };


  PigAudio.prototype._doLayout = function() {
    // Set the container height
    this.container.style.height = this.totalHeight + 'px';

    // Get the top and bottom buffers heights.
    var bufferTop =
      (this.scrollDirection === 'up') ?
      this.settings.primaryAudioBufferHeight :
      this.settings.secondaryAudioBufferHeight;
    var bufferBottom =
      (this.scrollDirection === 'down') ?
      this.settings.primaryAudioBufferHeight :
      this.settings.secondaryAudioBufferHeight;

    // Now we compute the location of the top and bottom buffers:
    var scrollElementHeight = this.scrollElement.offsetHeight;
    var minTranslateY = this.latestYOffset - bufferTop;
    var maxTranslateY = this.latestYOffset + scrollElementHeight + bufferBottom;

    this.elements.forEach(function(el) {
      if (el.style.scrollTo <= this.latestYOffset &&
          el.style.scrollTo + el.style.height >= this.latestYOffset) {
        window.name = el.submissionId;
      }

      if (el.style.scrollTo + el.style.height < minTranslateY ||
          el.style.scrollTo > maxTranslateY) {
        // Hide Element
        el.hide();
      } else {
        // Load Element
        el.load();
      }
    }.bind(this));
  };


  PigAudio.prototype._getOnScroll = function() {
    var _this = this;

    var onScroll = function() {
      var newYOffset = _this.scrollElement.scrollTop;
      _this.previousYOffset = _this.latestYOffset || newYOffset;
      _this.latestYOffset = newYOffset;
      _this.scrollDirection = (_this.latestYOffset > _this.previousYOffset) ? 'down' : 'up';

      // Call _this.doLayout, guarded by window.requestAnimationFrame
      if (!_this.inRAF) {
        _this.inRAF = true;
        window.requestAnimationFrame(function() {
          _this._doLayout();
          _this.inRAF = false;
        });
      }
    };

    return onScroll;
  };


  PigAudio.prototype.enable = function() {
    // Find the container to load audios into, if it exists.
    this.container = document.getElementById(this.settings.containerId);
    if (!this.container) {
      console.error('Could not find element with ID ' + this.settings.containerId);
      return;
    }

    this.scrollElement = this.container.parentElement;
    this.onScroll = this._getOnScroll();
    this.scrollElement.addEventListener('scroll', this.onScroll);

    this.onScroll();
    this._computeLayout();
    this._doLayout();

    optimizedResize.add(function() {
      this._computeLayout();
      this._doLayout();
    }.bind(this));

    return this;
  };


  PigAudio.prototype.disable = function() {
    this.scrollElement.removeEventListener('scroll', this.onScroll);
    optimizedResize.disable();
    return this;
  };


  PigAudio.prototype.updateAudio = function(audioData) {
    var addElements = this._parseAudioData(audioData);
    var submissionId = addElements[0].submissionId;
    var submissionPk = addElements[0].submissionPk;

    var pastIndex = null;
    var pastLength = 0;

    this.elements.forEach(function (el, index, elements) {
      var nextElement = elements[index + 1];

      // update element
      if(el.submissionId === submissionId) {
        pastLength++;

        if(pastIndex === null) {
          pastIndex = index;
        }

        // Hide Element
        el.hide();
      }

      // past element inside
      if(nextElement && submissionPk < el.submissionPk &&
         submissionPk > nextElement.submissionPk) {

        if(pastIndex === null) {
          pastIndex = index + 1;
        }
      }
    });

    if(pastIndex === null) {
      pastIndex = this.elements.length > 0 && (submissionPk - this.elements[0].submissionPk) > 0
        ? 0
        : this.elements.length;
    }

    Array.prototype.splice.apply(this.elements, [pastIndex, pastLength].concat(addElements));

    this._computeLayout();
    this._doLayout();
  };


  PigAudio.prototype.deleteAudio = function(submissionId) {
    var deleteIndex = null;
    var deletedLength = 0;

    this.elements.forEach(function (el, index) {
      if(el.submissionId === submissionId) {
        deletedLength++;

        if(deleteIndex === null) {
          deleteIndex = index;
        }

        // Hide Element
        el.hide();
      }
    });

    if(deleteIndex === null) {
      deleteIndex = 0;
    }

    this.elements.splice(deleteIndex, deletedLength);

    this._computeLayout();
    this._doLayout();
  };


  // ProgressiveAudio
  function ProgressiveAudio(singleAudioData, index, pig) {
    // Global State
    this.existsOnPage = false; // True if the element exists on the page.

    // Instance information
    this.duration = singleAudioData.duration; // Time Duration
    this.filename = singleAudioData.filename;  // Filename
    this.ordinal  = singleAudioData.ordinal;
    this.submissionId = singleAudioData.submissionId; // Submission Id
    this.submissionPk = singleAudioData.submissionPk; // Submission Pk
    this.index = index;  // The index in the list of audios

    // The PigAudio instance
    this.pig = pig;

    this.classNames = {
      figure: pig.settings.classPrefix + '-figure'
    };

    return this;
  }

  ProgressiveAudio.prototype.load = function() {
    this.existsOnPage = true;
    this._updateStyles();
    this.pig.container.appendChild(this.getElement());

    setTimeout(function() {
      if (!this.existsOnPage) {
        return;
      }

      // Show audio
      if (!this.audio) {
        var
          element       = this.getElement(),
          ordinalElem   = document.createElement('span'),
          contentElem   = document.createElement('div'),
          groupElem     = document.createElement('span'),
          filenameElem  = document.createElement('span'),
          durationElem  = document.createElement('div'),
          ordinalValue  = document.createTextNode(this.ordinal),
          groupValue    = document.createTextNode(this.submissionPk + ' - '),
          audioSrc      = this.pig.settings.urlForAudio(this.filename),
          filenameValue = document.createTextNode(audioSrc),
          durationValue = document.createTextNode(
            this.duration ? (this.duration.substr(0, 2) === '00'
              ? this.duration.substr(3, this.duration.length -1)
              : this.duration)
            : ''
          );

        this.audio = document.createElement('div');

        ordinalElem.className  = 'ordinal';
        contentElem.className  = 'content';
        groupElem.className    = 'group';
        filenameElem.className = 'filename';
        durationElem.className = 'duration';
        this.audio.className   = 'track-list-item';

        ordinalElem.appendChild(ordinalValue);
        groupElem.appendChild(groupValue);
        filenameElem.appendChild(filenameValue);
        contentElem.appendChild(groupElem);
        contentElem.appendChild(filenameElem);
        durationElem.appendChild(durationValue);

        this.audio.appendChild(ordinalElem);
        this.audio.appendChild(contentElem);
        this.audio.appendChild(durationElem);

        this.audio.addEventListener("click", function (event) {
          this.pig.settings.click(this.submissionId, this.filename);
        }.bind(this));

        element.appendChild(this.audio);
      }
    }.bind(this), 100);
  };

  /**
   * Removes the figure from the DOM, removes the audio, and
   * deletes the audio properties off of the
   * ProgressiveAudio object.
   */
  ProgressiveAudio.prototype.hide = function() {
    // Remove the audios from the element, so that if a user is scrolling super
    // fast, we won't try to load every audio we scroll past.
    if (this.getElement()) {
      if (this.audio) {
        this.getElement().removeChild(this.audio);
        delete this.audio;
      }
    }

    // Remove the audio from the DOM.
    if (this.existsOnPage) {
      this.pig.container.removeChild(this.getElement());
    }

    this.existsOnPage = false;

  };

  /**
   * Get the DOM element associated with this ProgressiveAudio. We default to
   * using this.element, and we create it if it doesn't exist.
   *
   * @returns {HTMLElement} The DOM element associated with this instance.
   */
  ProgressiveAudio.prototype.getElement = function() {
    if (!this.element) {
      this.element = document.createElement(this.pig.settings.figureTagName);
      this.element.className = this.classNames.figure;
      this._updateStyles();
    }

    return this.element;
  };

  /**
   * Updates the style attribute to reflect this style property on this object.
   */
  ProgressiveAudio.prototype._updateStyles = function() {
    this.getElement().style.transition = this.style.transition;
    this.getElement().style.width = this.style.width + 'px';
    this.getElement().style.height = this.style.height + 'px';
    this.getElement().style.transform = (
      'translate3d(' + this.style.translateX + 'px,' +
        this.style.translateY + 'px, 0)');
  };

  // Export PigAudio into the global scope.
  if (typeof define === 'function' && define.amd) {
    define(PigAudio);
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = PigAudio;
  } else {
    global.PigAudio = PigAudio;
  }

}(this));
