
$ViewDirective.$inject = ['$state', '$compile', '$controller', '$animator', '$anchorScroll'];
function $ViewDirective(   $state,   $compile,   $controller,   $animator,   $anchorScroll) {
  var directive = {
    restrict: 'ECA',
    terminal: true,
    link: function(scope, element, attr) {
      var viewScope, viewLocals,
        name = attr[directive.name] || attr.name || '',
        onloadExp = attr.onload || '',
        animate = $animator(scope, attr);
      
      // Find the details of the parent view directive (if any) and use it
      // to derive our own qualified view name, then hang our own details
      // off the DOM so child directives can find it.
      var parent = element.parent().inheritedData('$uiView');
      if (name.indexOf('@') < 0) name  = name + '@' + (parent ? parent.state.name : '');
      var view = { name: name, state: null };
      element.data('$uiView', view);

      scope.$on('$stateChangeSuccess', updateView);
      updateView();

      function updateView() {
        var locals = $state.$current && $state.$current.locals[name];
        if (locals === viewLocals) return; // nothing to do

        // Destroy previous view scope and remove content (if any)
        if (viewScope) {
          animate.leave(element.contents(), element);
          viewScope.$destroy();
          viewScope = null;
        }

        if (locals) {
          viewLocals = locals;
          view.state = locals.$$state;

          animate.enter(angular.element('<div></div>').html(locals.$template).contents(), element);
          var link = $compile(element.contents());
          viewScope = scope.$new();
          if (locals.$$controller) {
            locals.$scope = viewScope;
            var controller = $controller(locals.$$controller, locals);
            element.children().data('$ngControllerController', controller);
          }
          link(viewScope);
          viewScope.$emit('$viewContentLoaded');
          viewScope.$eval(onloadExp);

          // TODO: This seems strange, shouldn't $anchorScroll listen for $viewContentLoaded if necessary?
          // $anchorScroll might listen on event...
          $anchorScroll();
        } else {
          viewLocals = null;
          view.state = null;
        }
      }
    }
  };
  return directive;
}

angular.module('ui.state').directive('uiView', $ViewDirective);
