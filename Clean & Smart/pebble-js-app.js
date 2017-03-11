var __loader = (function() {

var loader = {};

loader.packages = {};

loader.packagesLinenoOrder = [{ filename: 'loader.js', lineno: 0 }];

loader.fileExts = ['?', '?.js', '?.json'];
loader.folderExts = ['?/index.js', '?/index.json'];

loader.basepath = function(path) {
  return path.replace(/[^\/]*$/, '');
};

loader.joinpath = function() {
  var result = arguments[0];
  for (var i = 1; i < arguments.length; ++i) {
    if (arguments[i][0] === '/') {
      result = arguments[i];
    } else if (result[result.length-1] === '/') {
      result += arguments[i];
    } else {
      result += '/' + arguments[i];
    }
  }

  if (result[0] === '/') {
    result = result.substr(1);
  }
  return result;
};

var replace = function(a, regexp, b) {
  var z;
  do {
    z = a;
  } while (z !== (a = a.replace(regexp, b)));
  return z;
};

loader.normalize = function(path) {
  path = replace(path, /(?:(^|\/)\.?\/)+/g, '$1');
  path = replace(path, /[^\/]*\/\.\.\//, '');
  path = path.replace(/\/\/+/g, '/');
  path = path.replace(/^\//, '');
  return path;
};

function _require(module) {
  if (module.exports) {
    return module.exports;
  }

  var require = function(path) { return loader.require(path, module); };

  module.exports = {};
  module.loader(module.exports, module, require);
  module.loaded = true;

  return module.exports;
}

loader.require = function(path, requirer) {
  var module = loader.getPackage(path, requirer);
  if (!module) {
    throw new Error("Cannot find module '" + path + "'");
  }

  return _require(module);
};

var compareLineno = function(a, b) { return a.lineno - b.lineno; };

loader.define = function(path, lineno, loadfun) {
  var module = {
    filename: path,
    lineno: lineno,
    loader: loadfun,
  };

  loader.packages[path] = module;
  loader.packagesLinenoOrder.push(module);
  loader.packagesLinenoOrder.sort(compareLineno);
};

loader.getPackageForPath = function(path) {
  return loader.getPackageForFile(path) || loader.getPackageForDirectory(path);
};

loader.getPackage = function(path, requirer) {
  var module;
  var fullPath;
  if (requirer && requirer.filename) {
    fullPath = loader.joinpath(loader.basepath(requirer.filename), path);
  } else {
    fullPath = path;
  }

if (loader.builtins.indexOf(path) !== -1) {
    return loader.packages[path];
}

  // Try loading the module from a path, if it is trying to load from a path.
  if (path.substr(0, 2) === './' || path.substr(0, 1) === '/' || path.substr(0, 3) === '../') {
    module = loader.getPackageForPath(fullPath);
  }

  if (!module) {
    module = loader.getPackageFromSDK(path);
  }

  if (!module) {
    module = loader.getPackageFromBuildOutput(path);
  }

  if (!module) {
    module = loader.getPackageForNodeModule(path);
  }

  return module;
};

loader.getPackageForFile = function(path) {
  path = loader.normalize(path);

  var module;
  var fileExts = loader.fileExts;
  for (var i = 0, ii = fileExts.length; !module && i < ii; ++i) {
    var filepath = fileExts[i].replace('?', path);
    module = loader.packages[filepath];
  }

  return module;
};

loader.getPackageForDirectory = function(path) {
  path = loader.normalize(path);

  var module;
  var packagePackage = loader.packages[loader.joinpath(path, 'package.json')];
  if (packagePackage) {
    var info = _require(packagePackage);
    if (info.main) {
      module = loader.getPackageForFile(loader.joinpath(path, info.main));
    }
  }

  if (!module) {
    module = loader.getPackageForFile(loader.joinpath(path, 'index'));
  }

  return module;
};

loader.getPackageFromSDK = function (path) {
  return loader.getPackageForPath(path);
};

loader.getPackageFromBuildOutput = function(path) {
  var moduleBuildPath = loader.normalize(loader.joinpath('build', 'js', path));

  return loader.getPackageForPath(moduleBuildPath);
};

// Nested node_modules are banned, so we can do a simple search here.
loader.getPackageForNodeModule = function(path) {
  var modulePath = loader.normalize(loader.joinpath('node_modules', path));

  return loader.getPackageForPath(modulePath);
};

loader.getPackageByLineno = function(lineno) {
  var packages = loader.packagesLinenoOrder;
  var module;
  for (var i = 0, ii = packages.length; i < ii; ++i) {
    var next = packages[i];
    if (next.lineno > lineno) {
      break;
    }
    module = next;
  }
  return module;
};

loader.builtins = ['safe'];

return loader;

})();

__loader.define('safe', 192, function(exports, module, require) {
/* safe.js - Building a safer world for Pebble.JS Developers
 *
 * This library provides wrapper around all the asynchronous handlers that developers
 * have access to so that error messages are caught and displayed nicely in the pebble tool
 * console.
 */

/* global __loader */

var safe = {};

/* The name of the concatenated file to translate */
safe.translateName = 'pebble-js-app.js';

safe.indent = '    ';

/* Translates a source line position to the originating file */
safe.translatePos = function(name, lineno, colno) {
  if (name === safe.translateName) {
    var pkg = __loader.getPackageByLineno(lineno);
    if (pkg) {
      name = pkg.filename;
      lineno -= pkg.lineno;
    }
  }
  return name + ':' + lineno + ':' + colno;
};

var makeTranslateStack = function(stackLineRegExp, translateLine) {
  return function(stack, level) {
    var lines = stack.split('\n');
    var firstStackLine = -1;
    for (var i = lines.length - 1; i >= 0; --i) {
      var m = lines[i].match(stackLineRegExp);
      if (!m) {
        continue;
      }
      var line = lines[i] = translateLine.apply(this, m);
      if (line) {
        firstStackLine = i;
        if (line.indexOf(module.filename) !== -1) {
          lines.splice(i, 1);
        }
      } else {
        lines.splice(i, lines.length - i);
      }
    }
    if (firstStackLine > -1) {
      lines.splice(firstStackLine, level);
    }
    return lines;
  };
};

/* Translates a node style stack trace line */
var translateLineV8 = function(line, msg, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return msg + (scope ? ' ' + scope + ' (' + pos + ')' : pos);
};

/* Matches <msg> (<scope> '(')? <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpV8 = /(.+?)(?:\s+([^\s]+)\s+\()?([^\s@:]+):(\d+):(\d+)\)?/;

safe.translateStackV8 = makeTranslateStack(stackLineRegExpV8, translateLineV8);

/* Translates an iOS stack trace line to node style */
var translateLineIOS = function(line, scope, name, lineno, colno) {
  var pos = safe.translatePos(name, lineno, colno);
  return safe.indent + 'at ' + (scope ? scope  + ' (' + pos + ')' : pos);
};

/* Matches (<scope> '@' )? <name> ':' <lineno> ':' <colno> */
var stackLineRegExpIOS = /(?:([^\s@]+)@)?([^\s@:]+):(\d+):(\d+)/;

safe.translateStackIOS = makeTranslateStack(stackLineRegExpIOS, translateLineIOS);

/* Translates an Android stack trace line to node style */
var translateLineAndroid = function(line, msg, scope, name, lineno, colno) {
  if (name !== 'jskit_startup.js') {
    return translateLineV8(line, msg, scope, name, lineno, colno);
  }
};

/* Matches <msg> <scope> '('? filepath <name> ':' <lineno> ':' <colno> ')'? */
var stackLineRegExpAndroid = /^(.*?)(?:\s+([^\s]+)\s+\()?[^\s\(]*?([^\/]*?):(\d+):(\d+)\)?/;

safe.translateStackAndroid = makeTranslateStack(stackLineRegExpAndroid, translateLineAndroid);

/* Translates a stack trace to the originating files */
safe.translateStack = function(stack, level) {
  level = level || 0;
  if (Pebble.platform === 'pypkjs') {
    return safe.translateStackV8(stack, level);
  } else if (stack.match('com.getpebble.android')) {
    return safe.translateStackAndroid(stack, level);
  } else {
    return safe.translateStackIOS(stack, level);
  }
};

var normalizeIndent = function(lines, pos) {
  pos = pos || 0;
  var label = lines[pos].match(/^[^\s]* /);
  if (label) {
    var indent = label[0].replace(/./g, ' ');
    for (var i = pos + 1, ii = lines.length; i < ii; i++) {
      lines[i] = lines[i].replace(/^\t/, indent);
    }
  }
  return lines;
};

safe.translateError = function(err, intro, level) {
  var name = err.name;
  var message = err.message || err.toString();
  var stack = err.stack;
  var result = [intro || 'JavaScript Error:'];
  if (message && (!stack || stack.indexOf(message) === -1)) {
    if (name && message.indexOf(name + ':') === -1) {
      message = name + ': ' + message;
    }
    result.push(message);
  }
  if (stack) {
    Array.prototype.push.apply(result, safe.translateStack(stack, level));
  }
  return normalizeIndent(result, 1).join('\n');
};

/* Dumps error messages to the console. */
safe.dumpError = function(err, intro, level) {
  if (typeof err === 'object') {
    console.log(safe.translateError(err, intro, level));
  } else {
    console.log('Error: dumpError argument is not an object');
  }
};

/* Logs runtime warnings to the console. */
safe.warn = function(message, level, name) {
  var err = new Error(message);
  err.name = name || 'Warning';
  safe.dumpError(err, 'Warning:', 1);
};

/* Takes a function and return a new function with a call to it wrapped in a try/catch statement */
safe.protect = function(fn) {
  return fn ? function() {
    try {
      fn.apply(this, arguments);
    } catch (err) {
      safe.dumpError(err);
    }
  } : undefined;
};

/* Wrap event handlers added by Pebble.addEventListener */
var pblAddEventListener = Pebble.addEventListener;
Pebble.addEventListener = function(eventName, eventCallback) {
  pblAddEventListener.call(this, eventName, safe.protect(eventCallback));
};

var pblSendMessage = Pebble.sendAppMessage;
Pebble.sendAppMessage = function(message, success, failure) {
  return pblSendMessage.call(this, message, safe.protect(success), safe.protect(failure));
};

/* Wrap setTimeout and setInterval */
var originalSetTimeout = setTimeout;
window.setTimeout = function(callback, delay) {
  if (safe.warnSetTimeoutNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setTimeout was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetTimeoutNotFunction = false;
  }
  return originalSetTimeout(safe.protect(callback), delay);
};

var originalSetInterval = setInterval;
window.setInterval = function(callback, delay) {
  if (safe.warnSetIntervalNotFunction !== false && typeof callback !== 'function') {
    safe.warn('setInterval was called with a `' + (typeof callback) + '` type. ' +
              'Did you mean to pass a function?');
    safe.warnSetIntervalNotFunction = false;
  }
  return originalSetInterval(safe.protect(callback), delay);
};

/* Wrap the geolocation API Callbacks */
var watchPosition = navigator.geolocation.watchPosition;
navigator.geolocation.watchPosition = function(success, error, options) {
  return watchPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var getCurrentPosition = navigator.geolocation.getCurrentPosition;
navigator.geolocation.getCurrentPosition = function(success, error, options) {
  return getCurrentPosition.call(this, safe.protect(success), safe.protect(error), options);
};

var ajax;

/* Try to load the ajax library if available and silently fail if it is not found. */
try {
  ajax = require('ajax');
} catch (err) {}

/* Wrap the success and failure callback of the ajax library */
if (ajax) {
  ajax.onHandler = function(eventName, callback) {
    return safe.protect(callback);
  };
}

module.exports = safe;
});
__loader.define('src/pkjs/app.js', 408, function(exports, module, require) {
var version = '2.29';
var current_settings;

/*  ****************************************** Weather Section **************************************************** */


// converts forecast.io weather icon code to Yahoo weather icon code (to reuse current bitmap with icon set)
  var ForecastIoIconToYahooIcon = function(forecsat_io_icon) {
    var yahoo_icon = 3200; //initialy not defined
    
    switch (forecsat_io_icon){
      case "clear-day":
        yahoo_icon = 32; // sunny
        break;
      case "clear-night":
        yahoo_icon = 31; // clear night
        break;
      case "rain":
        yahoo_icon = 11; // showers
        break;
      case "snow":
        yahoo_icon = 16; // snow
        break;
      case "sleet": 
        yahoo_icon = 18; // sleet
        break;
      case "wind": 
        yahoo_icon = 24; // windy
        break;
      case "fog": 
        yahoo_icon = 20; // foggy
        break;
      case "cloudy":
        yahoo_icon = 26; // cloudy
        break;
      case "partly-cloudy-day":
        yahoo_icon = 30; // partly cloudy day
        break;
      case "partly-cloudy-night":
        yahoo_icon = 29; // partly cloudy night
        break;
    }
    
    return yahoo_icon;
    
  };


//2016-03-25: Updated for Forecast.io
function getWeather(coords /*woeid*/ ) {  
  
      if (current_settings.forecastIoApiKey === '') {
        //console.log ("\n++++ I am inside of 'getWeather()' API KEY NOT DEFINED");
        return;
      }
  
  var temperature;
  var icon;
  
  
  //* var query = 'select item.condition from weather.forecast where woeid =  ' + woeid + ' and u="' + (current_settings.temperatureFormat === 0? 'f' : 'c') + '"';
  //console.log ("++++ I am inside of 'getWeather()' preparing query:" + query);
  
  //* var url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json&env=store://datatables.org/alltableswithkeys';
  var url = 'https://api.forecast.io/forecast/' + current_settings.forecastIoApiKey + '/' + coords + '?exclude=minutely,hourly,daily,alerts,flags&units=' + (current_settings.temperatureFormat === 0? 'us' : 'si');
  //console.log ("++++ I am inside of 'getWeather()' preparing url:" + url);
  
  // ** Send request to Yahoo
  //Send request to Forecast.io
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    
    //console.log  ("++++ I am inside of 'getWeather()' callback. responseText is " + this.responseText);
    
    var json = JSON.parse(this.responseText);
    
    
    temperature = json.currently.temperature;
    console.log  ("++++ I am inside of 'getWeather()' callback. Temperature is " + temperature);
    
    icon = json.currently.icon;
    console.log  ("++++ I am inside of 'getWeather()' callback. Icon code: " + icon);
   
    
    var dictionary = {
      'KEY_WEATHER_CODE': ForecastIoIconToYahooIcon(icon),
      'KEY_WEATHER_TEMP': temperature
    };
    
    // Send to Pebble
    //console.log  ("++++ I am inside of 'getWeather()' callback. About to send message to Pebble");
    Pebble.sendAppMessage(dictionary,
    function(e) {
      //console.log ("++++ I am inside of 'Pebble.sendAppMessage()' callback. Weather info sent to Pebble successfully!");
    },
    function(e) {
      //console.log ("++++ I am inside of 'Pebble.sendAppMessage()' callback. Error sending weather info to Pebble!");
    }
    );
  };
  
  xhr.onerror = function(e) {
    //console.log("I am inside of 'getWeather()' ERROR: " + e.error);
  };
  
  xhr.open('GET', url);
  xhr.send();
}



// on location success querying woeid and getting weather
function locationSuccess(pos) {
//         // We neeed to get the Yahoo woeid first
//         var woeid;
      
//       /* YG 2016-01-25  !!! This query no longer works due to Yahoo bug. Using the one below it !!!  */  
//       // var query = 'select * from geo.placefinder where text="' +
//       //     pos.coords.latitude + ',' + pos.coords.longitude + '" and gflags="R"';
//          var query = 'select locality1 from geo.places where text="(' + 
//              pos.coords.latitude + ',' + pos.coords.longitude + ')" limit 1';
        
//         //console.log ("++++ I am inside of 'locationSuccess()' preparing query:" + query);
//         var url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(query) + '&format=json';
//         //console.log ("++++ I am inside of 'locationSuccess()' preparing URL: " + url);
//         // Send request to Yahoo
//         var xhr = new XMLHttpRequest();
//         xhr.onload = function () {
//           var json = JSON.parse(this.responseText);
          
//           /* YG 2016-01-25  !!! This result no longer works due to Yahoo bug. Using the one below it !!!  */  
//           // woeid = json.query.results.Result.woeid;
//           woeid = json.query.results.place.locality1.woeid;
          
//           //console.log ("++++ I am inside of 'locationSuccess()', woeid received:" + woeid);
//           getWeather(woeid);
//         };
//         xhr.open('GET', url);
//         xhr.send();
  
   // requestion weather from forecast.io
   getWeather(pos.coords.latitude + ',' + pos.coords.longitude);

}




function locationError(err) {
  //console.log ("++++ I am inside of 'locationError: Error requesting location!");
}


// Get Location lat+lon
function getLocation() {
  navigator.geolocation.getCurrentPosition(
    locationSuccess,
    locationError,
    {timeout: 15000, maximumAge: 60000}
  );
}


// Listen for when the watchface is opened
Pebble.addEventListener('ready', 
  function(e) {
      
    //reading current stored settings
    try {
       current_settings = JSON.parse(localStorage.getItem('current_settings'));
    } catch(ex) {
       current_settings = null; 
    }  
    
     if (current_settings === null) {
         current_settings = {
             temperatureFormat: 0,
             hoursMinutesSeparator: 0,
             dateFormat: 0,
             invertColors: 0,
             bluetoothAlert: 0, // new 2.18
             locationService: 0,
             woeid: version >= '2.22'? '' : 0,
             language: 255,
             forecastIoApiKey: ''
         };
     }
    
    //console.log ("++++ I am inside of 'Pebble.addEventListener('ready'): PebbleKit JS ready!");
    var dictionary = {
        "KEY_JSREADY": 1
    };

    // Send to Pebble, so we can load units variable and send it back
    //console.log ("++++ I am inside of 'Pebble.addEventListener('ready') about to send Ready message to phone");
    Pebble.sendAppMessage(dictionary,
      function(e) {
        //console.log ("++++ I am inside of 'Pebble.sendAppMessage() callback: Ready notice sent to phone successfully!");
      },
      function(e) {
        //console.log ("++++ I am inside of 'Pebble.sendAppMessage() callback: Error ready notice to Pebble!");
      }
    ); 
  }
);

// Listen for when an AppMessage is received
Pebble.addEventListener('appmessage',
  function(e) {
    console.log ("++++ I am inside of 'Pebble.addEventListener('appmessage'): AppMessage received");
    
    if (current_settings.locationService == 1) { // for manual location - request weather right away
     //***** console.log ("\n++++ I am inside of 'Pebble.addEventListener('appmessage'): Requesting weather by WOEID");
     // console.log ("\n++++ I am inside of 'Pebble.addEventListener('appmessage'): Requesting weather by coords:" + current_settings.woeid);
      getWeather(current_settings.woeid);
    } else {
       console.log ("++++ I am inside of 'Pebble.addEventListener('appmessage'): Requesting automatic location");
       getLocation();  // for automatic location - get location
    }
    
  }                     
);

/*    ******************************************************************** Config Section ****************************************** */ 

Pebble.addEventListener("showConfiguration",
  function(e) {
   
    //Load the remote config page
   
    //Pebble.openURL("http://codecorner.galanter.net/pebble/clean_smart_config.htm?version=" + version);
    Pebble.openURL("http://ygalanter.github.io/configs/clean_smart/clean_smart_config.htm?version=" + version); //YG 2016-03-15; moved config to github hosting
    
  }
);

Pebble.addEventListener("webviewclosed",
  function(e) {
    
    if (e.response !== '') {
      
      //console.log ("++++ I am inside of 'Pebble.addEventListener(webviewclosed). Resonse from WebView: " + decodeURIComponent(e.response));
      
      //Get JSON dictionary
      var settings = JSON.parse(decodeURIComponent(e.response));
   
      var app_message_json = {};

      // preparing app message
      app_message_json.KEY_HOURS_MINUTES_SEPARATOR = settings.hoursMinutesSeparator;
      app_message_json.KEY_DATE_FORMAT = settings.dateFormat;
      app_message_json.KEY_INVERT_COLORS = settings.invertColors;
      app_message_json.KEY_BLUETOOTH_ALERT = settings.bluetoothAlert; // new 2.18
      app_message_json.KEY_LOCATION_SERVICE = settings.locationService;
      app_message_json.KEY_WEATHER_INTERVAL = settings.weatherInterval;
      app_message_json.KEY_LANGUAGE = settings.language;
     
      // only storing and passing to pebble temperature format if it changed, because it will cause Pebble to reissue weather AJAX
      // (or if forecast.io API Key was set/changed - then we need to update weather as well)
      // (or if coordinates (former woeid) changed - then we need to update weather as well)
      if (current_settings.temperatureFormat != settings.temperatureFormat ||
          current_settings.forecastIoApiKey != settings.forecastIoApiKey ||
          current_settings.woeid != settings.woeid) {
        app_message_json.KEY_TEMPERATURE_FORMAT = settings.temperatureFormat;
      }
      
      // storing new settings
      localStorage.setItem('current_settings', JSON.stringify(settings));
      current_settings = settings;
      
      //console.log ("++++ I am inside of 'Pebble.addEventListener(webviewclosed). About to send settings to the phone");
      Pebble.sendAppMessage(app_message_json,
        function(e) {
          //console.log ("++++ I am inside of 'Pebble.addEventListener(webviewclosed) callback' Data sent to phone successfully!");
        },
        function(e) {
          //console.log ("++++ I am inside of 'Pebble.addEventListener(webviewclosed) callback' Data sent to phone failed!");
        }
      );
    }
  }
);
});
__loader.define('build/js/message_keys.json', 692, function(exports, module, require) {
module.exports = {
    "KEY_BLUETOOTH_ALERT": 7,
    "KEY_DATE_FORMAT": 5,
    "KEY_HOURS_MINUTES_SEPARATOR": 4,
    "KEY_INVERT_COLORS": 6,
    "KEY_JSREADY": 2,
    "KEY_LANGUAGE": 10,
    "KEY_LOCATION_SERVICE": 8,
    "KEY_TEMPERATURE_FORMAT": 3,
    "KEY_WEATHER_CODE": 0,
    "KEY_WEATHER_INTERVAL": 9,
    "KEY_WEATHER_TEMP": 1
};
});
(function() {
  var safe = __loader.require('safe');
  safe.protect(function() {
    __loader.require('./src/pkjs/app');
  })();
})();