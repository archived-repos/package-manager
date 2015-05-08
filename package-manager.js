'use strict';

// task.bower-tmp

var _ = require('jstools-utils'),
    grunt = require('grunt'),
    extend = require('util')._extend,
    path = require('path'),
    typeFiles = {
      'bower': {
        json: ['bower.json', '.bower.json'],
        folder: ['bower_components', '.bower_components']
      },
      'npm': {
        json: ['package.json', '.bower.json'],
        folder: ['node_modules']
      }
    };

function _getDependenciesPath (pkgType) {

  if( grunt.file.isFile('.' + pkgType + 'rc') ) {
    var rc = grunt.file.readJSON('.' + pkgType + 'rc');

    if( rc.directory ) {
      return rc.directory;
    }
  }

  for( var i = 0, list = typeFiles[pkgType].folder || [], len = list.length; i < len; i++ ) {
    if( grunt.file.isDir( process.cwd(), list[i] ) ) {
      return list[i];
    }
  }

  return;

}

function _getPkgJSON (pkgType, cwd) {
  for( var i = 0, list = typeFiles[pkgType].json || [], len = list.length; i < len; i++ ) {
    if( grunt.file.isFile( process.cwd(), cwd, list[i] ) ) {
      return grunt.file.readJSON( path.join(process.cwd(), cwd, list[i]) );
    }
  }
  return;
}

function _getMainFiles (main) {
  if( main === undefined ) {
    return [];
  } else if( typeof main === 'string' ) {
    return [main];
  } else if( main instanceof Array ) {
    return main;
  }
}

function _findMainFiles (cwd, src, pkgJSON, dependenceName) {
  pkgJSON = pkgJSON || _getPkgJSON(this.type, cwd);

  if( !pkgJSON ) {
    return;
  }

  dependenceName = dependenceName || pkgJSON.name;

  if( this.overrides[dependenceName] ) {
    _.extend(pkgJSON, this.overrides[dependenceName]);
  }

  if( this.extend[dependenceName] ) {
    _.merge(pkgJSON, this.extend[dependenceName]);
  }

  if( !this.root ) {
    var mainList = _getMainFiles(pkgJSON.main),
        dependencies;

    for( var i = 0, len = mainList.length ; i < len ; i++ ) {
      this.fileList.push( path.join(cwd, mainList[i]) );
    }
  }

  if( src && this.root ) {
    dependencies = pkgJSON[src];
  } else {
    dependencies = pkgJSON.dependencies;
  }

  this.root = false;

  if( !dependencies ) {
    return this;
  }

  for( var dependence in dependencies ) {
    if( !this.found[dependence] && !this.ignorePackage[dependence] ) {
      this.found[dependence] = dependencies[dependence];
      _findMainFiles.call( this, path.join(this.dependenciesPath, dependence), null, null, dependence );
    }
  }
}

function PkgManager (pkgType, pkgName) {
  this.type = pkgType;
  this.pkgName = pkgName;

  this.dependenciesPath = _getDependenciesPath(pkgType);
  this.pkg = _getPkgJSON(pkgType, pkgName ? ( path.join(this.dependenciesPath, pkgName) ) : '.');

  var thisPkg = this.pkg || {};

  this.overrides = thisPkg.overrides || {};
  this.extend = thisPkg.extend || {};

  if( !this.dependenciesPath ) {
    this.error = 'missing dependenciesPath';
  }
  if( !this.pkg ) {
    this.error = 'missing package ' + pkgType;
  }
}

PkgManager.prototype.find = function (options) {
  if(this.error) {
    throw this.error;
  }
  this.found = {};
  this.root = true;
  options = options || {};

  if( !this.fileList || !options.append ) {
    this.fileList = [];
  }

  if( options.ignorePackages instanceof Array ) {
    this.ignorePackage = {};
    options.ignorePackages.forEach(function (packageName) {
      this.ignorePackage[packageName] = true;
    });
  } else if( options.ignorePackages instanceof Object ) {
    this.ignorePackage = options.ignorePackages;
  } else {
    this.ignorePackage = {};
  }

  _findMainFiles.call(this, options.cwd || '.', options.src, this.pkg);

  return this;
}

PkgManager.prototype.list = function () {
  if(this.error) {
    throw this.error;
  }

  return ( this.fileList || this.find().fileList ).slice();
}

PkgManager.prototype.mainFiles = function () {
  if(this.error) {
    throw this.error;
  }
  var _this = this;
  return _getMainFiles(this.pkg.main).map(function (filePath) {
    return path.join( _this.dependenciesPath, _this.pkgName, filePath );
  });
}

PkgManager.prototype.excludeDependenciesDir = (function () {
  var RE_PKG_BASE;

  return function (filePath) {
    RE_PKG_BASE = RE_PKG_BASE || new RegExp('^' + this.dependenciesPath.replace(/\//g, '\\/') + '\\/');
    return filePath.replace(RE_PKG_BASE, '');
  };
})();

PkgManager.prototype.copy = function (dest, options) {
  if(this.error) {
    throw this.error;
  }
  options = options || {};

  var fileList = ( options instanceof Array ) ? options : undefined;

  if( !fileList && !this.fileList ) {
    this.find(options);
    fileList = this.fileList;
  } else {
    fileList = fileList || this.fileList;
  }

  var expandedList = grunt.file.expand(fileList),
      flatten = options.expand === undefined || !options.expand,
      fileDest;


  for( var i = 0, len = expandedList.length; i < len; i++ ) {
    fileDest = path.join(dest, flatten ? path.basename(expandedList[i]) : this.excludeDependenciesDir(expandedList[i]) );
    grunt.file.copy(expandedList[i], fileDest, { noProcess: true });
  }

  console.log(len, 'files copied to: ' + dest);
}

var RE_EXT = {
  json: /\.json$/i,
  yaml: /\.ya?ml$/i
}

function _parseByType (filePath, text) {

  if( RE_EXT.json.test(filePath) ) {
    return JSON.parse(text);
  }

  if( RE_EXT.yaml.test(filePath) ) {
    return require('yamljs').parse(text);
  }

  return text;
}

PkgManager.prototype.each = function (file, handler, options) {
  if(this.error) {
    throw this.error;
  }
  options = options || {};

  if( file === undefined ) {
    grunt.fail.warn('required file can not me empty');
  }

  if( !(handler instanceof Function) ) {
    grunt.fail.warn('missing loop function');
  }

  var files, i, len, dependence, fileContent, argsFiles,
      path = require('path');

  if( typeof file === 'string' ) {
    files = [file];
  } else if( file instanceof Array ) {
    files = file;
  }

  var srcList = options.src ? ( (options.src instanceof Array) ? options.src : ( typeof options.src === 'string' ? [options.src] : [] ) ) : ['dependencies'],
      found = {};

  for( i = 0, len = srcList.length ; i < len ; i++ ) {
    for( dependence in this.pkg[srcList[i]] ) {
      found[dependence] = true;
    }
  }

  for( dependence in found ) {
    argsFiles = [dependence];
    for( i = 0, len = files.length ; i < len ; i++ ) {
      if( grunt.file.isFile( this.dependenciesPath, dependence, files[i] ) ) {
        fileContent = grunt.file.read( path.join( this.dependenciesPath, dependence, files[i] ) );
        if( options.parse === undefined || options.parse ) {
          fileContent = _parseByType(files[i], fileContent);
        }
        argsFiles.push(fileContent);
      } else {
        grunt.fail.warn('missing ' + path.join( this.dependenciesPath, dependence, files[i] ) );
      }
    }
    handler.apply(this, argsFiles);
  }
};


module.exports = function (pkgType, pkgName) {
  return new PkgManager(pkgType, pkgName);
};
