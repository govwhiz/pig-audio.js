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


  function _injectStyle(containerId, classPrefix, transitionSpeed, groupTitleHeight, audioHeight) {

    var css = (
      'body {' + 
      '  overflow-y: scroll;' +
      '}' + 
      '#' + containerId + ' {' +
      '  position: relative;' +
      '}' +
      '.' + classPrefix + '-figure {' +
      '  background-color: #D5D5D5;' +
      '  overflow: hidden;' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  margin: 0;' +
      '}' +
      '.' + classPrefix + '-figure-title {' +
      '  background-color: transparent;' +
      '}' +
      '.' + classPrefix + '-figure h1 {' +
      '  font-size: 21px;' +
      '  margin: 0 15px;' +
      '  line-height: ' + groupTitleHeight + 'px;' +
      '  color: rgba(0, 0, 0, 0.9);' +
      '  text-transform: uppercase;' +
      '  font-family: keepcalm, "Helvetica Neue", Helvetica, Arial, sans-serif;' +
      '  background-color: transparent;' +
      '}' +
      '.' + classPrefix + '-figure span {' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  height: '+ audioHeight + 'px;' +
      '  width: 100%;' +
      '  text-shadow: 1px 1px 3px black, -1px -1px 3px black;' +
      '  transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '  -webkit-transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '}' +
      '.' + classPrefix + '-figure span.' + classPrefix + '-loaded {' +
      '  left: auto;' +
      '  position: relative;' +
      '  width: auto;' +
      '  text-shadow: none;' +
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


  function _getOffsetTop(elem){
      var offsetTop = 0;
      do {
        if (!isNaN(elem.offsetTop)){
            offsetTop += elem.offsetTop;
        }
        elem = elem.offsetParent;
      } while(elem);
      return offsetTop;
  }


  function _loadAudio(url, success, error) {
    var
      progressiveAudio = this,
      xhr              = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if(xhr.readyState == 4 && xhr.status == 200) {
        var reader = new FileReader();
        reader.onloadend = function() {
          success.call(progressiveAudio, reader.result);
        };
        reader.readAsDataURL(xhr.response);
      } else if(xhr.readyState == 4 && xhr.status !== 200) {
        error.call(progressiveAudio, xhr.status);
      }
    };
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.send();
  }


  function PigAudio(audioData, options) {
    // Global State
    this.inRAF = false;
    this.isTransitioning = false;
    this.latestYOffset = 0;
    this.lastWindowWidth = window.innerWidth;
    this.scrollDirection = 'down';

    // List of audios that are loading or completely loaded on screen.
    this.visibleAudios = [];

    // These are the default settings, which may be overridden.
    this.settings = {
      containerId:                'pig-audio',
      classPrefix:                'pig-audio',
      figureTagName:              'figure',
      groupTitleHeight:           100,
      audioHeight:                50,
      spaceBetweenAudios:         8,
      transitionSpeed:            500,
      primaryAudioBufferHeight:   1000,
      secondaryAudioBufferHeight: 300,


      urlForAudio: function(filename, size) {
        return '/audio/' + filename;
      }
    };

    // We extend the default settings with the provided overrides.
    _extend(this.settings, options || {});

    // Our global reference for images in the grid.  Note that not all of these
    // images are necessarily in view or loaded.
    this.elements = this._parseAudioData(audioData);

    // Inject our boilerplate CSS.
    _injectStyle(
      this.settings.containerId,
      this.settings.classPrefix,
      this.settings.transitionSpeed,
      this.settings.groupTitleHeight,
      this.settings.audioHeight
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
      if(index === 0) {
        createTitleData.call(this, audio);
      }

      var progressiveAudio = new ProgressiveAudio(audio, index, this);
      progressiveElements.push(progressiveAudio);

      if (audioData[index + 1] && audio[this.settings.groupKey] !== audioData[index + 1][this.settings.groupKey]) {
        createTitleData.call(this, audioData[index + 1]);
      }


      function createTitleData(titleData) {
        var title = {
          sessionId:    titleData.sessionId, // Session Id
          submissionId: titleData.submissionId // Submission Id
        },
        progressiveTitle = new ProgressiveTitle(title, titleIndex, this);

        titleIndex++;

        progressiveElements.push(progressiveTitle);
      }

    }.bind(this));

    return progressiveElements;
  };


  PigAudio.prototype._computeLayout = function() {
    // Constants
    var wrapperWidth = parseInt(this.container.clientWidth);

    var translateX = 0;
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
      // ProgressiveTitle
      if(el instanceof ProgressiveTitle) {
        // This is NOT DOM manipulation.
        el.style = {
          height:     this.settings.groupTitleHeight,
          translateX: translateX,
          translateY: translateY,
          transition: transition,
        };

        translateY += this.settings.groupTitleHeight + this.settings.spaceBetweenAudios;

      // ProgressiveAudio
      } else if (el instanceof ProgressiveAudio) {
        // This is NOT DOM manipulation.
        el.style = {
          width:      parseInt(wrapperWidth),
          height:     this.settings.audioHeight,
          translateX: translateX,
          translateY: translateY,
          transition: transition,
        };

        translateY += this.settings.audioHeight + this.settings.spaceBetweenAudios;
      }

    }.bind(this));

    // No space below the last image
    this.totalHeight = translateY - this.settings.spaceBetweenAudios;
  };


  /**
   * get container total height
  **/
  PigAudio.prototype._setTotalHeight = function() {
    var translateY = 0; // The current translateY value that we are at

    [].forEach.call(this.elements, function(el, index) {
      // ProgressiveTitle
      if(el instanceof ProgressiveTitle) {
        translateY += this.settings.groupTitleHeight + this.settings.spaceBetweenAudios;

      // ProgressiveAudio
      } else if (el instanceof ProgressiveAudio) {
        translateY += this.settings.audioHeight + this.settings.spaceBetweenAudios;
      }

    }.bind(this));

    // No space below the last image
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
      this.settings.secondaryAudioBufferHeight :
      this.settings.primaryAudioBufferHeight;

    // Now we compute the location of the top and bottom buffers:
    var containerOffset = _getOffsetTop(this.container);
    var windowHeight = window.innerHeight;
    var minTranslateYPlusHeight = this.latestYOffset - containerOffset - bufferTop;
    var maxTranslateY = this.latestYOffset - containerOffset + windowHeight + bufferBottom;

    this.elements.forEach(function(el) {
      if (containerOffset + el.style.translateY <= this.latestYOffset &&
          containerOffset + el.style.translateY + el.style.height >= this.latestYOffset) {
        window.name = el[this.settings.groupKey];
      }

      if (el.style.translateY + el.style.height < minTranslateYPlusHeight ||
          el.style.translateY > maxTranslateY) {
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
      var newYOffset = window.pageYOffset;
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
    // Find the container to load images into, if it exists.
    this.container = document.getElementById(this.settings.containerId);
    if (!this.container) {
      console.error('Could not find element with ID ' + this.settings.containerId);
      return;
    }

    this.onScroll = this._getOnScroll();
    window.addEventListener('scroll', this.onScroll);

    this.onScroll();
    this._computeLayout();
    this._doLayout();

    optimizedResize.add(function() {
      this.lastWindowWidth = window.innerWidth;
      this._computeLayout();
      this._doLayout();
    }.bind(this));

    return this;
  };


  PigAudio.prototype.disable = function() {
    window.removeEventListener('scroll', this.onScroll);
    optimizedResize.disable();
    return this;
  };


  // ProgressiveTitle
  function ProgressiveTitle(singleTitleData, index, pig) {
    this.type = 'title';

    // Global State
    this.existsOnPage = false; // True if the element exists on the page.

    // Instance information
    this.sessionId = singleTitleData.sessionId; // Session Id
    this.submissionId = singleTitleData.submissionId; // Submission Id
    this.index = index;  // The index in the list of titles

    // The PigAudio instance
    this.pig = pig;

    this.classNames = {
      figure: pig.settings.classPrefix + '-figure ' +
              pig.settings.classPrefix + '-figure-title'
    };

    return this;
  }


  ProgressiveTitle.prototype.load = function() {
    this.existsOnPage = true;
    this._updateStyles();
    this.pig.container.appendChild(this.getElement());

    setTimeout(function() {

      if (!this.existsOnPage) {
        return;
      }

      // Show title
      if (!this.title) {
        var titleValue = document.createTextNode(this[this.pig.settings.groupKey]);

        this.title = document.createElement("H1");
        this.title.appendChild(titleValue);

        this.getElement().appendChild(this.title);
      }
    }.bind(this), 100);
  };


  ProgressiveTitle.prototype.hide = function() {
    if (this.getElement()) {
      if (this.title) {
        this.getElement().removeChild(this.title);
        delete this.title;
      }
    }

    // Remove the title from the DOM.
    if (this.existsOnPage) {
      this.pig.container.removeChild(this.getElement());
    }

    this.existsOnPage = false;
  };


  ProgressiveTitle.prototype.getElement = function() {
    if (!this.element) {
      this.element = document.createElement(this.pig.settings.figureTagName);
      this.element.className = this.classNames.figure;
      this._updateStyles();
    }

    return this.element;
  };


  ProgressiveTitle.prototype._updateStyles = function() {
    this.getElement().style.transition = this.style.transition;
    this.getElement().style.height = this.style.height + 'px';
    this.getElement().style.transform = (
      'translate3d(' + this.style.translateX + 'px,' +
        this.style.translateY + 'px, 0)');
  };


  // ProgressiveAudio
  function ProgressiveAudio(singleImageData, index, pig) {
    this.type = 'audio';

    // Global State
    this.existsOnPage = false; // True if the element exists on the page.

    // Instance information
    this.filename = singleImageData.filename;  // Filename
    this.sessionId = singleImageData.sessionId; // Session Id
    this.submissionId = singleImageData.submissionId; // Submission Id
    this.index = index;  // The index in the list of images

    // The PigAudio instance
    this.pig = pig;

    this.classNames = {
      figure: pig.settings.classPrefix + '-figure',
      loaded: pig.settings.classPrefix + '-loaded',
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
        this.audio = document.createElement('span');
        var audioSrc = this.pig.settings.urlForAudio(this.filename);

        _loadAudio.call(this, audioSrc, successAudioLoad, errorAudioLoad);

        this.getElement().appendChild(this.audio);
      }
    }.bind(this), 100);


    function successAudioLoad(audioBase64Data) {
      if(this.audio) {
        this.audio.addEventListener("click", function (event) {
          this.pig.settings.click(event, audioBase64Data, this.submissionId);
        }.bind(this));

        this.audio.className += ' ' + this.classNames.loaded;
      }
    }


    function errorAudioLoad(errorStatus) {
      console.error(errorStatus);
      this.pig.settings.error.call(this, errorStatus, renovateAudio);
    }


    function renovateAudio() {
       var audioSrc = this.pig.settings.urlForAudio(this.filename);
       _loadAudio.call(this, audioSrc, successAudioLoad, errorAudioLoad);
    }
  };

  /**
   * Removes the figure from the DOM, removes the thumbnail and full image, and
   * deletes the this.thumbnail and this.fullImage properties off of the
   * ProgressiveAudio object.
   */
  ProgressiveAudio.prototype.hide = function() {
    // Remove the images from the element, so that if a user is scrolling super
    // fast, we won't try to load every image we scroll past.
    if (this.getElement()) {
      if (this.thumbnail) {
        this.thumbnail.src = '';
        this.getElement().removeChild(this.thumbnail);
        delete this.thumbnail;
      }

      if (this.fullImage) {
        this.fullImage.src = '';
        this.getElement().removeChild(this.fullImage);
        delete this.fullImage;
      }
    }

    // Remove the image from the DOM.
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
