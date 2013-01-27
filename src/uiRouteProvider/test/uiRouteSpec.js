'use strict';

describe('$uiRoute', function() {
  var $httpBackend;

  beforeEach(module(function() {
    return function(_$httpBackend_) {
      $httpBackend = _$httpBackend_;
      $httpBackend.when('GET', 'Chapter.html').respond('chapter');
      $httpBackend.when('GET', 'test.html').respond('test');
      $httpBackend.when('GET', 'foo.html').respond('foo');
      $httpBackend.when('GET', 'baz.html').respond('baz');
      $httpBackend.when('GET', 'bar.html').respond('bar');
      $httpBackend.when('GET', '404.html').respond('not found');
    };
  }));

  it('should route and fire change event', function() {
    var log = '',
        lastRoute,
        nextRoute;

    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/Book/:book/Chapter/:chapter',
          {controller: noop, templateUrl: 'Chapter.html'});
      $uiRouteProvider.when('/Blank', {});
    });
    inject(function($uiRoute, $location, $rootScope) {
      $rootScope.$on('$uiRouteChangeStart', function(event, next, current) {
        log += 'before();';
        expect(current).toBe($uiRoute.current);
        lastRoute = current;
        nextRoute = next;
      });
      $rootScope.$on('$uiRouteChangeSuccess', function(event, current, last) {
        log += 'after();';
        expect(current).toBe($uiRoute.current);
        expect(lastRoute).toBe(last);
        expect(nextRoute).toBe(current);
      });

      $location.path('/Book/Moby/Chapter/Intro').search('p=123');
      $rootScope.$digest();
      $httpBackend.flush();
      expect(log).toEqual('before();after();');
      expect($uiRoute.current.params).toEqual({book:'Moby', chapter:'Intro', p:'123'});

      log = '';
      $location.path('/Blank').search('ignore');
      $rootScope.$digest();
      expect(log).toEqual('before();after();');
      expect($uiRoute.current.params).toEqual({ignore:true});

      log = '';
      $location.path('/NONE');
      $rootScope.$digest();
      expect(log).toEqual('before();after();');
      expect($uiRoute.current).toEqual(null);
    });
  });


  it('should not change route when location is canceled', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/somePath', {template: 'some path'});
    });
    inject(function($uiRoute, $location, $rootScope, $log) {
      $rootScope.$on('$locationChangeStart', function(event) {
        $log.info('$locationChangeStart');
        event.preventDefault();
      });

      $rootScope.$on('$beforeRouteChange', function(event) {
        throw new Error('Should not get here');
      });

      $location.path('/somePath');
      $rootScope.$digest();

      expect($log.info.logs.shift()).toEqual(['$locationChangeStart']);
    });
  });


  describe('should match a route that contains special chars in the path', function() {
    beforeEach(module(function($uiRouteProvider) {
      $uiRouteProvider.when('/$test.23/foo*(bar)/:baz', {templateUrl: 'test.html'});
    }));

    it('matches the full path', inject(function($uiRoute, $location, $rootScope) {
      $location.path('/test');
      $rootScope.$digest();
      expect($uiRoute.current).toBeUndefined();
    }));

    it('matches literal .', inject(function($uiRoute, $location, $rootScope) {
      $location.path('/$testX23/foo*(bar)/222');
      $rootScope.$digest();
      expect($uiRoute.current).toBeUndefined();
    }));

    it('matches literal *', inject(function($uiRoute, $location, $rootScope) {
      $location.path('/$test.23/foooo(bar)/222');
      $rootScope.$digest();
      expect($uiRoute.current).toBeUndefined();
    }));

    it('treats backslashes normally', inject(function($uiRoute, $location, $rootScope) {
      $location.path('/$test.23/foo*\\(bar)/222');
      $rootScope.$digest();
      expect($uiRoute.current).toBeUndefined();
    }));

    it('matches a URL with special chars', inject(function($uiRoute, $location, $rootScope) {
      $location.path('/$test.23/foo*(bar)/222');
      $rootScope.$digest();
      expect($uiRoute.current).toBeDefined();
    }));
  });


  it('should change route even when only search param changes', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/test', {templateUrl: 'test.html'});
    });

    inject(function($uiRoute, $location, $rootScope) {
      var callback = jasmine.createSpy('onRouteChange');

      $rootScope.$on('$uiRouteChangeStart', callback);
      $location.path('/test');
      $rootScope.$digest();
      callback.reset();

      $location.search({any: true});
      $rootScope.$digest();

      expect(callback).toHaveBeenCalled();
    });
  });


  it('should allow routes to be defined with just templates without controllers', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {templateUrl: 'foo.html'});
    });

    inject(function($uiRoute, $location, $rootScope) {
      var onChangeSpy = jasmine.createSpy('onChange');

      $rootScope.$on('$uiRouteChangeStart', onChangeSpy);
      expect($uiRoute.current).toBeUndefined();
      expect(onChangeSpy).not.toHaveBeenCalled();

      $location.path('/foo');
      $rootScope.$digest();

      expect($uiRoute.current.templateUrl).toEqual('foo.html');
      expect($uiRoute.current.controller).toBeUndefined();
      expect(onChangeSpy).toHaveBeenCalled();
    });
  });


  it('should handle unknown routes with "otherwise" route definition', function() {
    function NotFoundCtrl() {}

    module(function($uiRouteProvider){
      $uiRouteProvider.when('/foo', {templateUrl: 'foo.html'});
      $uiRouteProvider.otherwise({templateUrl: '404.html', controller: NotFoundCtrl});
    });

    inject(function($uiRoute, $location, $rootScope) {
      var onChangeSpy = jasmine.createSpy('onChange');

      $rootScope.$on('$uiRouteChangeStart', onChangeSpy);
      expect($uiRoute.current).toBeUndefined();
      expect(onChangeSpy).not.toHaveBeenCalled();

      $location.path('/unknownRoute');
      $rootScope.$digest();

      expect($uiRoute.current.templateUrl).toBe('404.html');
      expect($uiRoute.current.controller).toBe(NotFoundCtrl);
      expect(onChangeSpy).toHaveBeenCalled();

      onChangeSpy.reset();
      $location.path('/foo');
      $rootScope.$digest();

      expect($uiRoute.current.templateUrl).toEqual('foo.html');
      expect($uiRoute.current.controller).toBeUndefined();
      expect(onChangeSpy).toHaveBeenCalled();
    });
  });


  it('should chain whens and otherwise', function() {
    module(function($uiRouteProvider){
      $uiRouteProvider.when('/foo', {templateUrl: 'foo.html'}).
                     otherwise({templateUrl: 'bar.html'}).
                     when('/baz', {templateUrl: 'baz.html'});
    });

    inject(function($uiRoute, $location, $rootScope) {
      $rootScope.$digest();
      expect($uiRoute.current.templateUrl).toBe('bar.html');

      $location.url('/baz');
      $rootScope.$digest();
      expect($uiRoute.current.templateUrl).toBe('baz.html');
    });
  });


  describe('events', function() {
    it('should not fire $after/beforeRouteChange during bootstrap (if no route)', function() {
      var routeChangeSpy = jasmine.createSpy('route change');

      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/one', {}); // no otherwise defined
      });

      inject(function($rootScope, $uiRoute, $location) {
        $rootScope.$on('$uiRouteChangeStart', routeChangeSpy);
        $rootScope.$on('$uiRouteChangeSuccess', routeChangeSpy);

        $rootScope.$digest();
        expect(routeChangeSpy).not.toHaveBeenCalled();

        $location.path('/no-route-here');
        $rootScope.$digest();
        expect(routeChangeSpy).not.toHaveBeenCalled();
      });
    });

    it('should fire $uiRouteChangeStart and resolve promises', function() {
      var deferA,
          deferB;

      module(function($provide, $uiRouteProvider) {
        $provide.factory('b', function($q) {
          deferB = $q.defer();
          return deferB.promise;
        });
        $uiRouteProvider.when('/path', { templateUrl: 'foo.html', resolve: {
          a: ['$q', function($q) {
            deferA = $q.defer();
            return deferA.promise;
          }],
          b: 'b'
        } });
      });

      inject(function($location, $uiRoute, $rootScope, $httpBackend) {
        var log = '';

        $httpBackend.expectGET('foo.html').respond('FOO');

        $location.path('/path');
        $rootScope.$digest();
        expect(log).toEqual('');
        $httpBackend.flush();
        expect(log).toEqual('');
        deferA.resolve();
        $rootScope.$digest();
        expect(log).toEqual('');
        deferB.resolve();
        $rootScope.$digest();
        expect($uiRoute.current.locals.$template).toEqual('FOO');
      });
    });


    it('should fire $uiRouteChangeError event on resolution error', function() {
      var deferA;

      module(function($provide, $uiRouteProvider) {
        $uiRouteProvider.when('/path', { template: 'foo', resolve: {
          a: function($q) {
            deferA = $q.defer();
            return deferA.promise;
          }
        } });
      });

      inject(function($location, $uiRoute, $rootScope) {
        var log = '';

        $rootScope.$on('$uiRouteChangeStart', function() { log += 'before();'; });
        $rootScope.$on('$uiRouteChangeError', function(e, n, l, reason) { log += 'failed(' + reason + ');'; });

        $location.path('/path');
        $rootScope.$digest();
        expect(log).toEqual('before();');

        deferA.reject('MyError');
        $rootScope.$digest();
        expect(log).toEqual('before();failed(MyError);');
      });
    });


    it('should fetch templates', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.
          when('/r1', { templateUrl: 'r1.html' }).
          when('/r2', { templateUrl: 'r2.html' });
      });

      inject(function($uiRoute, $httpBackend, $location, $rootScope) {
        var log = '';
        $rootScope.$on('$uiRouteChangeStart', function(e, next) { log += '$before(' + next.templateUrl + ');'});
        $rootScope.$on('$uiRouteChangeSuccess', function(e, next) { log += '$after(' + next.templateUrl + ');'});

        $httpBackend.expectGET('r1.html').respond('R1');
        $httpBackend.expectGET('r2.html').respond('R2');

        $location.path('/r1');
        $rootScope.$digest();
        expect(log).toBe('$before(r1.html);');

        $location.path('/r2');
        $rootScope.$digest();
        expect(log).toBe('$before(r1.html);$before(r2.html);');

        $httpBackend.flush();
        expect(log).toBe('$before(r1.html);$before(r2.html);$after(r2.html);');
        expect(log).not.toContain('$after(r1.html);');
      });
    });


    it('should not update $uiRouteParams until $uiRouteChangeSuccess', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.
          when('/r1/:id', { templateUrl: 'r1.html' }).
          when('/r2/:id', { templateUrl: 'r2.html' });
      });

      inject(function($uiRoute, $httpBackend, $location, $rootScope, $uiRouteParams) {
        var log = '';
        $rootScope.$on('$uiRouteChangeStart', function(e, next) { log += '$before' + toJson($uiRouteParams) + ';'});
        $rootScope.$on('$uiRouteChangeSuccess', function(e, next) { log += '$after' + toJson($uiRouteParams) + ';'});

        $httpBackend.whenGET('r1.html').respond('R1');
        $httpBackend.whenGET('r2.html').respond('R2');

        $location.path('/r1/1');
        $rootScope.$digest();
        expect(log).toBe('$before{};');
        $httpBackend.flush();
        expect(log).toBe('$before{};$after{"id":"1"};');

        log = '';

        $location.path('/r2/2');
        $rootScope.$digest();
        expect(log).toBe('$before{"id":"1"};');
        $httpBackend.flush();
        expect(log).toBe('$before{"id":"1"};$after{"id":"2"};');
      });
    });


    it('should drop in progress route change when new route change occurs', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.
          when('/r1', { templateUrl: 'r1.html' }).
          when('/r2', { templateUrl: 'r2.html' });
      });

      inject(function($uiRoute, $httpBackend, $location, $rootScope) {
        var log = '';
        $rootScope.$on('$uiRouteChangeStart', function(e, next) { log += '$before(' + next.templateUrl + ');'});
        $rootScope.$on('$uiRouteChangeSuccess', function(e, next) { log += '$after(' + next.templateUrl + ');'});

        $httpBackend.expectGET('r1.html').respond('R1');
        $httpBackend.expectGET('r2.html').respond('R2');

        $location.path('/r1');
        $rootScope.$digest();
        expect(log).toBe('$before(r1.html);');

        $location.path('/r2');
        $rootScope.$digest();
        expect(log).toBe('$before(r1.html);$before(r2.html);');

        $httpBackend.flush();
        expect(log).toBe('$before(r1.html);$before(r2.html);$after(r2.html);');
        expect(log).not.toContain('$after(r1.html);');
      });
    });


    it('should drop in progress route change when new route change occurs and old fails', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.
          when('/r1', { templateUrl: 'r1.html' }).
          when('/r2', { templateUrl: 'r2.html' });
      });

      inject(function($uiRoute, $httpBackend, $location, $rootScope) {
        var log = '';
        $rootScope.$on('$uiRouteChangeError', function(e, next, last, error) {
          log += '$failed(' + next.templateUrl + ', ' + error.status + ');';
        });
        $rootScope.$on('$uiRouteChangeStart', function(e, next) { log += '$before(' + next.templateUrl + ');'});
        $rootScope.$on('$uiRouteChangeSuccess', function(e, next) { log += '$after(' + next.templateUrl + ');'});

        $httpBackend.expectGET('r1.html').respond(404, 'R1');
        $httpBackend.expectGET('r2.html').respond('R2');

        $location.path('/r1');
        $rootScope.$digest();
        expect(log).toBe('$before(r1.html);');

        $location.path('/r2');
        $rootScope.$digest();
        expect(log).toBe('$before(r1.html);$before(r2.html);');

        $httpBackend.flush();
        expect(log).toBe('$before(r1.html);$before(r2.html);$after(r2.html);');
        expect(log).not.toContain('$after(r1.html);');
      });
    });


    it('should catch local factory errors', function() {
      var myError = new Error('MyError');
      module(function($uiRouteProvider, $exceptionHandlerProvider) {
        $exceptionHandlerProvider.mode('log');
        $uiRouteProvider.when('/locals', {
          resolve: {
            a: function($q) {
              throw myError;
            }
          }
        });
      });

      inject(function($location, $uiRoute, $rootScope, $exceptionHandler) {
        $location.path('/locals');
        $rootScope.$digest();
        expect($exceptionHandler.errors).toEqual([myError]);
      });
    });
  });


  it('should match route with and without trailing slash', function() {
    module(function($uiRouteProvider){
      $uiRouteProvider.when('/foo', {templateUrl: 'foo.html'});
      $uiRouteProvider.when('/bar/', {templateUrl: 'bar.html'});
    });

    inject(function($uiRoute, $location, $rootScope) {
      $location.path('/foo');
      $rootScope.$digest();
      expect($location.path()).toBe('/foo');
      expect($uiRoute.current.templateUrl).toBe('foo.html');

      $location.path('/foo/');
      $rootScope.$digest();
      expect($location.path()).toBe('/foo');
      expect($uiRoute.current.templateUrl).toBe('foo.html');

      $location.path('/bar');
      $rootScope.$digest();
      expect($location.path()).toBe('/bar/');
      expect($uiRoute.current.templateUrl).toBe('bar.html');

      $location.path('/bar/');
      $rootScope.$digest();
      expect($location.path()).toBe('/bar/');
      expect($uiRoute.current.templateUrl).toBe('bar.html');
    });
  });


  describe('redirection', function() {
    it('should support redirection via redirectTo property by updating $location', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/', {redirectTo: '/foo'});
        $uiRouteProvider.when('/foo', {templateUrl: 'foo.html'});
        $uiRouteProvider.when('/bar', {templateUrl: 'bar.html'});
        $uiRouteProvider.when('/baz', {redirectTo: '/bar'});
        $uiRouteProvider.otherwise({templateUrl: '404.html'});
      });

      inject(function($uiRoute, $location, $rootScope) {
        var onChangeSpy = jasmine.createSpy('onChange');

        $rootScope.$on('$uiRouteChangeStart', onChangeSpy);
        expect($uiRoute.current).toBeUndefined();
        expect(onChangeSpy).not.toHaveBeenCalled();

        $location.path('/');
        $rootScope.$digest();
        expect($location.path()).toBe('/foo');
        expect($uiRoute.current.templateUrl).toBe('foo.html');
        expect(onChangeSpy.callCount).toBe(2);

        onChangeSpy.reset();
        $location.path('/baz');
        $rootScope.$digest();
        expect($location.path()).toBe('/bar');
        expect($uiRoute.current.templateUrl).toBe('bar.html');
        expect(onChangeSpy.callCount).toBe(2);
      });
    });


    it('should interpolate route vars in the redirected path from original path', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/foo/:id/foo/:subid/:extraId', {redirectTo: '/bar/:id/:subid/23'});
        $uiRouteProvider.when('/bar/:id/:subid/:subsubid', {templateUrl: 'bar.html'});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $location.path('/foo/id1/foo/subid3/gah');
        $rootScope.$digest();

        expect($location.path()).toEqual('/bar/id1/subid3/23');
        expect($location.search()).toEqual({extraId: 'gah'});
        expect($uiRoute.current.templateUrl).toEqual('bar.html');
      });
    });


    it('should interpolate route vars in the redirected path from original search', function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/bar/:id/:subid/:subsubid', {templateUrl: 'bar.html'});
        $uiRouteProvider.when('/foo/:id/:extra', {redirectTo: '/bar/:id/:subid/99'});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $location.path('/foo/id3/eId').search('subid=sid1&appended=true');
        $rootScope.$digest();

        expect($location.path()).toEqual('/bar/id3/sid1/99');
        expect($location.search()).toEqual({appended: 'true', extra: 'eId'});
        expect($uiRoute.current.templateUrl).toEqual('bar.html');
      });
    });


    it('should allow custom redirectTo function to be used', function() {
      function customRedirectFn(routePathParams, path, search) {
        expect(routePathParams).toEqual({id: 'id3'});
        expect(path).toEqual('/foo/id3');
        expect(search).toEqual({ subid: 'sid1', appended: 'true' });
        return '/custom';
      }

      module(function($uiRouteProvider){
        $uiRouteProvider.when('/bar/:id/:subid/:subsubid', {templateUrl: 'bar.html'});
        $uiRouteProvider.when('/foo/:id', {redirectTo: customRedirectFn});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $location.path('/foo/id3').search('subid=sid1&appended=true');
        $rootScope.$digest();

        expect($location.path()).toEqual('/custom');
      });
    });


    it('should replace the url when redirecting',  function() {
      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/bar/:id', {templateUrl: 'bar.html'});
        $uiRouteProvider.when('/foo/:id/:extra', {redirectTo: '/bar/:id'});
      });
      inject(function($browser, $uiRoute, $location, $rootScope) {
        var $browserUrl = spyOnlyCallsWithArgs($browser, 'url').andCallThrough();

        $location.path('/foo/id3/eId');
        $rootScope.$digest();

        expect($location.path()).toEqual('/bar/id3');
        expect($browserUrl.mostRecentCall.args)
            .toEqual(['http://server/#/bar/id3?extra=eId', true]);
      });
    });
  });


  describe('reloadOnSearch', function() {
    it('should reload a route when reloadOnSearch is enabled and .search() changes', function() {
      var reloaded = jasmine.createSpy('route reload');

      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/foo', {controller: noop});
      });

      inject(function($uiRoute, $location, $rootScope, $uiRouteParams) {
        $rootScope.$on('$uiRouteChangeStart', reloaded);
        $location.path('/foo');
        $rootScope.$digest();
        expect(reloaded).toHaveBeenCalled();
        expect($uiRouteParams).toEqual({});
        reloaded.reset();

        // trigger reload
        $location.search({foo: 'bar'});
        $rootScope.$digest();
        expect(reloaded).toHaveBeenCalled();
        expect($uiRouteParams).toEqual({foo:'bar'});
      });
    });


    it('should not reload a route when reloadOnSearch is disabled and only .search() changes', function() {
      var routeChange = jasmine.createSpy('route change'),
          routeUpdate = jasmine.createSpy('route update');

      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/foo', {controller: noop, reloadOnSearch: false});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $rootScope.$on('$uiRouteChangeStart', routeChange);
        $rootScope.$on('$uiRouteChangeSuccess', routeChange);
        $rootScope.$on('$uiRouteUpdate', routeUpdate);

        expect(routeChange).not.toHaveBeenCalled();

        $location.path('/foo');
        $rootScope.$digest();
        expect(routeChange).toHaveBeenCalled();
        expect(routeChange.callCount).toBe(2);
        expect(routeUpdate).not.toHaveBeenCalled();
        routeChange.reset();

        // don't trigger reload
        $location.search({foo: 'bar'});
        $rootScope.$digest();
        expect(routeChange).not.toHaveBeenCalled();
        expect(routeUpdate).toHaveBeenCalled();
      });
    });


    it('should reload reloadOnSearch route when url differs only in route path param', function() {
      var routeChange = jasmine.createSpy('route change');

      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/foo/:fooId', {controller: noop, reloadOnSearch: false});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $rootScope.$on('$uiRouteChangeStart', routeChange);
        $rootScope.$on('$uiRouteChangeSuccess', routeChange);

        expect(routeChange).not.toHaveBeenCalled();

        $location.path('/foo/aaa');
        $rootScope.$digest();
        expect(routeChange).toHaveBeenCalled();
        expect(routeChange.callCount).toBe(2);
        routeChange.reset();

        $location.path('/foo/bbb');
        $rootScope.$digest();
        expect(routeChange).toHaveBeenCalled();
        expect(routeChange.callCount).toBe(2);
        routeChange.reset();

        $location.search({foo: 'bar'});
        $rootScope.$digest();
        expect(routeChange).not.toHaveBeenCalled();
      });
    });


    it('should update params when reloadOnSearch is disabled and .search() changes', function() {
      var routeParamsWatcher = jasmine.createSpy('routeParamsWatcher');

      module(function($uiRouteProvider) {
        $uiRouteProvider.when('/foo', {controller: noop});
        $uiRouteProvider.when('/bar/:barId', {controller: noop, reloadOnSearch: false});
      });

      inject(function($uiRoute, $location, $rootScope, $uiRouteParams) {
        $rootScope.$watch(function() {
          return $uiRouteParams;
        }, function(value) {
          routeParamsWatcher(value);
        }, true);

        expect(routeParamsWatcher).not.toHaveBeenCalled();

        $location.path('/foo');
        $rootScope.$digest();
        expect(routeParamsWatcher).toHaveBeenCalledWith({});
        routeParamsWatcher.reset();

        // trigger reload
        $location.search({foo: 'bar'});
        $rootScope.$digest();
        expect(routeParamsWatcher).toHaveBeenCalledWith({foo: 'bar'});
        routeParamsWatcher.reset();

        $location.path('/bar/123').search({});
        $rootScope.$digest();
        expect(routeParamsWatcher).toHaveBeenCalledWith({barId: '123'});
        routeParamsWatcher.reset();

        // don't trigger reload
        $location.search({foo: 'bar'});
        $rootScope.$digest();
        expect(routeParamsWatcher).toHaveBeenCalledWith({barId: '123', foo: 'bar'});
      });
    });


    it('should allow using a function as a template', function() {
      var customTemplateWatcher = jasmine.createSpy('customTemplateWatcher');

      function customTemplateFn(routePathParams) {
        customTemplateWatcher(routePathParams);
        expect(routePathParams).toEqual({id: 'id3'});
        return '<h1>' + routePathParams.id + '</h1>';
      }

      module(function($uiRouteProvider){
        $uiRouteProvider.when('/bar/:id/:subid/:subsubid', {templateUrl: 'bar.html'});
        $uiRouteProvider.when('/foo/:id', {template: customTemplateFn});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $location.path('/foo/id3');
        $rootScope.$digest();

        expect(customTemplateWatcher).toHaveBeenCalledWith({id: 'id3'});
      });
    });


    it('should allow using a function as a templateUrl', function() {
      var customTemplateUrlWatcher = jasmine.createSpy('customTemplateUrlWatcher');

      function customTemplateUrlFn(routePathParams) {
        customTemplateUrlWatcher(routePathParams);
        expect(routePathParams).toEqual({id: 'id3'});
        return 'foo.html';
      }

      module(function($uiRouteProvider){
        $uiRouteProvider.when('/bar/:id/:subid/:subsubid', {templateUrl: 'bar.html'});
        $uiRouteProvider.when('/foo/:id', {templateUrl: customTemplateUrlFn});
      });

      inject(function($uiRoute, $location, $rootScope) {
        $location.path('/foo/id3');
        $rootScope.$digest();

        expect(customTemplateUrlWatcher).toHaveBeenCalledWith({id: 'id3'});
        expect($uiRoute.current.loadedTemplateUrl).toEqual('foo.html');
      });
    });


    describe('reload', function() {

      it('should reload even if reloadOnSearch is false', function() {
        var routeChangeSpy = jasmine.createSpy('route change');

        module(function($uiRouteProvider) {
          $uiRouteProvider.when('/bar/:barId', {controller: noop, reloadOnSearch: false});
        });

        inject(function($uiRoute, $location, $rootScope, $uiRouteParams) {
          $rootScope.$on('$uiRouteChangeSuccess', routeChangeSpy);

          $location.path('/bar/123');
          $rootScope.$digest();
          expect($uiRouteParams).toEqual({barId:'123'});
          expect(routeChangeSpy).toHaveBeenCalledOnce();
          routeChangeSpy.reset();

          $location.path('/bar/123').search('a=b');
          $rootScope.$digest();
          expect($uiRouteParams).toEqual({barId:'123', a:'b'});
          expect(routeChangeSpy).not.toHaveBeenCalled();

          $uiRoute.reload();
          $rootScope.$digest();
          expect($uiRouteParams).toEqual({barId:'123', a:'b'});
          expect(routeChangeSpy).toHaveBeenCalledOnce();
        });
      });
    });
  });
});
