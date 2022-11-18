/*
 * jQuery Plugin: Autocomplete Text Entry
 * Version 0.1.0
 *
 * Copyright (c) 2022 Abubakar Azeem (https://github.com/bk-az)
 * Forked from https://github.com/loopj/jquery-tokeninput
 * Licensed jointly under the GPL and MIT licenses,
 * choose which one suits your project best!
 *
 */

;(function ($) {
  var DEFAULT_SETTINGS = {
    // Search settings
    method: "GET",
    queryParam: "q",
    searchDelay: 300,
    minChars: 1,
    propertyToSearch: "name",
    dataPath: null,
    contentType: "json",

    // Display settings
    hintText: "Type in a search term",
    noResultsText: "No results",
    searchingText: "Searching...",
    animateDropdown: true,
    placeholder: null,
    theme: null,
    zindex: 999,
    resultsLimit: null,

    enableHTML: false,

    resultsFormatter: function(item) {
      var string = item[this.propertyToSearch];
      return "<li>" + (this.enableHTML ? string : _escapeHTML(string)) + "</li>";
    },

    // Behavioral settings
    allowTabOut: false,
    autoSelectFirstResult: false,

    // Callbacks
    onResult: null,
    onCachedResult: null,
    onAutoComplete: null,
    onReady: null,

    // Keep track if the input is currently in disabled mode
    disabled: false
  };

  // Default classes to use when theming
  var DEFAULT_CLASSES = {
    dropdown             : "autocomplete-dropdown",
    dropdownItem         : "autocomplete-dropdown-item",
    dropdownItem2        : "autocomplete-dropdown-item2",
    selectedDropdownItem : "autocomplete-selected-dropdown-item",
    disabled             : "autocomplete-disabled"
  };

  // Input box position "enum"
  var POSITION = {
    BEFORE : 0,
    AFTER  : 1,
    END    : 2
  };

  // Keys "enum"
  var KEY = {
    BACKSPACE    : 8,
    TAB          : 9,
    ENTER        : 13,
    ESCAPE       : 27,
    SPACE        : 32,
    PAGE_UP      : 33,
    PAGE_DOWN    : 34,
    END          : 35,
    HOME         : 36,
    LEFT         : 37,
    UP           : 38,
    RIGHT        : 39,
    DOWN         : 40,
    NUMPAD_ENTER : 108,
    COMMA        : 188
  };

  var HTML_ESCAPES = {
    '&' : '&amp;',
    '<' : '&lt;',
    '>' : '&gt;',
    '"' : '&quot;',
    "'" : '&#x27;',
    '/' : '&#x2F;'
  };

  var HTML_ESCAPE_CHARS = /[&<>"'\/]/g;

  function coerceToString(val) {
    return String((val === null || val === undefined) ? '' : val);
  }

  function _escapeHTML(text) {
    return coerceToString(text).replace(HTML_ESCAPE_CHARS, function(match) {
      return HTML_ESCAPES[match];
    });
  }

  // Additional public (exposed) methods
  var methods = {
      init: function(url_or_data_or_function, options) {
          var settings = $.extend({}, DEFAULT_SETTINGS, options || {});

          return this.each(function () {
              $(this).data("settings", settings);
              $(this).data("searchObject", new $.AutoCompleteSearch(this, url_or_data_or_function, settings));
          });
      },
      clear: function() {
          this.data("searchObject").clear();
          return this;
      },
      toggleDisabled: function(disable) {
          this.data("searchObject").toggleDisabled(disable);
          return this;
      },
      setOptions: function(options){
          $(this).data("settings", $.extend({}, $(this).data("settings"), options || {}));
          return this;
      },
      destroy: function () {
        if (this.data("searchObject")) {
          this.data("searchObject").clear();
          var tmpInput = this;
          var closest = this.parent();
          closest.empty();
          tmpInput.show();
          closest.append(tmpInput);
          return tmpInput;
        }
      }
  };

  // Expose the .autoComplete function to jQuery as a plugin
  // 
  // Usage:
  //
  //  Initialize:
  //    $('#element_id').autoComplete('/products/search.json', {
  //                                                      theme: 'facebook',
  //                                                      minChars: 3,
  //                                                      onAutoComplete: function(item) {
  //                                                        // do something when a value is set from dropdown
  //                                                      }
  //                                                    });
  //  Destroy:
  //    $('#element_id').autoComplete('destroy');
  //
  $.fn.autoComplete = function (method) {
      // Method calling and initialization logic
      if (methods[method]) {
          return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
      } else {
          return methods.init.apply(this, arguments);
      }
  };

  // AutoCompleteSearch class for each input
  $.AutoCompleteSearch = function (input, url_or_data, settings) {
      //
      // Initialization
      //

      // Configure the data source
      if (typeof(url_or_data) === "string" || typeof(url_or_data) === "function") {
          // Set the url to query against
          $(input).data("settings").url = url_or_data;

          // If the URL is a function, evaluate it here to do our initalization work
          var url = computeURL();

          // Make a smart guess about cross-domain if it wasn't explicitly specified
          if ($(input).data("settings").crossDomain === undefined && typeof url === "string") {
              if(url.indexOf("://") === -1) {
                  $(input).data("settings").crossDomain = false;
              } else {
                  $(input).data("settings").crossDomain = (location.href.split(/\/+/g)[1] !== url.split(/\/+/g)[1]);
              }
          }
      } else if (typeof(url_or_data) === "object") {
          // Set the local data to search through
          $(input).data("settings").local_data = url_or_data;
      }

      // Build class names
      if($(input).data("settings").classes) {
          // Use custom class names
          $(input).data("settings").classes = $.extend({}, DEFAULT_CLASSES, $(input).data("settings").classes);
      } else if($(input).data("settings").theme) {
          // Use theme-suffixed default class names
          $(input).data("settings").classes = {};
          $.each(DEFAULT_CLASSES, function(key, value) {
              $(input).data("settings").classes[key] = value + "-" + $(input).data("settings").theme;
          });
      } else {
          $(input).data("settings").classes = DEFAULT_CLASSES;
      }

      // Basic cache to save on db hits
      var cache = new $.AutoCompleteSearch.Cache();

      // Keep track of the timeout
      var timeout;

      // Reference input text field as input_box and attach keyup events
      var input_box = $(input)
          .attr("autocomplete", "off")
          .on("focus.autoComplete", function () {
              if ($(input).data("settings").disabled) {
                  return false;
              }
              show_dropdown_hint();
          })
          .on("blur.autoComplete", function () {
              hide_dropdown();
          })
          .on("keydown.autoComplete", function (event) {
              switch(event.keyCode) {
                  case KEY.LEFT:
                  case KEY.RIGHT:
                  case KEY.UP:
                  case KEY.DOWN:
                    var dropdown_item = null;

                    if (event.keyCode === KEY.DOWN || event.keyCode === KEY.RIGHT) {
                      dropdown_item = $(dropdown).find('li').first();

                      if (selected_dropdown_item) {
                        dropdown_item = $(selected_dropdown_item).next();
                      }
                    } else {
                      dropdown_item = $(dropdown).find('li').last();

                      if (selected_dropdown_item) {
                        dropdown_item = $(selected_dropdown_item).prev();
                      }
                    }

                    select_dropdown_item(dropdown_item);

                    break;

                  case KEY.TAB:
                  case KEY.ENTER:
                  case KEY.NUMPAD_ENTER:
                  case KEY.COMMA:
                    if(selected_dropdown_item) {
                      setSelectedValue($(selected_dropdown_item).data("tokeninput"));
                      input_box.change();
                    } else {
                      $(this).val("");
                      if($(input).data("settings").allowTabOut) {
                        return true;
                      }
                      event.stopPropagation();
                      event.preventDefault();
                    }
                    return false;

                  case KEY.ESCAPE:
                    hide_dropdown();
                    return true;

                  default:
                    if (String.fromCharCode(event.which)) {
                      // set a timeout just long enough to let this function finish.
                      setTimeout(function(){ do_search(); }, 5);
                    }
                    break;
              }
          });

      // Keep reference for placeholder
      if (settings.placeholder) {
        input_box.attr("placeholder", settings.placeholder);
      }

      // Keep a reference to the dropdown item
      var selected_dropdown_item = null;

      // The list to store the dropdown items in
      var dropdown = $("<div/>")
          .addClass($(input).data("settings").classes.dropdown)
          .appendTo("body")
          .hide();

      // Check if widget should initialize as disabled
      if ($(input).data("settings").disabled) {
          toggleDisabled(true);
      }

      // Initialization is done
      if (typeof($(input).data("settings").onReady) === "function") {
        $(input).data("settings").onReady.call();
      }

      //
      // Public functions
      //

      this.add = function(item) {
          setSelectedValue(item);
      }

      this.clear = function() {
          $(input_box).val("");
      };

      this.toggleDisabled = function(disable) {
          toggleDisabled(disable);
      };

      //
      // Private functions
      //

      // Add a token to the token list based on user input
      function setSelectedValue(item, options = {}) {
          if (item == undefined)
          {
              return;
          }
          var callback = settings.onAutoComplete;

          // Set value
          input_box.val(item.name);

          hide_dropdown();

          // Execute the onAutoComplete callback if defined
          if($.isFunction(callback)) {          
            callback.call(input, item);
          }
      }

      function escapeHTML(text) {
        return $(input).data("settings").enableHTML ? text : _escapeHTML(text);
      }

      // Toggles the widget between enabled and disabled state, or according
      // to the [disable] parameter.
      function toggleDisabled(disable) {
          if (typeof disable === 'boolean') {
              $(input).data("settings").disabled = disable
          } else {
              $(input).data("settings").disabled = !$(input).data("settings").disabled;
          }
          input_box.attr('disabled', $(input).data("settings").disabled);
      }

      // Hide and clear the results dropdown
      function hide_dropdown () {
          dropdown.hide().empty();
          selected_dropdown_item = null;
      }

      function show_dropdown() {
          dropdown
              .css({
                  position: "absolute",
                  top: input_box.offset().top + input_box.outerHeight(true),
                  left: input_box.offset().left,
                  width: input_box.innerWidth(),
                  'z-index': $(input).data("settings").zindex
              })
              .show();
      }

      function show_dropdown_searching () {
          if($(input).data("settings").searchingText) {
              dropdown.html("<p>" + escapeHTML($(input).data("settings").searchingText) + "</p>");
              show_dropdown();
          }
      }

      function show_dropdown_hint () {
          if($(input).data("settings").hintText) {
              dropdown.html("<p>" + escapeHTML($(input).data("settings").hintText) + "</p>");
              show_dropdown();
          }
      }

      var regexp_special_chars = new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\-]', 'g');
      function regexp_escape(term) {
          return term.replace(regexp_special_chars, '\\$&');
      }

      // Highlight the query part of the search term
      function highlight_term(value, term) {
          return value.replace(
            new RegExp(
              "(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(term) + ")(?![^<>]*>)(?![^&;]+;)",
              "gi"
            ), function(match, p1) {
              return "<b>" + escapeHTML(p1) + "</b>";
            }
          );
      }

      function find_value_and_highlight_term(template, value, term) {
          return template.replace(new RegExp("(?![^&;]+;)(?!<[^<>]*)(" + regexp_escape(value) + ")(?![^<>]*>)(?![^&;]+;)", "g"), highlight_term(value, term));
      }

      // Populate the results dropdown with some results
      function populateDropdown (query, results) {
          if(results && results.length) {
              dropdown.empty();
              var dropdown_ul = $("<ul/>")
                  .appendTo(dropdown)
                  .mouseover(function (event) {
                      select_dropdown_item($(event.target).closest("li"));
                  })
                  .mousedown(function (event) {
                      setSelectedValue($(event.target).closest("li").data("tokeninput"));
                      input_box.change();
                      return false;
                  })
                  .hide();

              if ($(input).data("settings").resultsLimit && results.length > $(input).data("settings").resultsLimit) {
                  results = results.slice(0, $(input).data("settings").resultsLimit);
              }

              $.each(results, function(index, value) {
                  var this_li = $(input).data("settings").resultsFormatter(value);

                  this_li = find_value_and_highlight_term(this_li ,value[$(input).data("settings").propertyToSearch], query);
                  this_li = $(this_li).appendTo(dropdown_ul);

                  if(index % 2) {
                      this_li.addClass($(input).data("settings").classes.dropdownItem);
                  } else {
                      this_li.addClass($(input).data("settings").classes.dropdownItem2);
                  }

                  if(index === 0 && $(input).data("settings").autoSelectFirstResult) {
                      select_dropdown_item(this_li);
                  }

                  $.data(this_li.get(0), "tokeninput", value);
              });

              show_dropdown();

              if($(input).data("settings").animateDropdown) {
                  dropdown_ul.slideDown("fast");
              } else {
                  dropdown_ul.show();
              }
          } else {
              if($(input).data("settings").noResultsText) {
                  dropdown.html("<p>" + escapeHTML($(input).data("settings").noResultsText) + "</p>");
                  show_dropdown();
              }
          }
      }

      // Highlight an item in the results dropdown
      function select_dropdown_item (item) {
          if(item) {
              if(selected_dropdown_item) {
                  deselect_dropdown_item($(selected_dropdown_item));
              }

              item.addClass($(input).data("settings").classes.selectedDropdownItem);
              selected_dropdown_item = item.get(0);
          }
      }

      // Remove highlighting from an item in the results dropdown
      function deselect_dropdown_item (item) {
          item.removeClass($(input).data("settings").classes.selectedDropdownItem);
          selected_dropdown_item = null;
      }

      // Do a search and show the "searching" dropdown if the input is longer
      // than $(input).data("settings").minChars
      function do_search() {
          var query = input_box.val();

          if(query && query.length) {
              if(query.length >= $(input).data("settings").minChars) {
                  show_dropdown_searching();
                  clearTimeout(timeout);

                  timeout = setTimeout(function(){
                      run_search(query);
                  }, $(input).data("settings").searchDelay);
              } else {
                  hide_dropdown();
              }
          }
      }

      // Do the actual search
      function run_search(query) {
          var cache_key = query + computeURL();
          var cached_results = cache.get(cache_key);
          if (cached_results) {
              if ($.isFunction($(input).data("settings").onCachedResult)) {
                cached_results = $(input).data("settings").onCachedResult.call(input_box, cached_results);
              }
              populateDropdown(query, cached_results);
          } else {
              // Are we doing an ajax search or local data search?
              if($(input).data("settings").url) {
                  var url = computeURL();
                  // Extract existing get params
                  var ajax_params = {};
                  ajax_params.data = {};
                  if(url.indexOf("?") > -1) {
                      var parts = url.split("?");
                      ajax_params.url = parts[0];

                      var param_array = parts[1].split("&");
                      $.each(param_array, function (index, value) {
                          var kv = value.split("=");
                          ajax_params.data[kv[0]] = kv[1];
                      });
                  } else {
                      ajax_params.url = url;
                  }

                  // Prepare the request
                  ajax_params.data[$(input).data("settings").queryParam] = query;
                  ajax_params.type = $(input).data("settings").method;
                  ajax_params.dataType = $(input).data("settings").contentType;
                  if ($(input).data("settings").crossDomain) {
                      ajax_params.dataType = "jsonp";
                  }

                  // Attach the success callback
                  ajax_params.success = function(results) {
                    var resultsData = getResults(results, $(input).data("settings").dataPath)
                    cache.add(cache_key, resultsData);
                    if($.isFunction($(input).data("settings").onResult)) {
                        resultsData = $(input).data("settings").onResult.call(input_box, resultsData);
                    }

                    // only populate the dropdown if the results are associated with the active search query
                    if(input_box.val() === query) {
                        populateDropdown(query, resultsData);
                    }
                  };

                  // Provide a beforeSend callback
                  if (settings.onSend) {
                    settings.onSend(ajax_params);
                  }

                  // Make the request
                  $.ajax(ajax_params);
              } else if($(input).data("settings").local_data) {
                  // Do the search through local data
                  var results = $.grep($(input).data("settings").local_data, function (row) {
                      return row[$(input).data("settings").propertyToSearch].toLowerCase().indexOf(query.toLowerCase()) > -1;
                  });

                  cache.add(cache_key, results);
                  if($.isFunction($(input).data("settings").onResult)) {
                      results = $(input).data("settings").onResult.call(input_box, results);
                  }
                  populateDropdown(query, results);
              }
          }
      }

      function getResults(data, dataPath) {
          var results = data;
          
          if (!dataPath) { return results; }

          if (dataPath.constructor === Array) {
              $.each(dataPath, function(index, key){
                  results = results[key];
              });
          } else if (dataPath.constructor === String) {
            results = results[dataPath];
          }
          return results;
      }

      // compute the dynamic URL
      function computeURL() {
          var settings = $(input).data("settings");
          return typeof settings.url == 'function' ? settings.url.call(settings) : settings.url;
      }

      // Bring browser focus to the specified object.
      // Use of setTimeout is to get around an IE bug.
      // (See, e.g., http://stackoverflow.com/questions/2600186/focus-doesnt-work-in-ie)
      //
      // obj: a jQuery object to focus()
      function focusWithTimeout(object) {
          setTimeout(
            function() {
        object.focus();
            },
      50
      );
      }
  };

  // Really basic cache for the results
  $.AutoCompleteSearch.Cache = function (options) {
    var settings, data = {}, size = 0, flush;

    settings = $.extend({ max_size: 500 }, options);

    flush = function () {
      data = {};
      size = 0;
    };

    this.add = function (query, results) {
      if (size > settings.max_size) {
        flush();
      }

      if (!data[query]) {
        size += 1;
      }

      data[query] = results;
    };

    this.get = function (query) {
      return data[query];
    };
  };

}(jQuery));
