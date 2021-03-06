# Welcome to Kudu

Kudu is a micro MVC framework centered around AMD modules and Ractive templates.

Live examples are available <a href="http://kudujs.github.io/kudu-examples/" target="_blank"><h3>here</h3></a>.

kudu provides a router for mapping URLs to controllers. Controllers are essentially AMD modules with a well defined life-cycle consisting
of an "initialization" phase, "rendering" phase and finally a "remove" phase. AMD modules can partake in these phases by implementing the
appropriate method such as "onInit", "onRender", "onRemove" etc.

Each controller has an associated View and Model. The View is a [Ractive](http://www.ractivejs.org/) instance that binds to the Model. The Model is a plain javascript
object generally fetched as data from the server.

What is Ractive
---------------
Ractive is a ViewModel implementation which binds an HTML template to a data object. Ractive uses mustache based html templates and binds
them to Javascript data objects.

For example, given an html template, index.html:

```html
 <!doctype html>
<html lang='en-GB'>
<head>
  <meta charset='utf-8'>
  <title>Ractive test</title>
</head>

<body>
  <h1>Ractive test</h1>

  <!--
       1. This is the element we'll render our Ractive to.
  -->
  <div id='container'></div>

  <!--
       2. You can load a template in many ways. For convenience, we'll include it in
       a script tag so that we don't need to mess around with AJAX or multiline strings.
       Note that we've set the type attribute to 'text/ractive' - though it can be
       just about anything except 'text/javascript'
  -->
  <script id='template' type='text/ractive'>
    <p>Hello, {{name}}!</p>
  </script>
```

and this script:
```javascript
var ractive = new Ractive({
      // The `el` option can be a node, an ID, or a CSS selector.
      el: '#container',

      // We could pass in a string, but for the sake of convenience
      // we're passing the ID of the <script> tag above.
      template: '#template',

      // Here, we're passing in some initial data
      data: { name: 'world' }
    });
```

Running this in a browser will replace the _{{name}}_ mustache with the **name** variable, _world_. Changing the **name** variable will also
update the template eg. In Ractive this can be done with:

```javascript
ractive.set('name', 'Steve');
```

and the template will change from _Hello world_ to _Hello Steve_.

Checkout the [Ractive](http://www.ractivejs.org/) site for comprehensive documentation.

Ractive is a library, not a framework, it does not ship with a router, or specify how to structure your code. Ractive is basically a way
to 'componentize' your html pages, without worrying about navigating between views.

This is where Kudu fits in. Kudu provides the 'C' in MVC. Kudu also provides a router and a way to navigate between views.

Quick example
-------------

A basic _setup_ kudu, mapping URLs to Controllers.

_setup.js_
```javascript
// Import some controllers
var homeCtrl = require("homeCtrl");
var personCtrl = require("personCtrl");

    // Specify the routes
    var routes = {
        home: {path: 'home', ctrl: homeCtrl}
        person: {path: 'person', ctrl: personCtrl}
    };

// Initialize kudu with the given routes and a target id (#someId) where the views will
// be rendered to
    kudu.init({
        target: "#container",
        routes: routes
});
```

Below is a basic _index.html_ template where our single page app (SPA) views will be rendered to.

_index.html
```html
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">        
        <title>Basic Kudu Demo</title>
        <link rel="stylesheet" type="text/css" href="css/site.css" />
    </head>
    <body>
       
        <!-- View will be rendered to the div with id=container -->
        <div id="container"></div>
    </body>
    
    <script data-main="js/app/config/config" src="js/lib/require.js"></script>
</html>
```

The Home Controller is shown next. Controllers must implement an _onInit_ method that returns a Ractive instance.
In the _createView_ function below we create a Ractive instance and pass in the **hello** variable.

_homeCtrl.js_
```javascript
define(function (require) {
	var template = require("rvc!./home"); // Import the home template

	function home() {

		var that = {};

    // Implement the required onInit method that returns a Ractive ViewModel
		that.onInit = function (options) {

			 var view = createView();
			 return view;

		};

		function createView() {
		  var view = new template({
			  data: { // We pass a data object with the hello variable to the Ractive template
				  hello: "Hello World!"
				}
			});
			return view;
		}

		return that;
	}
	return home;
});
```

The home template contains a mustache, _{{hello}}_, which prints out the **hello** variable we passed to the Ractive instance above.

_home.html
```html
<div class="content">
    <div class="row">

        <div class="col-md-12">
            <h1>{{hello}}</h1>
        </div>

    </div>
</div>
```

Setup
-----

Create a web project with the following structure:

```
web
    src
        index.jsp
        css
        js
            app
            lib
                require.js
                ractive.js
                kudu
                    kudu files
            config.js
```

Kudu
----

The kudu module is a facade for the framework and most interaction with the framework is handled by the kudu module.

There is one kudu instance per application.

A new kudu instance is initialized by passing in a "target", an element ID where views will be rendered, and a "routes" object 
which specifies which URLs map to which Controllers.

Here is an example setup.js file showing how to setup and create a kudu instance:

```javascript
var kudu = require("kudu");

// Import some controllers
var homeCtrl = require("homeCtrl");
var personCtrl = require("personCtrl");
var notFoundCtrl = require("notFoundCtrl");

    // Specify the routes
    var routes = {
        home: {path: 'home', ctrl: homeCtrl}
        person: {path: 'person', ctrl: personCtrl}
        notFound: {path: '*', ctrl: notFound}
    };

// Initialize kudu with the given routes and a target id (#someId) where the views will
// be rendered to
    kudu.init({
        target: "#container",
        routes: routes
});
```

Kudu options
------------

Kudu.init() accepts the following options:

```javascript
options = {
        target: // a CSS id selector specifying the DOM node where Views will be 
                // rendered to, eg. "#container",

        routes: // an object mapping URLs to Controller modules,
        defaultRoute: // the default route to load if no path is specified eg.
                      // http://host/ instead of http://host/#home
        unknownRouteResolver: // a function that is called if none of the registered 
            // routes matches the URL

        intro: // a function for performing animations when showing the View
        outro: // a function for performing animations when removing the View
        fx: // Specify weather effects and animations should be enabled or not, default 
            // is false

        viewFactory: // Provides a hook for creating views other than Ractive 
                     // instances. See ViewFactory section below

        debug: // specify debug mode, true or false. Default is true
		};
```

unknownRouteResolver
--------------------
An optional function passed a kudu instance that is called if none of the registered routes matches the URL. This allows users to inject
custom logic to handle this situation.

The function must return a promise which resolves to a route. If the promise is rejected the "notFound" route will be used.

ViewFactory
-----------

A ViewFactory provides global hooks for creating, rendering and unrendering views from the DOM.

A custom ViewFactory must provide three functions:

```javascript
var CustomFactory = {

    createView: function(options) {
        return promise;
    }

    renderView: function(options) {
        return promise;
    }

    unrenderView: function(options) {
        return promise;
    }
}
```

The above functions accepts the following options:

```javascript
	var options = {
    args: // an object that was passed to a new view from the current view
    ctrl: // the controller to create
    mvc: // the current view/controller instance
    route: // the route object to create a new view for
    routeParams: // the URL parameters
    target: // the CSS selector where the view must be rendered to
    viewOrPromise: // an object that was returned from the controller onInit() function,
                   // either a view or a promise that resolves to a view. If onInit doesn't return anything,
                   // null or a promise that is rejected, the view is cancelled and not rendered
};
```

_createView_ must return a promise that resolves to the new view instance. This view instance will be passed to the _renderView_ function

_renderView_ must return a promise that resolves once the view has been rendered to the DOM.

_unrenderView_ must return a promise that resolves once the view has been removed from the DOM.

intro / outro
-------------
These functions provides global hooks for performing animation when showing and hiding views. These functions will be invoked whenever a
view is rendered and unrendered. Note: you can also provide fune grained animations on a per view basis by providing enter/leave functions
in the _route_ object.

_intro_ is called after the view is rendered to the DOM. Here you can provide animations on the view eg. fade the view in

_outro_ is called before the view is removed from the DOM. Here you can provide animations on the view eg. fade the view out

The functions have the following format:
```javascript
var intro = function (options, done) {
}
```

intro/outro options consists of the following values:
```javascript
var options: {
    target:    // the CSS selector where the view was rendered to,
    duration:  // specifies how long the transiton should execute, in milliseconds 
    firstView: // (true/false) specifies if this is the first time a view is rendered
};
```

The _done_ argument is a function to be called once the animation is finished to let kudu know the view is complete.

Router
------
Kudu includes a router that maps url paths to controllers.

The application routes are specified as an object with key/value pairs where each key is the name of the route and the value is the route
itself, which consists of a url _path_ and _controller_.

For example:

```javascript
var routes = {
			home: {path: '/home', ctrl: customer},
			customer: {path: '/customer', ctrl: customer},
			notFound: {path: '*', ctrl: notFound} // if none of the routes match the url,
                // the route defined as, '*', will match and it's controller
                // instantiated.
		};

// Pass the routes to kudu
kudu.init({
    target: "#container",
    routes: routes;
});
```

Route mappings
--------------

The following route mappings are supported:

* **Segment parameters** are specified as a colon with a name eg: /person/**:id**
The following url will match this route: _/person/1_

* Query parameters are specified as ampersand separated values after the questionmark eg: _/person?**id**&**name**_. The following url will match
this route: _/person?**id**=1&**name**=bob_

* Wildcards are specified as an asterisk eg: _/view/**&ast;**/person_. The following url will match this route: _/view/**anything**/person_

Routes
------

Routes consist of the following options:

```javascript
{
    path:     // this is the url path to match
    ctrl:     // if the path matches a url, this controller will be instantiated,
              // alternatively specify the 'moduleId' option for lazy loading of the
    moduleId: // controller if the path matches a url, the controller with this ID
              // will be instantiated, alternatively specify the 'ctrl' option for
              // eager loading of the controller
    enter:    //  a function for manually adding the  view to the DOM and to perform 
              // custom intro animations. By default kudu insert views into the default target
    leave:    //  a function for manually
              // removing the view from the DOM and to perform custom outro
              // animations. By default kudu remove views from the default target
}
```

New routes can also be added to router through router.__addRoute()__.

```javascript
var router = require("kudu/router/router");

router.addRoute(
    path: "/path", {
     ctrl: HomeCtrl
});
```

The route Enter function
------------------------
When navigating between views, Kudu will remove the current view from the DOM and then add the new view to the DOM. If kudu is created with
the _fx_ option set to _true_, Kudu will animate the transition between views, by fading out the current view, remove it from the DOM, add
the new view to the DOM, and finally fading in the new view.

You can customize this behaviour through a custom ViewFactory implementation and _intro_, _outro_ functions that is passed to the new Kudu
instance.

For finer grained control over the creation of views, you can provide an _enter_ function on a per route basis. When providing an _enter_
function, Kudu will delegate the rendering and animation of the view to that function.

The _enter_ function can return a Promise instance in order to perform animations on the view. Kudu will wait until the promise resolves
before continuing with other work.

__NOTE__ if you provide your own _enter_ function and delegate to kudu's own _enter_ function you **must** return the promise from
_kudu.enter_, otherwise kudu will not wait for the _kudu.enter_ function to complete processing and errors could occur.

Example enter function:

```javascript

var route: {
    path: "/home",
    ctrl: HomeController,
    enter: function(options) {
        var d = $.deferred();

        options.view.render(options.target); // Append view to DOM

        $(options.target).slideDown(function() { // Use jQuery to slide the view down
            d.resolve(); // Resolve the promise to notify Kudu that the view is complete
        });

        return d.promise();
    }
}
```

Enter options
-------------

Enter accepts the following options: 

```javascript
var options = {
    ctrl:       // the new controller instance
    view:       // the new view instance
    route:      // the new route instance
    prev: {    // the prev controller options
        ctrl:       // the previous controller instance
        view:       // the previous view instance
        route:      // the previous route instance
    }
    target:     // the default DOM target as passed to the Kudu instance
};
```

The route Leave function
------------------------
Similar to the _enter_ function _ _leave_ provides finer grained control to remove the view from the DOM and animate it.

When providing a _leave_ function, Kudu will delegate the unrendering and animation of the view to that function.

The _leave_ function can return a Promise instance in order to perform animations on the view. Kudu will wait until the promise resolves
before continuing with other work.

__NOTE__ if you provide your own _leave_ function and delegate to kudu's own _leave_ function you **must** return the promise from
_kudu.leave_, otherwise kudu will not wait for the _kudu.leave_ function to complete processing and errors could occur.

Example leave function:

```javascript

var route: {
    path: "/home",
    ctrl: HomeController,
    leave: function(options) {
        var d = $.deferred();

        $(options.target).slideUp(function() { // Use jQuery to slide the view up
            options.view.unrender(options.target); // Remove view from the DOM
            d.resolve(); // Resolve the promise to notify Kudu that the view is complete
        });

        return d.promise();
    }
}
```

Leave options
-------------

Leave accepts the following options: 

```javascript
var options = {
    ctrl:       // the current controller instance
    view:       // the current view instance
    route:      // the current route instance
    next: {     // the next controller options
        ctrl:       // the next controller instance
        view:       // the next view instance
        route:      // the next route instance
    }
    target:     // the default DOM target as passed to the Kudu instance
};
```

Controllers
-----------
Controllers are AMD modules that must return an object which implement an _onInit_ function. _onInit_ must return a Ractive View instance
or a Promise which resolves to a Ractive View. (If you want to implement views in an alternative technology to Ractive, eg. normal HTML,
you can specify a custom _ViewFactory_ to handle different types of views).

If _onInit_ does not return anything, returns null or a promise that is rejected, the view is cancelled and not rendered

Example controller:

```javascript
    define(function (require) {

        var template = require("rvc!./home");
	
        function homeCtrl() {
		
            var that = {}; // The object we will return from our module

            that.onInit = function(options) {
                var data = {hello: "Hello World"};
                var view = new template( { data: data } );
                return view;
            }
		
            return that;
        }

        return homeCtrl;
    });
```

In the home controller above, we return an object that contains an _onInit_ method. _onInit_ receives an _options_ object and must return the view.

In Kudu, views are Ractive instances, consisting of an HTML template and data. Ractive binds the HTML template and data to form the view.

onInit must return a Ractive instance (the view) or a promise which resolves to a Ractive instance.

The Ractive HTML template is imported as an AMD module through the "rvc" plugin. This plugin transforms an HTML Ractive template by compiling
it to a Ractive function, ready to be instantiated.

onInit
------

Controllers in kudu must implement an onInit method. onInit must return a Ractive view instance or function (kudu will instantiate it if needed)
or a promise which resolves to a Ractive view instance or function.

onInit options
--------------

The following options are passed to the onInit method:

```javascript
options = {
  ajaxTracker: // provides a means of registering ajax calls in the controller. Ajax
               // calls tracked this way will automatically abort when the view is
               // removed. ajaxTracker also provides a way to listen to ajax lifecycle
               //  events such as ajax.start / ajax.stop etc. See below

routeParams:   // all URL parameters (including segment parameters and query parameters) 
               // are passed to the controller through the routeParams object.

args:          // arguments passed to the controller from another controller. args can 
               // only be passed to a view when called from a controller, not when 
               // navigating via the URL hash
ctrl:          // The controller instance
route:         // The route that resolved to this controller being initialized

prev: {       // the previous controller options, might be empty if this is the first controller rendered
        args:        // arguments passed to the previous controller
        ctrl:        // The previous controller instance
        route:       // the route that resolved to the previous controller
        routeParams: // the previous controller routeParams
        view:        // the previous controller Ractive view instance}
```


onRemove
--------

Controllers can optionally implement an _onRemove_ method. This method controls whether the view can be removed or not. onRemove must return
either true or false or a promise that resolves to true or false.

If _onRemove_ returns true, the view will be removed. If false, the request will be cancelled and the view will not be removed. This is useful
in situations where a view wants to stop the user from navigating away until changes in a form has been saved, for example.

onRemove options
----------------

The following options are passed to the onRemove method:

```javascript
options = {
  ajaxTracker: // provides a means of registering ajax calls in the controller. Ajax
               //  calls tracked this way will automatically abort when the view is
               //  removed. ajaxTracker also provides a way to listen to ajax lifecycle
               //  events such as ajax.start / ajax.stop etc.

routeParams:   // all URL parameters (including segment parameters and query parameters)
               // are passed to the controller through the routeParams object.

args:          // arguments passed to the controller from another controller. args can
               // only be passed to a view when called from a controller, not when 
               // navigating via the URL hash

view:          // the ractive view instance being removed
ctrl:          // The controller being removed
route:         // The route that resolved to this controller being removed
next: {        // the next controller options
        args:        // arguments passed to the next controller
        ctrl:        // The next controller instance
        route:       // the route that resolved to the next controller
        routeParams: // the next controller routeParams
}
```

Global lifecycle (lc) events
----------------------------

You can subscribe to global lifecycle (lc) events fired by kudu as follows:

```javascript
var kudu = require("kudu/kudu");

// listen on the "lc." (lifecycle) namespace
kudu.on('lc.init', function (e, options) {
    // called whenever a view has been initialized
});

kudu.on('lc.render', function (e, options) {
    // called whenever a view has been rendered
});

kudu.on('lc.complete', function (e, options) {
    // called after a view has been rendered and completed any transitions
});
```

The following global lifecycle events exist:
```
beforeInit     : called before the controller.onInit method is called
init           : called after the controller.onInit method is called
render         : called after the controller's Ractive view has been added to the
                     DOM
complete       : called after the controller's Ractive view has been rendered and
                     completed any transitions
remove          : called after the controller.onRemove method is called successfully. If onRemove
                     returns false or a promise that is rejected, this event is not riggered
beforeUnrender : called before view is removed from the dom. this event only 
                     occurs 
                     if the Controller.onRemove method returns true
unrender       : called after the controller's Ractive view has been removed
                     from the DOM
fail           : called when a view failed to create
```

Global lifecycle event options  
------------------------------
The following options are passed to the events:

```javascript
options = {
    ajaxTracker: // the ajaxTracker of the controller
    routeParams:   // all URL parameters (including segment parameters and query parameters)
    args:          // arguments passed to the controller from another controller
    view:          // the ractive view instance (Note: beforeInit won't have this property)
    ctrl:          // The controller instance for this event
    route:         // The route that resolved to this controller
    initialRoute: // true if this is the first route loaded, false otherwise. Useful if you need to know if the
                  // application loaded for the first time or if a route changed.
    isMainCtrl  : // (experimental) true if the new controller replaces the main view eg. the target 
                  // specified in kudu initialization is replaced. If false
                  // it means the new controller is a sub view on another controller
		eventName   : // name of the event which fired
		error       : // optionally specifies an error (an array of error messages) if an error occurred
    next/prev: {    // the next or previous controller options 
                    // - "prev" for for beforeInit, init, render and complete.
                    // - "next" for remove,  beforeUnrender and unrender.
                    // 'fail' has both "next" and "prev" options, depending on where in the lifecycle the error occurred.
        ajaxTracker: // the ajaxTracker of the prev/next controller
        args:        // arguments passed to the prev/next controller
        ctrl:        // The prev/next controller instance
        route:       // the route that resolved to the prev/next controller
        routeParams: // the prev/next controller routeParams
        view:        // the ractive view instance
    }
}
```

Controller lifecycle events
---------------------------

The following lifecycle events exist on a controller:
```
onInit     : the initialization event which must be implemented by each controller
onRender   : called after the view has been added to the DOM
onComplete : called after the view has been added to the DOM AND once all transitions
             has completed.
onRemove   : called before removing the controller
onUnrender : called after the view has been removed from the DOM
```

Controller lifecycle event options
----------------------------------

The following options are passed to controller events

```javascript
options = {
  ajaxTracker: // provides a means of registering ajax calls in the controller

routeParams:   // all URL parameters (including segment parameters and query parameters)

args:          // arguments passed to the controller from another controller. args can
               // only be passed to a view when called from a controller, not when 
               // navigating via the URL hash

view:          // the ractive view instance (Note: onInit won't have this property)
ctrl:          // The controller instance for this event
route:         // The route that resolved to this controller
next/prev: {        // the next or previous controller options - prev for for onInit, onRender and onComplete,
                    // next for onRemove and onUnrender
        ajaxTracker: // the ajaxTracker of the prev/next controller
        args:        // arguments passed to the prev/next controller
        ctrl:        // The prev/next controller instance
        route:       // the route that resolved to the prev/next controller
        routeParams: // the prev/next controller routeParams
        view:        // the ractive view instance (Note: onRemove won't have this property)
}
```

Controller events example:
--------------------------

```javascript
define(function (require) {

        var template = require("rvc!./home");
	
        function homeCtrl() {
		
            var that = {};

            that.onInit = function(options) {
                // View must be returned from onInit
            
                var view = new template();
                return view;
            }

            that.onRender = function(options) {
                // View has been added to the DOM
            }

            that.onComplete = function(options) {
                // view has been added to the DOM and transitions completed
            }
		
            return that;
        }
        return homeCtrl;
    });
```

AjaxTracker
-----------

An ajaxTracker instance is part of the options passed a controller onInit method.

AjaxTracker provides a way of registering ajax calls to be tracked and aborted
when the view is removed before the ajax calls could complete. This can happen
if your view loads a long running ajax request, and before the request completes,
the user decides to navigate to a different view. Kudu will automatically abort
all running ajax requests registered with the AjaxTracker when users switch views.

It is also possible to manually abort all registered ajax requests through the
ajaxTracker.abort() method.

AjaxTracker also provides the following ajax lifecycle  events:

* global.ajax.start
* ajax.start
* ajax.success
* ajax.error
* ajax.complete
* ajax.stop
* global.ajax.stop

The global.ajax.start event is fired when the first ajax request is added to
ajaxTracker and global.ajax.stop is fired when the last ajax request has completed.

AjaxTracker example
-------------------

We want to track ajax requests when they start and stop. Here is our _start.js_ script:
```
var kudu = require("kudu");

 kudu.on("global.ajax.start", function (options) {
    // When any ajax request starts, we show the loading indicator
    utils.showLoadingIndicator();
});

kudu.on("global.ajax.stop", function (options) {
    // When all ajax requests have stopped, we hide the loading indicator
    utils.hideLoadingIndicator();
});
```

Here is our controller, which shows how to add an ajax request to the ajaxTracker.
```
var kudu = require("kudu");
var $ = require("jquery");

that.onInit = function (options) {

    var promise = new Promise(function (resolve, reject) {

        // We load the json data through an Ajax request
        var xhr = $.getJSON("data/hello.json?delay=2000");

        options.ajaxTracker.add(xhr);

        xhr.then(function (data) {

            // Here we have the data and pass it to the createView method to render
            var view = createView(data);

            // Everything is good, so we resolve the promise, passing in the view
            resolve(view);
        }, function () {
            // Oops, something went wrong, so we reject the promise
            reject("Could not load data for AjaxEvents");
        });
    });

    return promise;
};
```

AjaxTracker API
---------------
AjaxTracker exposes the following API:

```
ajaxTracker.add(xhrOrPromise);    // adds an XmlHttpRequest, JQuery XHR or a promise which 
                                  // has an abort function
ajaxTracker.remove(xhrOrPromise); // removes the xhr or promise added to the AjaxTracker
ajaxTracker.abort();              // manually abort all registered ajax requests
```

Kudu API
--------

Kudu.go(options)
----------------

Kudu.go() provides programmatic navigation between views.

```javascript
var homeCtrl = require("home");
var kudu = ...

kudu.go({ctrl: homeCtrl});
```

go() accepts the following options:
```javascript
var options = {
    ctrl:              // controller module
    id:                // the controller module ID or path to the module
    routeParams:       // the url parameters (an object) to pass to the route. The parameters will be appended 
                       // to the browser's url hash object.
    args:              // the arguments (an object) to pass to the route. 
    force:             // true/false, force navigating to module even if there is no matching route specified
    updateUrl:         // true/false, specifies whether the browser's URL hash should be updated to the 
                       // controller we are navigating to.
    fx:                // true/false, whether transition effects should be applied when rendering the view
    [globalEventName]: // a function that will be called for the specified event eg: veforeInit, init, remove,
                       // render, beforeUnrender, unrender, fail
}
```

Kudu.getId(object)
------------------

Kudu.Id(object) returns the object's id which is either the moduleId or the module's AMD path location

Kudu.getDefaultTarget()
-----------------------

Kudu.getDefaultTarget() returns the selector (generally the element ID) where views will be rendered to.

Kudu.getActiveRoute()
---------------------

Kudu.getActiveRoute() returns the current active route instance.

Kudu.getActiveController()
--------------------------

Kudu.getActiveController() returns the current active controller instance.

Kudu.getActiveView()
--------------------

Kudu.getActiveView() returns the current active view instance.

Checkout Kudu
-------------
To checkout Kudu do the following:

```
git clone https://github.com/kudujs/kudu
cd kudu
```

Building Kudu
-------------
To build kudu, perform the following steps:
```
Update the "version" property in ./package.json
cd jsbuild
npm install
node build
```

The Kudu distribution will be copied to the _dist_ folder.
