'use strict';

/**
 * @ngdoc directive
 * @name ng.directive:uiView
 * @restrict ECA
 *
 * @description
 * # Overview
 * `uiView` is a directive that complements the {@link ng.$uiRoute $uiRoute} service by
 * including the rendered template of the current route into the main layout (`index.html`) file.
 * Every time the current route changes, the included view changes with it according to the
 * configuration of the `$uiRoute` service.
 *
 * @scope
 * @example
    <example module="uiView">
      <file name="index.html">
        <div ng-controller="MainCntl">
          Choose:
          <a href="Book/Moby">Moby</a> |
          <a href="Book/Moby/ch/1">Moby: Ch1</a> |
          <a href="Book/Gatsby">Gatsby</a> |
          <a href="Book/Gatsby/ch/4?key=value">Gatsby: Ch4</a> |
          <a href="Book/Scarlet">Scarlet Letter</a><br/>

          <div ui-view></div>
          <hr />

          <pre>$location.path() = {{$location.path()}}</pre>
          <pre>$uiRoute.current.templateUrl = {{$uiRoute.current.templateUrl}}</pre>
          <pre>$uiRoute.current.params = {{$uiRoute.current.params}}</pre>
          <pre>$uiRoute.current.scope.name = {{$uiRoute.current.scope.name}}</pre>
          <pre>$uiRouteParams = {{$uiRouteParams}}</pre>
        </div>
      </file>

      <file name="book.html">
        controller: {{name}}<br />
        Book Id: {{params.bookId}}<br />
      </file>

      <file name="chapter.html">
        controller: {{name}}<br />
        Book Id: {{params.bookId}}<br />
        Chapter Id: {{params.chapterId}}
      </file>

      <file name="script.js">
        angular.module('uiView', [], function($uiRouteProvider, $locationProvider) {
          $uiRouteProvider.when('/Book/:bookId', {
            templateUrl: 'book.html',
            controller: BookCntl
          });
          $uiRouteProvider.when('/Book/:bookId/ch/:chapterId', {
            templateUrl: 'chapter.html',
            controller: ChapterCntl
          });

          // configure html5 to get links working on jsfiddle
          $locationProvider.html5Mode(true);
        });

        function MainCntl($scope, $uiRoute, $uiRouteParams, $location) {
          $scope.$uiRoute = $uiRoute;
          $scope.$location = $location;
          $scope.$uiRouteParams = $uiRouteParams;
        }

        function BookCntl($scope, $uiRouteParams) {
          $scope.name = "BookCntl";
          $scope.params = $uiRouteParams;
        }

        function ChapterCntl($scope, $uiRouteParams) {
          $scope.name = "ChapterCntl";
          $scope.params = $uiRouteParams;
        }
      </file>

      <file name="scenario.js">
        it('should load and compile correct template', function() {
          element('a:contains("Moby: Ch1")').click();
          var content = element('.doc-example-live [ui-view]').text();
          expect(content).toMatch(/controller\: ChapterCntl/);
          expect(content).toMatch(/Book Id\: Moby/);
          expect(content).toMatch(/Chapter Id\: 1/);

          element('a:contains("Scarlet")').click();
          content = element('.doc-example-live [ui-view]').text();
          expect(content).toMatch(/controller\: BookCntl/);
          expect(content).toMatch(/Book Id\: Scarlet/);
        });
      </file>
    </example>
 */


/**
 * @ngdoc event
 * @name ng.directive:uiView#$viewContentLoaded
 * @eventOf ng.directive:uiView
 * @eventType emit on the current uiView scope
 * @description
 * Emitted every time the uiView content is reloaded.
 */
var uiViewDirective = ['$http', '$templateCache', '$uiRoute', '$anchorScroll', '$compile',
                       '$controller',
               function($http,   $templateCache,   $uiRoute,   $anchorScroll,   $compile,
                        $controller) {
  return {
    restrict: 'ECA',
    terminal: true,
    link: function(scope, element, attr) {
      var lastScope,
          onloadExp = attr.onload || '';

      scope.$on('$uiRouteChangeSuccess', update);
      update();


      function destroyLastScope() {
        if (lastScope) {
          lastScope.$destroy();
          lastScope = null;
        }
      }

      function clearContent() {
        element.html('');
        destroyLastScope();
      }

      function update() {
        var locals = $uiRoute.current && $uiRoute.current.locals,
            template = locals && locals.$template;

        if (template) {
          element.html(template);
          destroyLastScope();

          var link = $compile(element.contents()),
              current = $uiRoute.current,
              controller;

          lastScope = current.scope = scope.$new();
          if (current.controller) {
            locals.$scope = lastScope;
            controller = $controller(current.controller, locals);
            element.contents().data('$ngControllerController', controller);
          }

          link(lastScope);
          lastScope.$emit('$uiViewContentLoaded');
          lastScope.$eval(onloadExp);

          // $anchorScroll might listen on event...
          $anchorScroll();
        } else {
          clearContent();
        }
      }
    }
  };
}];
