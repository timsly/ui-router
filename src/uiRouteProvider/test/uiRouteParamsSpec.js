'use strict';

describe('$uiRouteParams', function() {
  it('should publish the params into a service',  function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/foo', {});
      $uiRouteProvider.when('/bar/:barId', {});
    });

    inject(function($rootScope, $uiRoute, $location, $uiRouteParams) {
      $location.path('/foo').search('a=b');
      $rootScope.$digest();
      expect($uiRouteParams).toEqual({a:'b'});

      $location.path('/bar/123').search('x=abc');
      $rootScope.$digest();
      expect($uiRouteParams).toEqual({barId:'123', x:'abc'});
    });
  });

  it('should correctly extract the params when a param name is part of the route',  function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/bar/:foo/:bar', {});
    });

    inject(function($rootScope, $uiRoute, $location, $uiRouteParams) {
      $location.path('/bar/foovalue/barvalue');
      $rootScope.$digest();
      expect($uiRouteParams).toEqual({bar:'barvalue', foo:'foovalue'});
    });
  });

  it('should support route params not preceded by slashes', function() {
    module(function($uiRouteProvider) {
      $uiRouteProvider.when('/bar:barId/foo:fooId/', {});
    });

    inject(function($rootScope, $uiRoute, $location, $uiRouteParams) {
      $location.path('/barbarvalue/foofoovalue/');
      $rootScope.$digest();
      expect($uiRouteParams).toEqual({barId: 'barvalue', fooId: 'foovalue'});
    });
  });
});
