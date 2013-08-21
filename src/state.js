/**
 * @ngdoc object
 * @name ui.router.state.$stateProvider
 *
 * @requires $urlRouterProvider
 * @requires $urlMatcherFactoryProvider
 * @requires $locationProvider
 *
 * @description
 * The new $stateProvider works similar to Angular's v1 router, but it focuses purely on state.
 *
 * - A state corresponds to a "place" in the application in terms of the overall UI and navigation.
 * - A state describes (via the controller / template / view properties) what the UI looks like and does at that place.
 * - States often have things in common, and the primary way of factoring out these commonalities in this model is via the state hierarchy, i.e. parent/child states aka nested states.
 *
 * TODO:Description++
 * TODO:Examples
 */
$StateProvider.$inject = ['$urlRouterProvider', '$urlMatcherFactoryProvider', '$locationProvider'];
function $StateProvider(   $urlRouterProvider,   $urlMatcherFactory,           $locationProvider) {

  var root, states = {}, $state;

  // Builds state properties from definition passed to registerState()
  var stateBuilder = {

    // Derive parent state from a hierarchical name only if 'parent' is not explicitly defined.
    // state.children = [];
    // if (parent) parent.children.push(state);
    parent: function(state) {
      if (isDefined(state.parent) && state.parent) return findState(state.parent);
      // regex matches any valid composite state name
      // would match "contact.list" but not "contacts"
      var compositeName = /^(.+)\.[^.]+$/.exec(state.name);
      return compositeName ? findState(compositeName[1]) : root;
    },

    // inherit 'data' from parent and override by own values (if any)
    data: function(state) {
      if (state.parent && state.parent.data) {
        state.data = state.self.data = angular.extend({}, state.parent.data, state.data);
      }
      return state.data;
    },

    // Build a URLMatcher if necessary, either via a relative or absolute URL
    url: function(state) {
      var url = state.url;

      if (isString(url)) {
        if (url.charAt(0) == '^') {
          return $urlMatcherFactory.compile(url.substring(1));
        }
        return (state.parent.navigable || root).url.concat(url);
      }

      if ($urlMatcherFactory.isMatcher(url) || url == null) {
        return url;
      }
      throw new Error("Invalid url '" + url + "' in state '" + state + "'");
    },

    // Keep track of the closest ancestor state that has a URL (i.e. is navigable)
    navigable: function(state) {
      return state.url ? state : (state.parent ? state.parent.navigable : null);
    },

    // Derive parameters for this state and ensure they're a super-set of parent's parameters
    params: function(state) {
      if (!state.params) {
        return state.url ? state.url.parameters() : state.parent.params;
      }
      if (!isArray(state.params)) throw new Error("Invalid params in state '" + state + "'");
      if (state.url) throw new Error("Both params and url specicified in state '" + state + "'");
      return state.params;
    },

    // If there is no explicit multi-view configuration, make one up so we don't have
    // to handle both cases in the view directive later. Note that having an explicit
    // 'views' property will mean the default unnamed view properties are ignored. This
    // is also a good time to resolve view names to absolute names, so everything is a
    // straight lookup at link time.
    views: function(state) {
      var views = {};

      forEach(isDefined(state.views) ? state.views : { '': state }, function (view, name) {
        if (name.indexOf('@') < 0) name += '@' + state.parent.name;
        views[name] = view;
      });
      return views;
    },

    ownParams: function(state) {
      if (!state.parent) {
        return state.params;
      }
      var paramNames = {}; forEach(state.params, function (p) { paramNames[p] = true; });

      forEach(state.parent.params, function (p) {
        if (!paramNames[p]) {
          throw new Error("Missing required parameter '" + p + "' in state '" + state.name + "'");
        }
        paramNames[p] = false;
      });
      var ownParams = [];

      forEach(paramNames, function (own, p) {
        if (own) ownParams.push(p);
      });
      return ownParams;
    },

    // Keep a full path from the root down to this state as this is needed for state activation.
    path: function(state) {
      return state.parent ? state.parent.path.concat(state) : []; // exclude root from path
    },

    // Speed up $state.contains() as it's used a lot
    includes: function(state) {
      var includes = state.parent ? extend({}, state.parent.includes) : {};
      includes[state.name] = true;
      return includes;
    }
  };


  function findState(stateOrName, base) {
    var isStr = isString(stateOrName),
        name  = isStr ? stateOrName : stateOrName.name,
        path  = name.indexOf(".") === 0 || name.indexOf("^") === 0;

    if (path) {
      if (!base) throw new Error("No reference point given for path '"  + name + "'");
      var rel = name.split("."), i = 0, pathLength = rel.length, current = base;

      for (; i < pathLength; i++) {
        if (rel[i] === "" && i === 0) {
          current = base;
          continue;
        }
        if (rel[i] === "^") {
          if (!current.parent) throw new Error("Path '" + name + "' not valid for state '" + base.name + "'");
          current = current.parent;
          continue;
        }
        break;
      }
      rel = rel.slice(i).join(".");
      name = current.name + (current.name && rel ? "." : "") + rel;
    }
    var state = states[name];

    if (state && (isStr || (!isStr && (state === stateOrName || state.self === stateOrName)))) {
      return state;
    }
    return undefined;
  }


  function registerState(state) {
    // Wrap a new object around the state so we can store our private details easily.
    state = inherit(state, {
      self: state,
      resolve: state.resolve || {},
      toString: function() { return this.name; }
    });

    var name = state.name;
    if (!isString(name) || name.indexOf('@') >= 0) throw new Error("State must have a valid name");
    if (states[name]) throw new Error("State '" + name + "'' is already defined");

    for (var key in stateBuilder) {
      state[key] = stateBuilder[key](state);
    }
    states[name] = state;

    // Register the state in the global state list and with $urlRouter if necessary.
    if (!state['abstract'] && state.url) {
      $urlRouterProvider.when(state.url, ['$match', '$stateParams', function ($match, $stateParams) {
        if ($state.$current.navigable != state || !equalForKeys($match, $stateParams)) {
          $state.transitionTo(state, $match, false);
        }
      }]);
    }
    return state;
  }


  // Implicit root state that is always active
  root = registerState({
    name: '',
    url: '^',
    views: null,
    'abstract': true
  });
  root.locals = { globals: { $stateParams: {} } };
  root.navigable = null;


  // .state(state)
  // .state(name, state)

  /**
   * @ngdoc function
   * @name ui.router.state.$stateProvider#state
   * @methodOf ui.router.state.$stateProvider
   *
   * @param {string} name Name or Full name of the state.
   *
   * Full name refers to a state name that also defines it's parent state in the name, e.g. if you provide the name
   * `my.state` it is assumed that `my` is another defined state and it will set that state as parent to this state.
   *
   * @param {Object} state All information about the state.
   *
   * Object properties:
   * - `views`: `{Object=}` A list og views to be updated when the state is activated.
   * - `url`: `{string=}` A url to associate the state with.
   * - `onEnter`: `{string|function|Object=}` value
   * - `onExit`: `{string|function|Object=}` value
   *
   * TODO:Properties
   *
   * @returns {Object} self
   *
   * @description
   * Adds a new state configuration to the `$stateProvider`.
   *
   * TODO:Description++
   * TODO:Examples
   * TODO:.state(state)
   */
  this.state = state;
  function state(name, definition) {
    /*jshint validthis: true */
    if (isObject(name)) definition = name;
    else definition.name = name;
    registerState(definition);
    return this;
  }

  // $urlRouter is injected just to ensure it gets instantiated

  /**
   * $ngdoc object
   * $name ui.router.state.$state
   *
   * $requires $rootScope
   * $requires $q
   * $requires $view
   * $requires $injector
   * $requires $stateParams
   * $requires $location
   * $requires $urlRouter
   *
   * @property {Object} current Reference to the current state loaded.
   * @property {Object} params Parameters loaded for the current state.
   * @property {Object} transition TODO:???.
   *
   * @description
   * You can define states through the {@link ui.router.state.$stateProvider $stateProvider}.
   *
   * TODO:Description++
   * TODO:Examples
   */
  this.$get = $get;
  $get.$inject = ['$rootScope', '$q', '$view', '$injector', '$stateParams', '$location', '$urlRouter'];
  function $get(   $rootScope,   $q,   $view,   $injector,   $stateParams,   $location,   $urlRouter) {

    /**
     * @ngdoc event
     * @name ui.router.state.$state#$stateChangeStart
     * @eventOf ui.router.state.$state
     *
     * @eventType broadcast on root scope
     *
     * @description
     * Broadcasted before a state change. At this  point the state services starts
     * resolving all of the dependencies needed for the state change to occurs.
     *
     * @param {Object} angularEvent Synthetic event object.
     * @param {State} next Future state.
     * @param {State} toParams Future state params.
     * @param {State} from Current state.
     * @param {State} fromParams Current state params.
     */

    /**
     * @ngdoc event
     * @name ui.router.state.$state#$stateChangeSuccess
     * @eventOf ui.router.state.$state
     *
     * @eventType broadcast on root scope
     *
     * @description
     * Broadcasted after a route dependencies are resolved.
     *
     * @param {Object} angularEvent Synthetic event object.
     * @param {State} next Future state.
     * @param {State} toParams Future state params.
     * @param {State} from Current state.
     * @param {State} fromParams Current state params.
     */

    /**
     * @ngdoc event
     * @name ui.router.state.$state#$stateChangeError
     * @eventOf ui.router.state.$state
     *
     * @eventType broadcast on root scope
     *
     * @description
     * Broadcasted if any of the resolve promises are rejected.
     *
     * @param {Object} angularEvent Synthetic event object.
     * @param {State} next Future state.
     * @param {State} toParams Future state params.
     * @param {State} from Current state.
     * @param {State} fromParams Current state params.
     * @param {Object} rejection Rejection of the promise. Usually the error of the failed promise.
     */

    var TransitionSuperseded = $q.reject(new Error('transition superseded'));
    var TransitionPrevented = $q.reject(new Error('transition prevented'));

    $state = {
      params: {},
      current: root.self,
      $current: root,
      transition: null
    };

    /**
     * @ngdoc method
     * @name ui.router.state.$state#go
     * @methodOf ui.router.state.$state
     *
     * @param {State|string} to The state that should be activated
     * @param {Object} params A set of parameters for the state that should be activated TODO:Parameters???
     * @param {Object} options A Set of options TODO:Parameters???
     *
     * @returns {*} TODO:???
     *
     * @description
     * Performs a transition to a state, keeping the parameters for the parent state if navigating to siblings.
     *
     * TODO:Description++
     * TODO:Examples
     */
    $state.go = function go(to, params, options) {
      return this.transitionTo(to, params, extend({ inherit: true, relative: $state.$current }, options));
    };

    /**
     * @ngdoc method
     * @name ui.router.state.$state#transitionTo
     * @methodOf ui.router.state.$state
     *
     * @param {State|string} to The state that should be activated
     * @param {Object} toParams A set of parameters for the state that should be activated TODO:Parameters???
     * @param {Object} options A Set of options TODO:Parameters???
     *
     * @returns {*} TODO:???
     *
     * @description
     * Performs a transition to a state.
     *
     * TODO:Description++
     * TODO:Examples
     */
    $state.transitionTo = function transitionTo(to, toParams, options) {
      if (!isDefined(options)) options = (options === true || options === false) ? { location: options } : {};
      options = extend({ location: true, inherit: false, relative: null }, options);

      var toState = findState(to, options.relative);
      if (!isDefined(toState)) throw new Error("No such state " + toState);
      if (toState['abstract']) throw new Error("Cannot transition to abstract state '" + to + "'");
      if (options.inherit) toParams = inheritParams($stateParams, toParams || {}, $state.$current, toState);
      to = toState;

      var toPath = to.path,
          from = $state.$current, fromParams = $state.params, fromPath = from.path;

      // Starting from the root of the path, keep all levels that haven't changed
      var keep, state, locals = root.locals, toLocals = [];
      for (keep = 0, state = toPath[keep];
           state && state === fromPath[keep] && equalForKeys(toParams, fromParams, state.ownParams);
           keep++, state = toPath[keep]) {
        locals = toLocals[keep] = state.locals;
      }

      // If we're going to the same state and all locals are kept, we've got nothing to do.
      // But clear 'transition', as we still want to cancel any other pending transitions.
      // TODO: We may not want to bump 'transition' if we're called from a location change that we've initiated ourselves,
      // because we might accidentally abort a legitimate transition initiated from code?
      if (to === from && locals === from.locals) {
        $state.transition = null;
        return $q.when($state.current);
      }

      // Normalize/filter parameters before we pass them to event handlers etc.
      toParams = normalize(to.params, toParams || {});

      // Broadcast start event and cancel the transition if requested
      var evt = $rootScope.$broadcast('$stateChangeStart', to.self, toParams, from.self, fromParams);
      if (evt.defaultPrevented) return TransitionPrevented;

      // Resolve locals for the remaining states, but don't update any global state just
      // yet -- if anything fails to resolve the current state needs to remain untouched.
      // We also set up an inheritance chain for the locals here. This allows the view directive
      // to quickly look up the correct definition for each view in the current state. Even
      // though we create the locals object itself outside resolveState(), it is initially
      // empty and gets filled asynchronously. We need to keep track of the promise for the
      // (fully resolved) current locals, and pass this down the chain.
      var resolved = $q.when(locals);
      for (var l=keep; l<toPath.length; l++, state=toPath[l]) {
        locals = toLocals[l] = inherit(locals);
        resolved = resolveState(state, toParams, state===to, resolved, locals);
      }

      // Once everything is resolved, we are ready to perform the actual transition
      // and return a promise for the new state. We also keep track of what the
      // current promise is, so that we can detect overlapping transitions and
      // keep only the outcome of the last transition.
      var transition = $state.transition = resolved.then(function () {
        var l, entering, exiting;

        if ($state.transition !== transition) return TransitionSuperseded;

        // Exit 'from' states not kept
        for (l=fromPath.length-1; l>=keep; l--) {
          exiting = fromPath[l];
          if (exiting.self.onExit) {
            $injector.invoke(exiting.self.onExit, exiting.self, exiting.locals.globals);
          }
          exiting.locals = null;
        }

        // Enter 'to' states not kept
        for (l=keep; l<toPath.length; l++) {
          entering = toPath[l];
          entering.locals = toLocals[l];
          if (entering.self.onEnter) {
            $injector.invoke(entering.self.onEnter, entering.self, entering.locals.globals);
          }
        }

        // Update globals in $state
        $state.$current = to;
        $state.current = to.self;
        $state.params = toParams;
        copy($state.params, $stateParams);
        $state.transition = null;

        // Update $location
        var toNav = to.navigable;
        if (options.location && toNav) {
          $location.url(toNav.url.format(toNav.locals.globals.$stateParams));
        }

        $rootScope.$broadcast('$stateChangeSuccess', to.self, toParams, from.self, fromParams);

        return $state.current;
      }, function (error) {
        if ($state.transition !== transition) return TransitionSuperseded;

        $state.transition = null;
        $rootScope.$broadcast('$stateChangeError', to.self, toParams, from.self, fromParams, error);

        return $q.reject(error);
      });

      return transition;
    };


    /**
     * @ngdoc method
     * @name ui.router.state.$state#is
     * @methodOf ui.router.state.$state
     *
     * @param {State|string} stateOrName A State or state name to compare the current active state to
     *
     * @returns {*} returns true if the state is the one currently active, otherwise undefined TODO:??? - should we not return false?
     *
     * @description
     * Compares the currently active state to the provided state or state name.
     *
     * TODO:Description++
     * TODO:Examples
     */
    $state.is = function is(stateOrName) {
      var state = findState(stateOrName);
      return (isDefined(state)) ? $state.$current === state : undefined;
    };

    /**
     * @ngdoc method
     * @name ui.router.state.$state#includes
     * @methodOf ui.router.state.$state
     *
     * @param {State|string} stateOrName A State or state name to check against the current active state branch.
     *
     * @returns {*} returns true if the state is the one currently active or is a parent to the one currently active,
     *              otherwise undefined TODO:??? - should we not return false?
     *
     * @description
     * Compares the currently active state branch to the provided state or state name.
     *
     * TODO:Description++
     * TODO:Examples
     */
    $state.includes = function includes(stateOrName) {
      var state = findState(stateOrName);
      return (isDefined(state)) ? isDefined($state.$current.includes[state.name]) : undefined;
    };

    /**
     * @ngdoc method
     * @name ui.router.state.$state#href
     * @methodOf ui.router.state.$state
     *
     * @param {State|string} stateOrName A State or state name to generate an url for.
     * @param {Object} params A set of parameters to use when generating the url.
     * @param {Object=} options A Set of options to use when generating the url.
     *
     * Object properties:
     * - `relative`: `{State=}` TODO:???
     * - `lossy`: `{boolean=}` TODO:???
     * - `inherit`: `{boolean=}` TODO:???
     *
     * @returns {*} returns the generated url. TODO:return-type???
     *
     * @description
     * Generates an url for the provided state using the given parameters and options.
     *
     * TODO:Description++
     * TODO:Examples
     */
    $state.href = function href(stateOrName, params, options) {
      options = extend({ lossy: true, inherit: false, relative: $state.$current }, options || {});
      var state = findState(stateOrName, options.relative);
      if (!isDefined(state)) return null;

      params = inheritParams($stateParams, params || {}, $state.$current, state);
      var nav = (state && options.lossy) ? state.navigable : state;
      var url = (nav && nav.url) ? nav.url.format(normalize(state.params, params || {})) : null;
      return !$locationProvider.html5Mode() && url ? "#" + url : url;
    };

    /**
     * @ngdoc method
     * @name ui.router.state.$state#get
     * @methodOf ui.router.state.$state
     *
     * @param {State|string} stateOrName Gets the configuration of a state.
     *
     * @returns {State} returns the state configuration.
     *
     * @description
     * Compares the currently active state branch to the provided state or state name.
     *
     * TODO:Description++
     * TODO:Examples
     */
    $state.get = function (stateOrName) {
      var state = findState(stateOrName);
      return (state && state.self) ? state.self : null;
    };

    function resolveState(state, params, paramsAreFiltered, inherited, dst) {
      // We need to track all the promises generated during the resolution process.
      // The first of these is for the fully resolved parent locals.
      var promises = [inherited];

      // Make a restricted $stateParams with only the parameters that apply to this state if
      // necessary. In addition to being available to the controller and onEnter/onExit callbacks,
      // we also need $stateParams to be available for any $injector calls we make during the
      // dependency resolution process.
      var $stateParams = (paramsAreFiltered) ? params : filterByKeys(state.params, params);
      var locals = { $stateParams: $stateParams };

      // Resolves the values from an individual 'resolve' dependency spec
      function resolve(deps, dst) {
        forEach(deps, function (value, key) {
          promises.push($q
            .when(isString(value) ?
                $injector.get(value) :
                $injector.invoke(value, state.self, locals))
            .then(function (result) {
              dst[key] = result;
            }));
        });
      }

      // Resolve 'global' dependencies for the state, i.e. those not specific to a view.
      // We're also including $stateParams in this; that way the parameters are restricted
      // to the set that should be visible to the state, and are independent of when we update
      // the global $state and $stateParams values.
      var globals = dst.globals = { $stateParams: $stateParams };
      resolve(state.resolve, globals);
      globals.$$state = state; // Provide access to the state itself for internal use

      // Resolve template and dependencies for all views.
      forEach(state.views, function (view, name) {
        // References to the controller (only instantiated at link time)
        var _$view = dst[name] = {
          $$controller: view.controller
        };

        // Template
        promises.push($q
          .when($view.load(name, { view: view, locals: locals, params: $stateParams, notify: false }) || '')
          .then(function (result) {
            _$view.$template = result;
          }));

        // View-local dependencies. If we've reused the state definition as the default
        // view definition in .state(), we can end up with state.resolve === view.resolve.
        // Avoid resolving everything twice in that case.
        if (view.resolve !== state.resolve) resolve(view.resolve, _$view);
      });

      // Once we've resolved all the dependencies for this state, merge
      // in any inherited dependencies, and merge common state dependencies
      // into the dependency set for each view. Finally return a promise
      // for the fully popuplated state dependencies.
      return $q.all(promises).then(function (values) {
        merge(dst.globals, values[0].globals); // promises[0] === inherited
        forEach(state.views, function (view, name) {
          merge(dst[name], dst.globals);
        });
        return dst;
      });
    }

    return $state;
  }

  function normalize(keys, values) {
    var normalized = {};

    forEach(keys, function (name) {
      var value = values[name];
      normalized[name] = (value != null) ? String(value) : null;
    });
    return normalized;
  }

  function equalForKeys(a, b, keys) {
    // If keys not provided, assume keys from object 'a'
    if (!keys) {
      keys = [];
      for (var n in a) keys.push(n); // Used instead of Object.keys() for IE8 compatibility
    }

    for (var i=0; i<keys.length; i++) {
      var k = keys[i];
      if (a[k] != b[k]) return false; // Not '===', values aren't necessarily normalized
    }
    return true;
  }

  function filterByKeys(keys, values) {
    var filtered = {};

    forEach(keys, function (name) {
      filtered[name] = values[name];
    });
    return filtered;
  }
}

angular.module('ui.router.state')
  .value('$stateParams', {})
  .provider('$state', $StateProvider);
