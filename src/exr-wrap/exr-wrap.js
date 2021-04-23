var EXR = (function() {
  var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
  return (
      function(EXR) {
          EXR = EXR || {};

          var Module = typeof EXR !== "undefined" ? EXR : {};
          var moduleOverrides = {};
          var key;
          for (key in Module) {
              if (Module.hasOwnProperty(key)) {
                  moduleOverrides[key] = Module[key]
              }
          }
          Module["arguments"] = [];
          Module["thisProgram"] = "./this.program";
          Module["quit"] = (function(status, toThrow) {
              throw toThrow
          });
          Module["preRun"] = [];
          Module["postRun"] = [];
          var ENVIRONMENT_IS_WEB = false;
          var ENVIRONMENT_IS_WORKER = false;
          var ENVIRONMENT_IS_NODE = false;
          var ENVIRONMENT_IS_SHELL = false;
          ENVIRONMENT_IS_WEB = typeof window === "object";
          ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
          ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
          ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
          var scriptDirectory = "";

          function locateFile(path) {
              if (Module["locateFile"]) {
                  return Module["locateFile"](path, scriptDirectory)
              } else {
                  return scriptDirectory + path
              }
          }
          if (ENVIRONMENT_IS_NODE) {
              scriptDirectory = __dirname + "/";
              var nodeFS;
              var nodePath;
              Module["read"] = function shell_read(filename, binary) {
                  var ret;
                  if (!nodeFS) nodeFS = require("fs");
                  if (!nodePath) nodePath = require("path");
                  filename = nodePath["normalize"](filename);
                  ret = nodeFS["readFileSync"](filename);
                  return binary ? ret : ret.toString()
              };
              Module["readBinary"] = function readBinary(filename) {
                  var ret = Module["read"](filename, true);
                  if (!ret.buffer) {
                      ret = new Uint8Array(ret)
                  }
                  assert(ret.buffer);
                  return ret
              };
              if (process["argv"].length > 1) {
                  Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
              }
              Module["arguments"] = process["argv"].slice(2);
              process["on"]("uncaughtException", (function(ex) {
                  if (!(ex instanceof ExitStatus)) {
                      throw ex
                  }
              }));
              process["on"]("unhandledRejection", (function(reason, p) {
                  process["exit"](1)
              }));
              Module["quit"] = (function(status) {
                  process["exit"](status)
              });
              Module["inspect"] = (function() {
                  return "[Emscripten Module object]"
              })
          } else if (ENVIRONMENT_IS_SHELL) {
              if (typeof read != "undefined") {
                  Module["read"] = function shell_read(f) {
                      return read(f)
                  }
              }
              Module["readBinary"] = function readBinary(f) {
                  var data;
                  if (typeof readbuffer === "function") {
                      return new Uint8Array(readbuffer(f))
                  }
                  data = read(f, "binary");
                  assert(typeof data === "object");
                  return data
              };
              if (typeof scriptArgs != "undefined") {
                  Module["arguments"] = scriptArgs
              } else if (typeof arguments != "undefined") {
                  Module["arguments"] = arguments
              }
              if (typeof quit === "function") {
                  Module["quit"] = (function(status) {
                      quit(status)
                  })
              }
          } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
              if (ENVIRONMENT_IS_WEB) {
                  if (document.currentScript) {
                      scriptDirectory = document.currentScript.src
                  }
              } else {
                  scriptDirectory = self.location.href
              }
              if (_scriptDir) {
                  scriptDirectory = _scriptDir
              }
              if (scriptDirectory.indexOf("blob:") !== 0) {
                  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
              } else {
                  scriptDirectory = ""
              }
              Module["read"] = function shell_read(url) {
                  var xhr = new XMLHttpRequest;
                  xhr.open("GET", url, false);
                  xhr.send(null);
                  return xhr.responseText
              };
              if (ENVIRONMENT_IS_WORKER) {
                  Module["readBinary"] = function readBinary(url) {
                      var xhr = new XMLHttpRequest;
                      xhr.open("GET", url, false);
                      xhr.responseType = "arraybuffer";
                      xhr.send(null);
                      return new Uint8Array(xhr.response)
                  }
              }
              Module["readAsync"] = function readAsync(url, onload, onerror) {
                  var xhr = new XMLHttpRequest;
                  xhr.open("GET", url, true);
                  xhr.responseType = "arraybuffer";
                  xhr.onload = function xhr_onload() {
                      if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                          onload(xhr.response);
                          return
                      }
                      onerror()
                  };
                  xhr.onerror = onerror;
                  xhr.send(null)
              };
              Module["setWindowTitle"] = (function(title) {
                  document.title = title
              })
          } else {}
          var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);
          var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);
          for (key in moduleOverrides) {
              if (moduleOverrides.hasOwnProperty(key)) {
                  Module[key] = moduleOverrides[key]
              }
          }
          moduleOverrides = undefined;
          var STACK_ALIGN = 16;

          function staticAlloc(size) {
              var ret = STATICTOP;
              STATICTOP = STATICTOP + size + 15 & -16;
              return ret
          }

          function dynamicAlloc(size) {
              var ret = HEAP32[DYNAMICTOP_PTR >> 2];
              var end = ret + size + 15 & -16;
              HEAP32[DYNAMICTOP_PTR >> 2] = end;
              if (end >= TOTAL_MEMORY) {
                  var success = enlargeMemory();
                  if (!success) {
                      HEAP32[DYNAMICTOP_PTR >> 2] = ret;
                      return 0
                  }
              }
              return ret
          }

          function alignMemory(size, factor) {
              if (!factor) factor = STACK_ALIGN;
              var ret = size = Math.ceil(size / factor) * factor;
              return ret
          }
          var asm2wasmImports = {
              "f64-rem": (function(x, y) {
                  return x % y
              }),
              "debugger": (function() {
                  debugger
              })
          };
          var functionPointers = new Array(0);
          var GLOBAL_BASE = 1024;
          var ABORT = false;
          var EXITSTATUS = 0;

          function assert(condition, text) {
              if (!condition) {
                  abort("Assertion failed: " + text)
              }
          }

          function getMemory(size) {
              if (!staticSealed) return staticAlloc(size);
              if (!runtimeInitialized) return dynamicAlloc(size);
              return _malloc(size)
          }

          function Pointer_stringify(ptr, length) {
              if (length === 0 || !ptr) return "";
              var hasUtf = 0;
              var t;
              var i = 0;
              while (1) {
                  t = HEAPU8[ptr + i >> 0];
                  hasUtf |= t;
                  if (t == 0 && !length) break;
                  i++;
                  if (length && i == length) break
              }
              if (!length) length = i;
              var ret = "";
              if (hasUtf < 128) {
                  var MAX_CHUNK = 1024;
                  var curr;
                  while (length > 0) {
                      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
                      ret = ret ? ret + curr : curr;
                      ptr += MAX_CHUNK;
                      length -= MAX_CHUNK
                  }
                  return ret
              }
              return UTF8ToString(ptr)
          }
          var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

          function UTF8ArrayToString(u8Array, idx) {
              var endPtr = idx;
              while (u8Array[endPtr]) ++endPtr;
              if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
                  return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
              } else {
                  var u0, u1, u2, u3, u4, u5;
                  var str = "";
                  while (1) {
                      u0 = u8Array[idx++];
                      if (!u0) return str;
                      if (!(u0 & 128)) {
                          str += String.fromCharCode(u0);
                          continue
                      }
                      u1 = u8Array[idx++] & 63;
                      if ((u0 & 224) == 192) {
                          str += String.fromCharCode((u0 & 31) << 6 | u1);
                          continue
                      }
                      u2 = u8Array[idx++] & 63;
                      if ((u0 & 240) == 224) {
                          u0 = (u0 & 15) << 12 | u1 << 6 | u2
                      } else {
                          u3 = u8Array[idx++] & 63;
                          if ((u0 & 248) == 240) {
                              u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u3
                          } else {
                              u4 = u8Array[idx++] & 63;
                              if ((u0 & 252) == 248) {
                                  u0 = (u0 & 3) << 24 | u1 << 18 | u2 << 12 | u3 << 6 | u4
                              } else {
                                  u5 = u8Array[idx++] & 63;
                                  u0 = (u0 & 1) << 30 | u1 << 24 | u2 << 18 | u3 << 12 | u4 << 6 | u5
                              }
                          }
                      }
                      if (u0 < 65536) {
                          str += String.fromCharCode(u0)
                      } else {
                          var ch = u0 - 65536;
                          str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
                      }
                  }
              }
          }

          function UTF8ToString(ptr) {
              return UTF8ArrayToString(HEAPU8, ptr)
          }

          function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
              if (!(maxBytesToWrite > 0)) return 0;
              var startIdx = outIdx;
              var endIdx = outIdx + maxBytesToWrite - 1;
              for (var i = 0; i < str.length; ++i) {
                  var u = str.charCodeAt(i);
                  if (u >= 55296 && u <= 57343) {
                      var u1 = str.charCodeAt(++i);
                      u = 65536 + ((u & 1023) << 10) | u1 & 1023
                  }
                  if (u <= 127) {
                      if (outIdx >= endIdx) break;
                      outU8Array[outIdx++] = u
                  } else if (u <= 2047) {
                      if (outIdx + 1 >= endIdx) break;
                      outU8Array[outIdx++] = 192 | u >> 6;
                      outU8Array[outIdx++] = 128 | u & 63
                  } else if (u <= 65535) {
                      if (outIdx + 2 >= endIdx) break;
                      outU8Array[outIdx++] = 224 | u >> 12;
                      outU8Array[outIdx++] = 128 | u >> 6 & 63;
                      outU8Array[outIdx++] = 128 | u & 63
                  } else if (u <= 2097151) {
                      if (outIdx + 3 >= endIdx) break;
                      outU8Array[outIdx++] = 240 | u >> 18;
                      outU8Array[outIdx++] = 128 | u >> 12 & 63;
                      outU8Array[outIdx++] = 128 | u >> 6 & 63;
                      outU8Array[outIdx++] = 128 | u & 63
                  } else if (u <= 67108863) {
                      if (outIdx + 4 >= endIdx) break;
                      outU8Array[outIdx++] = 248 | u >> 24;
                      outU8Array[outIdx++] = 128 | u >> 18 & 63;
                      outU8Array[outIdx++] = 128 | u >> 12 & 63;
                      outU8Array[outIdx++] = 128 | u >> 6 & 63;
                      outU8Array[outIdx++] = 128 | u & 63
                  } else {
                      if (outIdx + 5 >= endIdx) break;
                      outU8Array[outIdx++] = 252 | u >> 30;
                      outU8Array[outIdx++] = 128 | u >> 24 & 63;
                      outU8Array[outIdx++] = 128 | u >> 18 & 63;
                      outU8Array[outIdx++] = 128 | u >> 12 & 63;
                      outU8Array[outIdx++] = 128 | u >> 6 & 63;
                      outU8Array[outIdx++] = 128 | u & 63
                  }
              }
              outU8Array[outIdx] = 0;
              return outIdx - startIdx
          }

          function stringToUTF8(str, outPtr, maxBytesToWrite) {
              return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
          }

          function lengthBytesUTF8(str) {
              var len = 0;
              for (var i = 0; i < str.length; ++i) {
                  var u = str.charCodeAt(i);
                  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
                  if (u <= 127) {
                      ++len
                  } else if (u <= 2047) {
                      len += 2
                  } else if (u <= 65535) {
                      len += 3
                  } else if (u <= 2097151) {
                      len += 4
                  } else if (u <= 67108863) {
                      len += 5
                  } else {
                      len += 6
                  }
              }
              return len
          }
          var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

          function allocateUTF8(str) {
              var size = lengthBytesUTF8(str) + 1;
              var ret = _malloc(size);
              if (ret) stringToUTF8Array(str, HEAP8, ret, size);
              return ret
          }
          var WASM_PAGE_SIZE = 65536;
          var ASMJS_PAGE_SIZE = 16777216;
          var MIN_TOTAL_MEMORY = 16777216;

          function alignUp(x, multiple) {
              if (x % multiple > 0) {
                  x += multiple - x % multiple
              }
              return x
          }
          var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

          function updateGlobalBuffer(buf) {
              Module["buffer"] = buffer = buf
          }

          function updateGlobalBufferViews() {
              Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
              Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
              Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
              Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
              Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
              Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
              Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
              Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
          }
          var STATIC_BASE, STATICTOP, staticSealed;
          var STACK_BASE, STACKTOP, STACK_MAX;
          var DYNAMIC_BASE, DYNAMICTOP_PTR;
          STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
          staticSealed = false;

          function abortOnCannotGrowMemory() {
              abort("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ")
          }
          if (!Module["reallocBuffer"]) Module["reallocBuffer"] = (function(size) {
              var ret;
              try {
                  var oldHEAP8 = HEAP8;
                  ret = new ArrayBuffer(size);
                  var temp = new Int8Array(ret);
                  temp.set(oldHEAP8)
              } catch (e) {
                  return false
              }
              var success = _emscripten_replace_memory(ret);
              if (!success) return false;
              return ret
          });

          function enlargeMemory() {
              var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
              var LIMIT = 2147483648 - PAGE_MULTIPLE;
              if (HEAP32[DYNAMICTOP_PTR >> 2] > LIMIT) {
                  return false
              }
              var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
              TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);
              while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR >> 2]) {
                  if (TOTAL_MEMORY <= 536870912) {
                      TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE)
                  } else {
                      TOTAL_MEMORY = Math.min(alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE), LIMIT)
                  }
              }
              var replacement = Module["reallocBuffer"](TOTAL_MEMORY);
              if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
                  TOTAL_MEMORY = OLD_TOTAL_MEMORY;
                  return false
              }
              updateGlobalBuffer(replacement);
              updateGlobalBufferViews();
              return true
          }
          var byteLength;
          try {
              byteLength = Function.prototype.call.bind(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get);
              byteLength(new ArrayBuffer(4))
          } catch (e) {
              byteLength = (function(buffer) {
                  return buffer.byteLength
              })
          }
          var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
          var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
          if (TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
          if (Module["buffer"]) {
              buffer = Module["buffer"]
          } else {
              if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
                  Module["wasmMemory"] = new WebAssembly.Memory({
                      "initial": TOTAL_MEMORY / WASM_PAGE_SIZE
                  });
                  buffer = Module["wasmMemory"].buffer
              } else {
                  buffer = new ArrayBuffer(TOTAL_MEMORY)
              }
              Module["buffer"] = buffer
          }
          updateGlobalBufferViews();

          function getTotalMemory() {
              return TOTAL_MEMORY
          }

          function callRuntimeCallbacks(callbacks) {
              while (callbacks.length > 0) {
                  var callback = callbacks.shift();
                  if (typeof callback == "function") {
                      callback();
                      continue
                  }
                  var func = callback.func;
                  if (typeof func === "number") {
                      if (callback.arg === undefined) {
                          Module["dynCall_v"](func)
                      } else {
                          Module["dynCall_vi"](func, callback.arg)
                      }
                  } else {
                      func(callback.arg === undefined ? null : callback.arg)
                  }
              }
          }
          var __ATPRERUN__ = [];
          var __ATINIT__ = [];
          var __ATMAIN__ = [];
          var __ATPOSTRUN__ = [];
          var runtimeInitialized = false;

          function preRun() {
              if (Module["preRun"]) {
                  if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
                  while (Module["preRun"].length) {
                      addOnPreRun(Module["preRun"].shift())
                  }
              }
              callRuntimeCallbacks(__ATPRERUN__)
          }

          function ensureInitRuntime() {
              if (runtimeInitialized) return;
              runtimeInitialized = true;
              callRuntimeCallbacks(__ATINIT__)
          }

          function preMain() {
              callRuntimeCallbacks(__ATMAIN__)
          }

          function postRun() {
              if (Module["postRun"]) {
                  if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
                  while (Module["postRun"].length) {
                      addOnPostRun(Module["postRun"].shift())
                  }
              }
              callRuntimeCallbacks(__ATPOSTRUN__)
          }

          function addOnPreRun(cb) {
              __ATPRERUN__.unshift(cb)
          }

          function addOnPostRun(cb) {
              __ATPOSTRUN__.unshift(cb)
          }

          function writeArrayToMemory(array, buffer) {
              HEAP8.set(array, buffer)
          }

          function writeAsciiToMemory(str, buffer, dontAddNull) {
              for (var i = 0; i < str.length; ++i) {
                  HEAP8[buffer++ >> 0] = str.charCodeAt(i)
              }
              if (!dontAddNull) HEAP8[buffer >> 0] = 0
          }
          var runDependencies = 0;
          var runDependencyWatcher = null;
          var dependenciesFulfilled = null;

          function addRunDependency(id) {
              runDependencies++;
              if (Module["monitorRunDependencies"]) {
                  Module["monitorRunDependencies"](runDependencies)
              }
          }

          function removeRunDependency(id) {
              runDependencies--;
              if (Module["monitorRunDependencies"]) {
                  Module["monitorRunDependencies"](runDependencies)
              }
              if (runDependencies == 0) {
                  if (runDependencyWatcher !== null) {
                      clearInterval(runDependencyWatcher);
                      runDependencyWatcher = null
                  }
                  if (dependenciesFulfilled) {
                      var callback = dependenciesFulfilled;
                      dependenciesFulfilled = null;
                      callback()
                  }
              }
          }
          Module["preloadedImages"] = {};
          Module["preloadedAudios"] = {};
          var dataURIPrefix = "data:application/octet-stream;base64,";

          function isDataURI(filename) {
              return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
          }

          function integrateWasmJS() {
              var wasmTextFile = "exr-wrap.wast";
              var wasmBinaryFile = "exr-wrap.wasm";
              var asmjsCodeFile = "exr-wrap.temp.asm.js";
              if (!isDataURI(wasmTextFile)) {
                  wasmTextFile = locateFile(wasmTextFile)
              }
              if (!isDataURI(wasmBinaryFile)) {
                  wasmBinaryFile = locateFile(wasmBinaryFile)
              }
              if (!isDataURI(asmjsCodeFile)) {
                  asmjsCodeFile = locateFile(asmjsCodeFile)
              }
              var wasmPageSize = 64 * 1024;
              var info = {
                  "global": null,
                  "env": null,
                  "asm2wasm": asm2wasmImports,
                  "parent": Module
              };
              var exports = null;

              function mergeMemory(newBuffer) {
                  var oldBuffer = Module["buffer"];
                  if (newBuffer.byteLength < oldBuffer.byteLength) {
                      err("the new buffer in mergeMemory is smaller than the previous one. in native wasm, we should grow memory here")
                  }
                  var oldView = new Int8Array(oldBuffer);
                  var newView = new Int8Array(newBuffer);
                  newView.set(oldView);
                  updateGlobalBuffer(newBuffer);
                  updateGlobalBufferViews()
              }

              function fixImports(imports) {
                  return imports
              }

              function getBinary() {
                  try {
                      if (Module["wasmBinary"]) {
                          return new Uint8Array(Module["wasmBinary"])
                      }
                      if (Module["readBinary"]) {
                          return Module["readBinary"](wasmBinaryFile)
                      } else {
                          throw "both async and sync fetching of the wasm failed"
                      }
                  } catch (err) {
                      abort(err)
                  }
              }

              function getBinaryPromise() {
                  if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
                      return fetch(wasmBinaryFile, {
                          credentials: "same-origin"
                      }).then((function(response) {
                          if (!response["ok"]) {
                              throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
                          }
                          return response["arrayBuffer"]()
                      })).catch((function() {
                          return getBinary()
                      }))
                  }
                  return new Promise((function(resolve, reject) {
                      resolve(getBinary())
                  }))
              }

              function doNativeWasm(global, env, providedBuffer) {
                  if (typeof WebAssembly !== "object") {
                      err("no native wasm support detected");
                      return false
                  }
                  if (!(Module["wasmMemory"] instanceof WebAssembly.Memory)) {
                      err("no native wasm Memory in use");
                      return false
                  }
                  env["memory"] = Module["wasmMemory"];
                  info["global"] = {
                      "NaN": NaN,
                      "Infinity": Infinity
                  };
                  info["global.Math"] = Math;
                  info["env"] = env;

                  function receiveInstance(instance, module) {
                      exports = instance.exports;
                      if (exports.memory) mergeMemory(exports.memory);
                      Module["asm"] = exports;
                      Module["usingWasm"] = true;
                      removeRunDependency("wasm-instantiate")
                  }
                  addRunDependency("wasm-instantiate");
                  if (Module["instantiateWasm"]) {
                      try {
                          return Module["instantiateWasm"](info, receiveInstance)
                      } catch (e) {
                          err("Module.instantiateWasm callback failed with error: " + e);
                          return false
                      }
                  }

                  function receiveInstantiatedSource(output) {
                      receiveInstance(output["instance"], output["module"])
                  }

                  function instantiateArrayBuffer(receiver) {
                      getBinaryPromise().then((function(binary) {
                          return WebAssembly.instantiate(binary, info)
                      })).then(receiver).catch((function(reason) {
                          err("failed to asynchronously prepare wasm: " + reason);
                          abort(reason)
                      }))
                  }
                  if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
                      WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
                          credentials: "same-origin"
                      }), info).then(receiveInstantiatedSource).catch((function(reason) {
                          err("wasm streaming compile failed: " + reason);
                          err("falling back to ArrayBuffer instantiation");
                          instantiateArrayBuffer(receiveInstantiatedSource)
                      }))
                  } else {
                      instantiateArrayBuffer(receiveInstantiatedSource)
                  }
                  return {}
              }
              Module["asmPreload"] = Module["asm"];
              var asmjsReallocBuffer = Module["reallocBuffer"];
              var wasmReallocBuffer = (function(size) {
                  var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
                  size = alignUp(size, PAGE_MULTIPLE);
                  var old = Module["buffer"];
                  var oldSize = old.byteLength;
                  if (Module["usingWasm"]) {
                      try {
                          var result = Module["wasmMemory"].grow((size - oldSize) / wasmPageSize);
                          if (result !== (-1 | 0)) {
                              return Module["buffer"] = Module["wasmMemory"].buffer
                          } else {
                              return null
                          }
                      } catch (e) {
                          return null
                      }
                  }
              });
              Module["reallocBuffer"] = (function(size) {
                  if (finalMethod === "asmjs") {
                      return asmjsReallocBuffer(size)
                  } else {
                      return wasmReallocBuffer(size)
                  }
              });
              var finalMethod = "";
              Module["asm"] = (function(global, env, providedBuffer) {
                  env = fixImports(env);
                  if (!env["table"]) {
                      var TABLE_SIZE = Module["wasmTableSize"];
                      if (TABLE_SIZE === undefined) TABLE_SIZE = 1024;
                      var MAX_TABLE_SIZE = Module["wasmMaxTableSize"];
                      if (typeof WebAssembly === "object" && typeof WebAssembly.Table === "function") {
                          if (MAX_TABLE_SIZE !== undefined) {
                              env["table"] = new WebAssembly.Table({
                                  "initial": TABLE_SIZE,
                                  "maximum": MAX_TABLE_SIZE,
                                  "element": "anyfunc"
                              })
                          } else {
                              env["table"] = new WebAssembly.Table({
                                  "initial": TABLE_SIZE,
                                  element: "anyfunc"
                              })
                          }
                      } else {
                          env["table"] = new Array(TABLE_SIZE)
                      }
                      Module["wasmTable"] = env["table"]
                  }
                  if (!env["memoryBase"]) {
                      env["memoryBase"] = Module["STATIC_BASE"]
                  }
                  if (!env["tableBase"]) {
                      env["tableBase"] = 0
                  }
                  var exports;
                  exports = doNativeWasm(global, env, providedBuffer);
                  assert(exports, "no binaryen method succeeded.");
                  return exports
              })
          }
          integrateWasmJS();
          STATIC_BASE = GLOBAL_BASE;
          STATICTOP = STATIC_BASE + 2281952;
          __ATINIT__.push({
              func: (function() {
                  __GLOBAL__sub_I_exr_wrap_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfHeader_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfInputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfOutputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfMisc_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfScanLineInputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfTiledInputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfTiledOutputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfMultiPartOutputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfGenericOutputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfMultiPartInputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfPartType_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfDeepScanLineInputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfDeepScanLineOutputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfDeepTiledInputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_ImfDeepTiledOutputFile_cpp()
              })
          }, {
              func: (function() {
                  __GLOBAL__sub_I_bind_cpp()
              })
          }, {
              func: (function() {
                  ___emscripten_environ_constructor()
              })
          });
          var STATIC_BUMP = 2281952;
          Module["STATIC_BASE"] = STATIC_BASE;
          Module["STATIC_BUMP"] = STATIC_BUMP;
          STATICTOP += 16;
          var ENV = {};

          function ___buildEnvironment(environ) {
              var MAX_ENV_VALUES = 64;
              var TOTAL_ENV_SIZE = 1024;
              var poolPtr;
              var envPtr;
              if (!___buildEnvironment.called) {
                  ___buildEnvironment.called = true;
                  ENV["USER"] = ENV["LOGNAME"] = "web_user";
                  ENV["PATH"] = "/";
                  ENV["PWD"] = "/";
                  ENV["HOME"] = "/home/web_user";
                  ENV["LANG"] = "C.UTF-8";
                  ENV["_"] = Module["thisProgram"];
                  poolPtr = getMemory(TOTAL_ENV_SIZE);
                  envPtr = getMemory(MAX_ENV_VALUES * 4);
                  HEAP32[envPtr >> 2] = poolPtr;
                  HEAP32[environ >> 2] = envPtr
              } else {
                  envPtr = HEAP32[environ >> 2];
                  poolPtr = HEAP32[envPtr >> 2]
              }
              var strings = [];
              var totalSize = 0;
              for (var key in ENV) {
                  if (typeof ENV[key] === "string") {
                      var line = key + "=" + ENV[key];
                      strings.push(line);
                      totalSize += line.length
                  }
              }
              if (totalSize > TOTAL_ENV_SIZE) {
                  throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
              }
              var ptrSize = 4;
              for (var i = 0; i < strings.length; i++) {
                  var line = strings[i];
                  writeAsciiToMemory(line, poolPtr);
                  HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
                  poolPtr += line.length + 1
              }
              HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
          }

          function ___cxa_allocate_exception(size) {
              return _malloc(size)
          }
          var EXCEPTIONS = {
              last: 0,
              caught: [],
              infos: {},
              deAdjust: (function(adjusted) {
                  if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
                  for (var key in EXCEPTIONS.infos) {
                      var ptr = +key;
                      var info = EXCEPTIONS.infos[ptr];
                      if (info.adjusted === adjusted) {
                          return ptr
                      }
                  }
                  return adjusted
              }),
              addRef: (function(ptr) {
                  if (!ptr) return;
                  var info = EXCEPTIONS.infos[ptr];
                  info.refcount++
              }),
              decRef: (function(ptr) {
                  if (!ptr) return;
                  var info = EXCEPTIONS.infos[ptr];
                  assert(info.refcount > 0);
                  info.refcount--;
                  if (info.refcount === 0 && !info.rethrown) {
                      if (info.destructor) {
                          Module["dynCall_vi"](info.destructor, ptr)
                      }
                      delete EXCEPTIONS.infos[ptr];
                      ___cxa_free_exception(ptr)
                  }
              }),
              clearRef: (function(ptr) {
                  if (!ptr) return;
                  var info = EXCEPTIONS.infos[ptr];
                  info.refcount = 0
              })
          };

          function ___cxa_pure_virtual() {
              ABORT = true;
              throw "Pure virtual function called!"
          }

          function ___cxa_throw(ptr, type, destructor) {
              EXCEPTIONS.infos[ptr] = {
                  ptr: ptr,
                  adjusted: ptr,
                  type: type,
                  destructor: destructor,
                  refcount: 0,
                  caught: false,
                  rethrown: false
              };
              EXCEPTIONS.last = ptr;
              if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
                  __ZSt18uncaught_exceptionv.uncaught_exception = 1
              } else {
                  __ZSt18uncaught_exceptionv.uncaught_exception++
              }
              throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch."
          }

          function ___cxa_uncaught_exception() {
              return !!__ZSt18uncaught_exceptionv.uncaught_exception
          }

          function ___lock() {}
          var ERRNO_CODES = {
              EPERM: 1,
              ENOENT: 2,
              ESRCH: 3,
              EINTR: 4,
              EIO: 5,
              ENXIO: 6,
              E2BIG: 7,
              ENOEXEC: 8,
              EBADF: 9,
              ECHILD: 10,
              EAGAIN: 11,
              EWOULDBLOCK: 11,
              ENOMEM: 12,
              EACCES: 13,
              EFAULT: 14,
              ENOTBLK: 15,
              EBUSY: 16,
              EEXIST: 17,
              EXDEV: 18,
              ENODEV: 19,
              ENOTDIR: 20,
              EISDIR: 21,
              EINVAL: 22,
              ENFILE: 23,
              EMFILE: 24,
              ENOTTY: 25,
              ETXTBSY: 26,
              EFBIG: 27,
              ENOSPC: 28,
              ESPIPE: 29,
              EROFS: 30,
              EMLINK: 31,
              EPIPE: 32,
              EDOM: 33,
              ERANGE: 34,
              ENOMSG: 42,
              EIDRM: 43,
              ECHRNG: 44,
              EL2NSYNC: 45,
              EL3HLT: 46,
              EL3RST: 47,
              ELNRNG: 48,
              EUNATCH: 49,
              ENOCSI: 50,
              EL2HLT: 51,
              EDEADLK: 35,
              ENOLCK: 37,
              EBADE: 52,
              EBADR: 53,
              EXFULL: 54,
              ENOANO: 55,
              EBADRQC: 56,
              EBADSLT: 57,
              EDEADLOCK: 35,
              EBFONT: 59,
              ENOSTR: 60,
              ENODATA: 61,
              ETIME: 62,
              ENOSR: 63,
              ENONET: 64,
              ENOPKG: 65,
              EREMOTE: 66,
              ENOLINK: 67,
              EADV: 68,
              ESRMNT: 69,
              ECOMM: 70,
              EPROTO: 71,
              EMULTIHOP: 72,
              EDOTDOT: 73,
              EBADMSG: 74,
              ENOTUNIQ: 76,
              EBADFD: 77,
              EREMCHG: 78,
              ELIBACC: 79,
              ELIBBAD: 80,
              ELIBSCN: 81,
              ELIBMAX: 82,
              ELIBEXEC: 83,
              ENOSYS: 38,
              ENOTEMPTY: 39,
              ENAMETOOLONG: 36,
              ELOOP: 40,
              EOPNOTSUPP: 95,
              EPFNOSUPPORT: 96,
              ECONNRESET: 104,
              ENOBUFS: 105,
              EAFNOSUPPORT: 97,
              EPROTOTYPE: 91,
              ENOTSOCK: 88,
              ENOPROTOOPT: 92,
              ESHUTDOWN: 108,
              ECONNREFUSED: 111,
              EADDRINUSE: 98,
              ECONNABORTED: 103,
              ENETUNREACH: 101,
              ENETDOWN: 100,
              ETIMEDOUT: 110,
              EHOSTDOWN: 112,
              EHOSTUNREACH: 113,
              EINPROGRESS: 115,
              EALREADY: 114,
              EDESTADDRREQ: 89,
              EMSGSIZE: 90,
              EPROTONOSUPPORT: 93,
              ESOCKTNOSUPPORT: 94,
              EADDRNOTAVAIL: 99,
              ENETRESET: 102,
              EISCONN: 106,
              ENOTCONN: 107,
              ETOOMANYREFS: 109,
              EUSERS: 87,
              EDQUOT: 122,
              ESTALE: 116,
              ENOTSUP: 95,
              ENOMEDIUM: 123,
              EILSEQ: 84,
              EOVERFLOW: 75,
              ECANCELED: 125,
              ENOTRECOVERABLE: 131,
              EOWNERDEAD: 130,
              ESTRPIPE: 86
          };

          function ___setErrNo(value) {
              if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
              return value
          }

          function ___map_file(pathname, size) {
              ___setErrNo(ERRNO_CODES.EPERM);
              return -1
          }
          var SYSCALLS = {
              varargs: 0,
              get: (function(varargs) {
                  SYSCALLS.varargs += 4;
                  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
                  return ret
              }),
              getStr: (function() {
                  var ret = Pointer_stringify(SYSCALLS.get());
                  return ret
              }),
              get64: (function() {
                  var low = SYSCALLS.get(),
                      high = SYSCALLS.get();
                  if (low >= 0) assert(high === 0);
                  else assert(high === -1);
                  return low
              }),
              getZero: (function() {
                  assert(SYSCALLS.get() === 0)
              })
          };

          function ___syscall140(which, varargs) {
              SYSCALLS.varargs = varargs;
              try {
                  var stream = SYSCALLS.getStreamFromFD(),
                      offset_high = SYSCALLS.get(),
                      offset_low = SYSCALLS.get(),
                      result = SYSCALLS.get(),
                      whence = SYSCALLS.get();
                  var offset = offset_low;
                  FS.llseek(stream, offset, whence);
                  HEAP32[result >> 2] = stream.position;
                  if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
                  return 0
              } catch (e) {
                  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                  return -e.errno
              }
          }

          function ___syscall146(which, varargs) {
              SYSCALLS.varargs = varargs;
              try {
                  var stream = SYSCALLS.get(),
                      iov = SYSCALLS.get(),
                      iovcnt = SYSCALLS.get();
                  var ret = 0;
                  if (!___syscall146.buffers) {
                      ___syscall146.buffers = [null, [],
                          []
                      ];
                      ___syscall146.printChar = (function(stream, curr) {
                          var buffer = ___syscall146.buffers[stream];
                          assert(buffer);
                          if (curr === 0 || curr === 10) {
                              (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
                              buffer.length = 0
                          } else {
                              buffer.push(curr)
                          }
                      })
                  }
                  for (var i = 0; i < iovcnt; i++) {
                      var ptr = HEAP32[iov + i * 8 >> 2];
                      var len = HEAP32[iov + (i * 8 + 4) >> 2];
                      for (var j = 0; j < len; j++) {
                          ___syscall146.printChar(stream, HEAPU8[ptr + j])
                      }
                      ret += len
                  }
                  return ret
              } catch (e) {
                  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                  return -e.errno
              }
          }

          function ___syscall6(which, varargs) {
              SYSCALLS.varargs = varargs;
              try {
                  var stream = SYSCALLS.getStreamFromFD();
                  FS.close(stream);
                  return 0
              } catch (e) {
                  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                  return -e.errno
              }
          }

          function ___syscall91(which, varargs) {
              SYSCALLS.varargs = varargs;
              try {
                  var addr = SYSCALLS.get(),
                      len = SYSCALLS.get();
                  var info = SYSCALLS.mappings[addr];
                  if (!info) return 0;
                  if (len === info.len) {
                      var stream = FS.getStream(info.fd);
                      SYSCALLS.doMsync(addr, stream, len, info.flags);
                      FS.munmap(stream);
                      SYSCALLS.mappings[addr] = null;
                      if (info.allocated) {
                          _free(info.malloc)
                      }
                  }
                  return 0
              } catch (e) {
                  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                  return -e.errno
              }
          }

          function ___unlock() {}

          function getShiftFromSize(size) {
              switch (size) {
                  case 1:
                      return 0;
                  case 2:
                      return 1;
                  case 4:
                      return 2;
                  case 8:
                      return 3;
                  default:
                      throw new TypeError("Unknown type size: " + size)
              }
          }

          function embind_init_charCodes() {
              var codes = new Array(256);
              for (var i = 0; i < 256; ++i) {
                  codes[i] = String.fromCharCode(i)
              }
              embind_charCodes = codes
          }
          var embind_charCodes = undefined;

          function readLatin1String(ptr) {
              var ret = "";
              var c = ptr;
              while (HEAPU8[c]) {
                  ret += embind_charCodes[HEAPU8[c++]]
              }
              return ret
          }
          var awaitingDependencies = {};
          var registeredTypes = {};
          var typeDependencies = {};
          var char_0 = 48;
          var char_9 = 57;

          function makeLegalFunctionName(name) {
              if (undefined === name) {
                  return "_unknown"
              }
              name = name.replace(/[^a-zA-Z0-9_]/g, "$");
              var f = name.charCodeAt(0);
              if (f >= char_0 && f <= char_9) {
                  return "_" + name
              } else {
                  return name
              }
          }

          function createNamedFunction(name, body) {
              name = makeLegalFunctionName(name);
              return (new Function("body", "return function " + name + "() {\n" + '    "use strict";' + "    return body.apply(this, arguments);\n" + "};\n"))(body)
          }

          function extendError(baseErrorType, errorName) {
              var errorClass = createNamedFunction(errorName, (function(message) {
                  this.name = errorName;
                  this.message = message;
                  var stack = (new Error(message)).stack;
                  if (stack !== undefined) {
                      this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "")
                  }
              }));
              errorClass.prototype = Object.create(baseErrorType.prototype);
              errorClass.prototype.constructor = errorClass;
              errorClass.prototype.toString = (function() {
                  if (this.message === undefined) {
                      return this.name
                  } else {
                      return this.name + ": " + this.message
                  }
              });
              return errorClass
          }
          var BindingError = undefined;

          function throwBindingError(message) {
              throw new BindingError(message)
          }
          var InternalError = undefined;

          function throwInternalError(message) {
              throw new InternalError(message)
          }

          function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
              myTypes.forEach((function(type) {
                  typeDependencies[type] = dependentTypes
              }));

              function onComplete(typeConverters) {
                  var myTypeConverters = getTypeConverters(typeConverters);
                  if (myTypeConverters.length !== myTypes.length) {
                      throwInternalError("Mismatched type converter count")
                  }
                  for (var i = 0; i < myTypes.length; ++i) {
                      registerType(myTypes[i], myTypeConverters[i])
                  }
              }
              var typeConverters = new Array(dependentTypes.length);
              var unregisteredTypes = [];
              var registered = 0;
              dependentTypes.forEach((function(dt, i) {
                  if (registeredTypes.hasOwnProperty(dt)) {
                      typeConverters[i] = registeredTypes[dt]
                  } else {
                      unregisteredTypes.push(dt);
                      if (!awaitingDependencies.hasOwnProperty(dt)) {
                          awaitingDependencies[dt] = []
                      }
                      awaitingDependencies[dt].push((function() {
                          typeConverters[i] = registeredTypes[dt];
                          ++registered;
                          if (registered === unregisteredTypes.length) {
                              onComplete(typeConverters)
                          }
                      }))
                  }
              }));
              if (0 === unregisteredTypes.length) {
                  onComplete(typeConverters)
              }
          }

          function registerType(rawType, registeredInstance, options) {
              options = options || {};
              if (!("argPackAdvance" in registeredInstance)) {
                  throw new TypeError("registerType registeredInstance requires argPackAdvance")
              }
              var name = registeredInstance.name;
              if (!rawType) {
                  throwBindingError('type "' + name + '" must have a positive integer typeid pointer')
              }
              if (registeredTypes.hasOwnProperty(rawType)) {
                  if (options.ignoreDuplicateRegistrations) {
                      return
                  } else {
                      throwBindingError("Cannot register type '" + name + "' twice")
                  }
              }
              registeredTypes[rawType] = registeredInstance;
              delete typeDependencies[rawType];
              if (awaitingDependencies.hasOwnProperty(rawType)) {
                  var callbacks = awaitingDependencies[rawType];
                  delete awaitingDependencies[rawType];
                  callbacks.forEach((function(cb) {
                      cb()
                  }))
              }
          }

          function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
              var shift = getShiftFromSize(size);
              name = readLatin1String(name);
              registerType(rawType, {
                  name: name,
                  "fromWireType": (function(wt) {
                      return !!wt
                  }),
                  "toWireType": (function(destructors, o) {
                      return o ? trueValue : falseValue
                  }),
                  "argPackAdvance": 8,
                  "readValueFromPointer": (function(pointer) {
                      var heap;
                      if (size === 1) {
                          heap = HEAP8
                      } else if (size === 2) {
                          heap = HEAP16
                      } else if (size === 4) {
                          heap = HEAP32
                      } else {
                          throw new TypeError("Unknown boolean type size: " + name)
                      }
                      return this["fromWireType"](heap[pointer >> shift])
                  }),
                  destructorFunction: null
              })
          }

          function ClassHandle_isAliasOf(other) {
              if (!(this instanceof ClassHandle)) {
                  return false
              }
              if (!(other instanceof ClassHandle)) {
                  return false
              }
              var leftClass = this.$$.ptrType.registeredClass;
              var left = this.$$.ptr;
              var rightClass = other.$$.ptrType.registeredClass;
              var right = other.$$.ptr;
              while (leftClass.baseClass) {
                  left = leftClass.upcast(left);
                  leftClass = leftClass.baseClass
              }
              while (rightClass.baseClass) {
                  right = rightClass.upcast(right);
                  rightClass = rightClass.baseClass
              }
              return leftClass === rightClass && left === right
          }

          function shallowCopyInternalPointer(o) {
              return {
                  count: o.count,
                  deleteScheduled: o.deleteScheduled,
                  preservePointerOnDelete: o.preservePointerOnDelete,
                  ptr: o.ptr,
                  ptrType: o.ptrType,
                  smartPtr: o.smartPtr,
                  smartPtrType: o.smartPtrType
              }
          }

          function throwInstanceAlreadyDeleted(obj) {
              function getInstanceTypeName(handle) {
                  return handle.$$.ptrType.registeredClass.name
              }
              throwBindingError(getInstanceTypeName(obj) + " instance already deleted")
          }

          function ClassHandle_clone() {
              if (!this.$$.ptr) {
                  throwInstanceAlreadyDeleted(this)
              }
              if (this.$$.preservePointerOnDelete) {
                  this.$$.count.value += 1;
                  return this
              } else {
                  var clone = Object.create(Object.getPrototypeOf(this), {
                      $$: {
                          value: shallowCopyInternalPointer(this.$$)
                      }
                  });
                  clone.$$.count.value += 1;
                  clone.$$.deleteScheduled = false;
                  return clone
              }
          }

          function runDestructor(handle) {
              var $$ = handle.$$;
              if ($$.smartPtr) {
                  $$.smartPtrType.rawDestructor($$.smartPtr)
              } else {
                  $$.ptrType.registeredClass.rawDestructor($$.ptr)
              }
          }

          function ClassHandle_delete() {
              if (!this.$$.ptr) {
                  throwInstanceAlreadyDeleted(this)
              }
              if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
                  throwBindingError("Object already scheduled for deletion")
              }
              this.$$.count.value -= 1;
              var toDelete = 0 === this.$$.count.value;
              if (toDelete) {
                  runDestructor(this)
              }
              if (!this.$$.preservePointerOnDelete) {
                  this.$$.smartPtr = undefined;
                  this.$$.ptr = undefined
              }
          }

          function ClassHandle_isDeleted() {
              return !this.$$.ptr
          }
          var delayFunction = undefined;
          var deletionQueue = [];

          function flushPendingDeletes() {
              while (deletionQueue.length) {
                  var obj = deletionQueue.pop();
                  obj.$$.deleteScheduled = false;
                  obj["delete"]()
              }
          }

          function ClassHandle_deleteLater() {
              if (!this.$$.ptr) {
                  throwInstanceAlreadyDeleted(this)
              }
              if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
                  throwBindingError("Object already scheduled for deletion")
              }
              deletionQueue.push(this);
              if (deletionQueue.length === 1 && delayFunction) {
                  delayFunction(flushPendingDeletes)
              }
              this.$$.deleteScheduled = true;
              return this
          }

          function init_ClassHandle() {
              ClassHandle.prototype["isAliasOf"] = ClassHandle_isAliasOf;
              ClassHandle.prototype["clone"] = ClassHandle_clone;
              ClassHandle.prototype["delete"] = ClassHandle_delete;
              ClassHandle.prototype["isDeleted"] = ClassHandle_isDeleted;
              ClassHandle.prototype["deleteLater"] = ClassHandle_deleteLater
          }

          function ClassHandle() {}
          var registeredPointers = {};

          function ensureOverloadTable(proto, methodName, humanName) {
              if (undefined === proto[methodName].overloadTable) {
                  var prevFunc = proto[methodName];
                  proto[methodName] = (function() {
                      if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                          throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!")
                      }
                      return proto[methodName].overloadTable[arguments.length].apply(this, arguments)
                  });
                  proto[methodName].overloadTable = [];
                  proto[methodName].overloadTable[prevFunc.argCount] = prevFunc
              }
          }

          function exposePublicSymbol(name, value, numArguments) {
              if (Module.hasOwnProperty(name)) {
                  if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
                      throwBindingError("Cannot register public name '" + name + "' twice")
                  }
                  ensureOverloadTable(Module, name, name);
                  if (Module.hasOwnProperty(numArguments)) {
                      throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!")
                  }
                  Module[name].overloadTable[numArguments] = value
              } else {
                  Module[name] = value;
                  if (undefined !== numArguments) {
                      Module[name].numArguments = numArguments
                  }
              }
          }

          function RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast) {
              this.name = name;
              this.constructor = constructor;
              this.instancePrototype = instancePrototype;
              this.rawDestructor = rawDestructor;
              this.baseClass = baseClass;
              this.getActualType = getActualType;
              this.upcast = upcast;
              this.downcast = downcast;
              this.pureVirtualFunctions = []
          }

          function upcastPointer(ptr, ptrClass, desiredClass) {
              while (ptrClass !== desiredClass) {
                  if (!ptrClass.upcast) {
                      throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name)
                  }
                  ptr = ptrClass.upcast(ptr);
                  ptrClass = ptrClass.baseClass
              }
              return ptr
          }

          function constNoSmartPtrRawPointerToWireType(destructors, handle) {
              if (handle === null) {
                  if (this.isReference) {
                      throwBindingError("null is not a valid " + this.name)
                  }
                  return 0
              }
              if (!handle.$$) {
                  throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
              }
              if (!handle.$$.ptr) {
                  throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
              }
              var handleClass = handle.$$.ptrType.registeredClass;
              var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
              return ptr
          }

          function genericPointerToWireType(destructors, handle) {
              var ptr;
              if (handle === null) {
                  if (this.isReference) {
                      throwBindingError("null is not a valid " + this.name)
                  }
                  if (this.isSmartPointer) {
                      ptr = this.rawConstructor();
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr)
                      }
                      return ptr
                  } else {
                      return 0
                  }
              }
              if (!handle.$$) {
                  throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
              }
              if (!handle.$$.ptr) {
                  throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
              }
              if (!this.isConst && handle.$$.ptrType.isConst) {
                  throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
              }
              var handleClass = handle.$$.ptrType.registeredClass;
              ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
              if (this.isSmartPointer) {
                  if (undefined === handle.$$.smartPtr) {
                      throwBindingError("Passing raw pointer to smart pointer is illegal")
                  }
                  switch (this.sharingPolicy) {
                      case 0:
                          if (handle.$$.smartPtrType === this) {
                              ptr = handle.$$.smartPtr
                          } else {
                              throwBindingError("Cannot convert argument of type " + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + " to parameter type " + this.name)
                          }
                          break;
                      case 1:
                          ptr = handle.$$.smartPtr;
                          break;
                      case 2:
                          if (handle.$$.smartPtrType === this) {
                              ptr = handle.$$.smartPtr
                          } else {
                              var clonedHandle = handle["clone"]();
                              ptr = this.rawShare(ptr, __emval_register((function() {
                                  clonedHandle["delete"]()
                              })));
                              if (destructors !== null) {
                                  destructors.push(this.rawDestructor, ptr)
                              }
                          }
                          break;
                      default:
                          throwBindingError("Unsupporting sharing policy")
                  }
              }
              return ptr
          }

          function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
              if (handle === null) {
                  if (this.isReference) {
                      throwBindingError("null is not a valid " + this.name)
                  }
                  return 0
              }
              if (!handle.$$) {
                  throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name)
              }
              if (!handle.$$.ptr) {
                  throwBindingError("Cannot pass deleted object as a pointer of type " + this.name)
              }
              if (handle.$$.ptrType.isConst) {
                  throwBindingError("Cannot convert argument of type " + handle.$$.ptrType.name + " to parameter type " + this.name)
              }
              var handleClass = handle.$$.ptrType.registeredClass;
              var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
              return ptr
          }

          function simpleReadValueFromPointer(pointer) {
              return this["fromWireType"](HEAPU32[pointer >> 2])
          }

          function RegisteredPointer_getPointee(ptr) {
              if (this.rawGetPointee) {
                  ptr = this.rawGetPointee(ptr)
              }
              return ptr
          }

          function RegisteredPointer_destructor(ptr) {
              if (this.rawDestructor) {
                  this.rawDestructor(ptr)
              }
          }

          function RegisteredPointer_deleteObject(handle) {
              if (handle !== null) {
                  handle["delete"]()
              }
          }

          function downcastPointer(ptr, ptrClass, desiredClass) {
              if (ptrClass === desiredClass) {
                  return ptr
              }
              if (undefined === desiredClass.baseClass) {
                  return null
              }
              var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
              if (rv === null) {
                  return null
              }
              return desiredClass.downcast(rv)
          }

          function getInheritedInstanceCount() {
              return Object.keys(registeredInstances).length
          }

          function getLiveInheritedInstances() {
              var rv = [];
              for (var k in registeredInstances) {
                  if (registeredInstances.hasOwnProperty(k)) {
                      rv.push(registeredInstances[k])
                  }
              }
              return rv
          }

          function setDelayFunction(fn) {
              delayFunction = fn;
              if (deletionQueue.length && delayFunction) {
                  delayFunction(flushPendingDeletes)
              }
          }

          function init_embind() {
              Module["getInheritedInstanceCount"] = getInheritedInstanceCount;
              Module["getLiveInheritedInstances"] = getLiveInheritedInstances;
              Module["flushPendingDeletes"] = flushPendingDeletes;
              Module["setDelayFunction"] = setDelayFunction
          }
          var registeredInstances = {};

          function getBasestPointer(class_, ptr) {
              if (ptr === undefined) {
                  throwBindingError("ptr should not be undefined")
              }
              while (class_.baseClass) {
                  ptr = class_.upcast(ptr);
                  class_ = class_.baseClass
              }
              return ptr
          }

          function getInheritedInstance(class_, ptr) {
              ptr = getBasestPointer(class_, ptr);
              return registeredInstances[ptr]
          }

          function makeClassHandle(prototype, record) {
              if (!record.ptrType || !record.ptr) {
                  throwInternalError("makeClassHandle requires ptr and ptrType")
              }
              var hasSmartPtrType = !!record.smartPtrType;
              var hasSmartPtr = !!record.smartPtr;
              if (hasSmartPtrType !== hasSmartPtr) {
                  throwInternalError("Both smartPtrType and smartPtr must be specified")
              }
              record.count = {
                  value: 1
              };
              return Object.create(prototype, {
                  $$: {
                      value: record
                  }
              })
          }

          function RegisteredPointer_fromWireType(ptr) {
              var rawPointer = this.getPointee(ptr);
              if (!rawPointer) {
                  this.destructor(ptr);
                  return null
              }
              var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
              if (undefined !== registeredInstance) {
                  if (0 === registeredInstance.$$.count.value) {
                      registeredInstance.$$.ptr = rawPointer;
                      registeredInstance.$$.smartPtr = ptr;
                      return registeredInstance["clone"]()
                  } else {
                      var rv = registeredInstance["clone"]();
                      this.destructor(ptr);
                      return rv
                  }
              }

              function makeDefaultHandle() {
                  if (this.isSmartPointer) {
                      return makeClassHandle(this.registeredClass.instancePrototype, {
                          ptrType: this.pointeeType,
                          ptr: rawPointer,
                          smartPtrType: this,
                          smartPtr: ptr
                      })
                  } else {
                      return makeClassHandle(this.registeredClass.instancePrototype, {
                          ptrType: this,
                          ptr: ptr
                      })
                  }
              }
              var actualType = this.registeredClass.getActualType(rawPointer);
              var registeredPointerRecord = registeredPointers[actualType];
              if (!registeredPointerRecord) {
                  return makeDefaultHandle.call(this)
              }
              var toType;
              if (this.isConst) {
                  toType = registeredPointerRecord.constPointerType
              } else {
                  toType = registeredPointerRecord.pointerType
              }
              var dp = downcastPointer(rawPointer, this.registeredClass, toType.registeredClass);
              if (dp === null) {
                  return makeDefaultHandle.call(this)
              }
              if (this.isSmartPointer) {
                  return makeClassHandle(toType.registeredClass.instancePrototype, {
                      ptrType: toType,
                      ptr: dp,
                      smartPtrType: this,
                      smartPtr: ptr
                  })
              } else {
                  return makeClassHandle(toType.registeredClass.instancePrototype, {
                      ptrType: toType,
                      ptr: dp
                  })
              }
          }

          function init_RegisteredPointer() {
              RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
              RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
              RegisteredPointer.prototype["argPackAdvance"] = 8;
              RegisteredPointer.prototype["readValueFromPointer"] = simpleReadValueFromPointer;
              RegisteredPointer.prototype["deleteObject"] = RegisteredPointer_deleteObject;
              RegisteredPointer.prototype["fromWireType"] = RegisteredPointer_fromWireType
          }

          function RegisteredPointer(name, registeredClass, isReference, isConst, isSmartPointer, pointeeType, sharingPolicy, rawGetPointee, rawConstructor, rawShare, rawDestructor) {
              this.name = name;
              this.registeredClass = registeredClass;
              this.isReference = isReference;
              this.isConst = isConst;
              this.isSmartPointer = isSmartPointer;
              this.pointeeType = pointeeType;
              this.sharingPolicy = sharingPolicy;
              this.rawGetPointee = rawGetPointee;
              this.rawConstructor = rawConstructor;
              this.rawShare = rawShare;
              this.rawDestructor = rawDestructor;
              if (!isSmartPointer && registeredClass.baseClass === undefined) {
                  if (isConst) {
                      this["toWireType"] = constNoSmartPtrRawPointerToWireType;
                      this.destructorFunction = null
                  } else {
                      this["toWireType"] = nonConstNoSmartPtrRawPointerToWireType;
                      this.destructorFunction = null
                  }
              } else {
                  this["toWireType"] = genericPointerToWireType
              }
          }

          function replacePublicSymbol(name, value, numArguments) {
              if (!Module.hasOwnProperty(name)) {
                  throwInternalError("Replacing nonexistant public symbol")
              }
              if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
                  Module[name].overloadTable[numArguments] = value
              } else {
                  Module[name] = value;
                  Module[name].argCount = numArguments
              }
          }

          function embind__requireFunction(signature, rawFunction) {
              signature = readLatin1String(signature);

              function makeDynCaller(dynCall) {
                  var args = [];
                  for (var i = 1; i < signature.length; ++i) {
                      args.push("a" + i)
                  }
                  var name = "dynCall_" + signature + "_" + rawFunction;
                  var body = "return function " + name + "(" + args.join(", ") + ") {\n";
                  body += "    return dynCall(rawFunction" + (args.length ? ", " : "") + args.join(", ") + ");\n";
                  body += "};\n";
                  return (new Function("dynCall", "rawFunction", body))(dynCall, rawFunction)
              }
              var fp;
              if (Module["FUNCTION_TABLE_" + signature] !== undefined) {
                  fp = Module["FUNCTION_TABLE_" + signature][rawFunction]
              } else if (typeof FUNCTION_TABLE !== "undefined") {
                  fp = FUNCTION_TABLE[rawFunction]
              } else {
                  var dc = Module["asm"]["dynCall_" + signature];
                  if (dc === undefined) {
                      dc = Module["asm"]["dynCall_" + signature.replace(/f/g, "d")];
                      if (dc === undefined) {
                          throwBindingError("No dynCall invoker for signature: " + signature)
                      }
                  }
                  fp = makeDynCaller(dc)
              }
              if (typeof fp !== "function") {
                  throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction)
              }
              return fp
          }
          var UnboundTypeError = undefined;

          function getTypeName(type) {
              var ptr = ___getTypeName(type);
              var rv = readLatin1String(ptr);
              _free(ptr);
              return rv
          }

          function throwUnboundTypeError(message, types) {
              var unboundTypes = [];
              var seen = {};

              function visit(type) {
                  if (seen[type]) {
                      return
                  }
                  if (registeredTypes[type]) {
                      return
                  }
                  if (typeDependencies[type]) {
                      typeDependencies[type].forEach(visit);
                      return
                  }
                  unboundTypes.push(type);
                  seen[type] = true
              }
              types.forEach(visit);
              throw new UnboundTypeError(message + ": " + unboundTypes.map(getTypeName).join([", "]))
          }

          function __embind_register_class(rawType, rawPointerType, rawConstPointerType, baseClassRawType, getActualTypeSignature, getActualType, upcastSignature, upcast, downcastSignature, downcast, name, destructorSignature, rawDestructor) {
              name = readLatin1String(name);
              getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
              if (upcast) {
                  upcast = embind__requireFunction(upcastSignature, upcast)
              }
              if (downcast) {
                  downcast = embind__requireFunction(downcastSignature, downcast)
              }
              rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
              var legalFunctionName = makeLegalFunctionName(name);
              exposePublicSymbol(legalFunctionName, (function() {
                  throwUnboundTypeError("Cannot construct " + name + " due to unbound types", [baseClassRawType])
              }));
              whenDependentTypesAreResolved([rawType, rawPointerType, rawConstPointerType], baseClassRawType ? [baseClassRawType] : [], (function(base) {
                  base = base[0];
                  var baseClass;
                  var basePrototype;
                  if (baseClassRawType) {
                      baseClass = base.registeredClass;
                      basePrototype = baseClass.instancePrototype
                  } else {
                      basePrototype = ClassHandle.prototype
                  }
                  var constructor = createNamedFunction(legalFunctionName, (function() {
                      if (Object.getPrototypeOf(this) !== instancePrototype) {
                          throw new BindingError("Use 'new' to construct " + name)
                      }
                      if (undefined === registeredClass.constructor_body) {
                          throw new BindingError(name + " has no accessible constructor")
                      }
                      var body = registeredClass.constructor_body[arguments.length];
                      if (undefined === body) {
                          throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!")
                      }
                      return body.apply(this, arguments)
                  }));
                  var instancePrototype = Object.create(basePrototype, {
                      constructor: {
                          value: constructor
                      }
                  });
                  constructor.prototype = instancePrototype;
                  var registeredClass = new RegisteredClass(name, constructor, instancePrototype, rawDestructor, baseClass, getActualType, upcast, downcast);
                  var referenceConverter = new RegisteredPointer(name, registeredClass, true, false, false);
                  var pointerConverter = new RegisteredPointer(name + "*", registeredClass, false, false, false);
                  var constPointerConverter = new RegisteredPointer(name + " const*", registeredClass, false, true, false);
                  registeredPointers[rawType] = {
                      pointerType: pointerConverter,
                      constPointerType: constPointerConverter
                  };
                  replacePublicSymbol(legalFunctionName, constructor);
                  return [referenceConverter, pointerConverter, constPointerConverter]
              }))
          }

          function heap32VectorToArray(count, firstElement) {
              var array = [];
              for (var i = 0; i < count; i++) {
                  array.push(HEAP32[(firstElement >> 2) + i])
              }
              return array
          }

          function runDestructors(destructors) {
              while (destructors.length) {
                  var ptr = destructors.pop();
                  var del = destructors.pop();
                  del(ptr)
              }
          }

          function __embind_register_class_constructor(rawClassType, argCount, rawArgTypesAddr, invokerSignature, invoker, rawConstructor) {
              var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
              invoker = embind__requireFunction(invokerSignature, invoker);
              whenDependentTypesAreResolved([], [rawClassType], (function(classType) {
                  classType = classType[0];
                  var humanName = "constructor " + classType.name;
                  if (undefined === classType.registeredClass.constructor_body) {
                      classType.registeredClass.constructor_body = []
                  }
                  if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
                      throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount - 1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!")
                  }
                  classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
                      throwUnboundTypeError("Cannot construct " + classType.name + " due to unbound types", rawArgTypes)
                  };
                  whenDependentTypesAreResolved([], rawArgTypes, (function(argTypes) {
                      classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                          if (arguments.length !== argCount - 1) {
                              throwBindingError(humanName + " called with " + arguments.length + " arguments, expected " + (argCount - 1))
                          }
                          var destructors = [];
                          var args = new Array(argCount);
                          args[0] = rawConstructor;
                          for (var i = 1; i < argCount; ++i) {
                              args[i] = argTypes[i]["toWireType"](destructors, arguments[i - 1])
                          }
                          var ptr = invoker.apply(null, args);
                          runDestructors(destructors);
                          return argTypes[0]["fromWireType"](ptr)
                      };
                      return []
                  }));
                  return []
              }))
          }

          function new_(constructor, argumentList) {
              if (!(constructor instanceof Function)) {
                  throw new TypeError("new_ called with constructor type " + typeof constructor + " which is not a function")
              }
              var dummy = createNamedFunction(constructor.name || "unknownFunctionName", (function() {}));
              dummy.prototype = constructor.prototype;
              var obj = new dummy;
              var r = constructor.apply(obj, argumentList);
              return r instanceof Object ? r : obj
          }

          function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
              var argCount = argTypes.length;
              if (argCount < 2) {
                  throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!")
              }
              var isClassMethodFunc = argTypes[1] !== null && classType !== null;
              var needsDestructorStack = false;
              for (var i = 1; i < argTypes.length; ++i) {
                  if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
                      needsDestructorStack = true;
                      break
                  }
              }
              var returns = argTypes[0].name !== "void";
              var argsList = "";
              var argsListWired = "";
              for (var i = 0; i < argCount - 2; ++i) {
                  argsList += (i !== 0 ? ", " : "") + "arg" + i;
                  argsListWired += (i !== 0 ? ", " : "") + "arg" + i + "Wired"
              }
              var invokerFnBody = "return function " + makeLegalFunctionName(humanName) + "(" + argsList + ") {\n" + "if (arguments.length !== " + (argCount - 2) + ") {\n" + "throwBindingError('function " + humanName + " called with ' + arguments.length + ' arguments, expected " + (argCount - 2) + " args!');\n" + "}\n";
              if (needsDestructorStack) {
                  invokerFnBody += "var destructors = [];\n"
              }
              var dtorStack = needsDestructorStack ? "destructors" : "null";
              var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
              var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
              if (isClassMethodFunc) {
                  invokerFnBody += "var thisWired = classParam.toWireType(" + dtorStack + ", this);\n"
              }
              for (var i = 0; i < argCount - 2; ++i) {
                  invokerFnBody += "var arg" + i + "Wired = argType" + i + ".toWireType(" + dtorStack + ", arg" + i + "); // " + argTypes[i + 2].name + "\n";
                  args1.push("argType" + i);
                  args2.push(argTypes[i + 2])
              }
              if (isClassMethodFunc) {
                  argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired
              }
              invokerFnBody += (returns ? "var rv = " : "") + "invoker(fn" + (argsListWired.length > 0 ? ", " : "") + argsListWired + ");\n";
              if (needsDestructorStack) {
                  invokerFnBody += "runDestructors(destructors);\n"
              } else {
                  for (var i = isClassMethodFunc ? 1 : 2; i < argTypes.length; ++i) {
                      var paramName = i === 1 ? "thisWired" : "arg" + (i - 2) + "Wired";
                      if (argTypes[i].destructorFunction !== null) {
                          invokerFnBody += paramName + "_dtor(" + paramName + "); // " + argTypes[i].name + "\n";
                          args1.push(paramName + "_dtor");
                          args2.push(argTypes[i].destructorFunction)
                      }
                  }
              }
              if (returns) {
                  invokerFnBody += "var ret = retType.fromWireType(rv);\n" + "return ret;\n"
              } else {}
              invokerFnBody += "}\n";
              args1.push(invokerFnBody);
              var invokerFunction = new_(Function, args1).apply(null, args2);
              return invokerFunction
          }

          function __embind_register_class_function(rawClassType, methodName, argCount, rawArgTypesAddr, invokerSignature, rawInvoker, context, isPureVirtual) {
              var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
              methodName = readLatin1String(methodName);
              rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
              whenDependentTypesAreResolved([], [rawClassType], (function(classType) {
                  classType = classType[0];
                  var humanName = classType.name + "." + methodName;
                  if (isPureVirtual) {
                      classType.registeredClass.pureVirtualFunctions.push(methodName)
                  }

                  function unboundTypesHandler() {
                      throwUnboundTypeError("Cannot call " + humanName + " due to unbound types", rawArgTypes)
                  }
                  var proto = classType.registeredClass.instancePrototype;
                  var method = proto[methodName];
                  if (undefined === method || undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2) {
                      unboundTypesHandler.argCount = argCount - 2;
                      unboundTypesHandler.className = classType.name;
                      proto[methodName] = unboundTypesHandler
                  } else {
                      ensureOverloadTable(proto, methodName, humanName);
                      proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler
                  }
                  whenDependentTypesAreResolved([], rawArgTypes, (function(argTypes) {
                      var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
                      if (undefined === proto[methodName].overloadTable) {
                          memberFunction.argCount = argCount - 2;
                          proto[methodName] = memberFunction
                      } else {
                          proto[methodName].overloadTable[argCount - 2] = memberFunction
                      }
                      return []
                  }));
                  return []
              }))
          }

          function validateThis(this_, classType, humanName) {
              if (!(this_ instanceof Object)) {
                  throwBindingError(humanName + ' with invalid "this": ' + this_)
              }
              if (!(this_ instanceof classType.registeredClass.constructor)) {
                  throwBindingError(humanName + ' incompatible with "this" of type ' + this_.constructor.name)
              }
              if (!this_.$$.ptr) {
                  throwBindingError("cannot call emscripten binding method " + humanName + " on deleted object")
              }
              return upcastPointer(this_.$$.ptr, this_.$$.ptrType.registeredClass, classType.registeredClass)
          }

          function __embind_register_class_property(classType, fieldName, getterReturnType, getterSignature, getter, getterContext, setterArgumentType, setterSignature, setter, setterContext) {
              fieldName = readLatin1String(fieldName);
              getter = embind__requireFunction(getterSignature, getter);
              whenDependentTypesAreResolved([], [classType], (function(classType) {
                  classType = classType[0];
                  var humanName = classType.name + "." + fieldName;
                  var desc = {
                      get: (function() {
                          throwUnboundTypeError("Cannot access " + humanName + " due to unbound types", [getterReturnType, setterArgumentType])
                      }),
                      enumerable: true,
                      configurable: true
                  };
                  if (setter) {
                      desc.set = (function() {
                          throwUnboundTypeError("Cannot access " + humanName + " due to unbound types", [getterReturnType, setterArgumentType])
                      })
                  } else {
                      desc.set = (function(v) {
                          throwBindingError(humanName + " is a read-only property")
                      })
                  }
                  Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
                  whenDependentTypesAreResolved([], setter ? [getterReturnType, setterArgumentType] : [getterReturnType], (function(types) {
                      var getterReturnType = types[0];
                      var desc = {
                          get: (function() {
                              var ptr = validateThis(this, classType, humanName + " getter");
                              return getterReturnType["fromWireType"](getter(getterContext, ptr))
                          }),
                          enumerable: true
                      };
                      if (setter) {
                          setter = embind__requireFunction(setterSignature, setter);
                          var setterArgumentType = types[1];
                          desc.set = (function(v) {
                              var ptr = validateThis(this, classType, humanName + " setter");
                              var destructors = [];
                              setter(setterContext, ptr, setterArgumentType["toWireType"](destructors, v));
                              runDestructors(destructors)
                          })
                      }
                      Object.defineProperty(classType.registeredClass.instancePrototype, fieldName, desc);
                      return []
                  }));
                  return []
              }))
          }
          var emval_free_list = [];
          var emval_handle_array = [{}, {
              value: undefined
          }, {
              value: null
          }, {
              value: true
          }, {
              value: false
          }];

          function __emval_decref(handle) {
              if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
                  emval_handle_array[handle] = undefined;
                  emval_free_list.push(handle)
              }
          }

          function count_emval_handles() {
              var count = 0;
              for (var i = 5; i < emval_handle_array.length; ++i) {
                  if (emval_handle_array[i] !== undefined) {
                      ++count
                  }
              }
              return count
          }

          function get_first_emval() {
              for (var i = 5; i < emval_handle_array.length; ++i) {
                  if (emval_handle_array[i] !== undefined) {
                      return emval_handle_array[i]
                  }
              }
              return null
          }

          function init_emval() {
              Module["count_emval_handles"] = count_emval_handles;
              Module["get_first_emval"] = get_first_emval
          }

          function __emval_register(value) {
              switch (value) {
                  case undefined: {
                      return 1
                  };
              case null: {
                  return 2
              };
              case true: {
                  return 3
              };
              case false: {
                  return 4
              };
              default: {
                  var handle = emval_free_list.length ? emval_free_list.pop() : emval_handle_array.length;
                  emval_handle_array[handle] = {
                      refcount: 1,
                      value: value
                  };
                  return handle
              }
              }
          }

          function __embind_register_emval(rawType, name) {
              name = readLatin1String(name);
              registerType(rawType, {
                  name: name,
                  "fromWireType": (function(handle) {
                      var rv = emval_handle_array[handle].value;
                      __emval_decref(handle);
                      return rv
                  }),
                  "toWireType": (function(destructors, value) {
                      return __emval_register(value)
                  }),
                  "argPackAdvance": 8,
                  "readValueFromPointer": simpleReadValueFromPointer,
                  destructorFunction: null
              })
          }

          function _embind_repr(v) {
              if (v === null) {
                  return "null"
              }
              var t = typeof v;
              if (t === "object" || t === "array" || t === "function") {
                  return v.toString()
              } else {
                  return "" + v
              }
          }

          function floatReadValueFromPointer(name, shift) {
              switch (shift) {
                  case 2:
                      return (function(pointer) {
                          return this["fromWireType"](HEAPF32[pointer >> 2])
                      });
                  case 3:
                      return (function(pointer) {
                          return this["fromWireType"](HEAPF64[pointer >> 3])
                      });
                  default:
                      throw new TypeError("Unknown float type: " + name)
              }
          }

          function __embind_register_float(rawType, name, size) {
              var shift = getShiftFromSize(size);
              name = readLatin1String(name);
              registerType(rawType, {
                  name: name,
                  "fromWireType": (function(value) {
                      return value
                  }),
                  "toWireType": (function(destructors, value) {
                      if (typeof value !== "number" && typeof value !== "boolean") {
                          throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
                      }
                      return value
                  }),
                  "argPackAdvance": 8,
                  "readValueFromPointer": floatReadValueFromPointer(name, shift),
                  destructorFunction: null
              })
          }

          function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
              var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
              name = readLatin1String(name);
              rawInvoker = embind__requireFunction(signature, rawInvoker);
              exposePublicSymbol(name, (function() {
                  throwUnboundTypeError("Cannot call " + name + " due to unbound types", argTypes)
              }), argCount - 1);
              whenDependentTypesAreResolved([], argTypes, (function(argTypes) {
                  var invokerArgsArray = [argTypes[0], null].concat(argTypes.slice(1));
                  replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
                  return []
              }))
          }

          function integerReadValueFromPointer(name, shift, signed) {
              switch (shift) {
                  case 0:
                      return signed ? function readS8FromPointer(pointer) {
                          return HEAP8[pointer]
                      } : function readU8FromPointer(pointer) {
                          return HEAPU8[pointer]
                      };
                  case 1:
                      return signed ? function readS16FromPointer(pointer) {
                          return HEAP16[pointer >> 1]
                      } : function readU16FromPointer(pointer) {
                          return HEAPU16[pointer >> 1]
                      };
                  case 2:
                      return signed ? function readS32FromPointer(pointer) {
                          return HEAP32[pointer >> 2]
                      } : function readU32FromPointer(pointer) {
                          return HEAPU32[pointer >> 2]
                      };
                  default:
                      throw new TypeError("Unknown integer type: " + name)
              }
          }

          function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
              name = readLatin1String(name);
              if (maxRange === -1) {
                  maxRange = 4294967295
              }
              var shift = getShiftFromSize(size);
              var fromWireType = (function(value) {
                  return value
              });
              if (minRange === 0) {
                  var bitshift = 32 - 8 * size;
                  fromWireType = (function(value) {
                      return value << bitshift >>> bitshift
                  })
              }
              var isUnsignedType = name.indexOf("unsigned") != -1;
              registerType(primitiveType, {
                  name: name,
                  "fromWireType": fromWireType,
                  "toWireType": (function(destructors, value) {
                      if (typeof value !== "number" && typeof value !== "boolean") {
                          throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name)
                      }
                      if (value < minRange || value > maxRange) {
                          throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ", " + maxRange + "]!")
                      }
                      return isUnsignedType ? value >>> 0 : value | 0
                  }),
                  "argPackAdvance": 8,
                  "readValueFromPointer": integerReadValueFromPointer(name, shift, minRange !== 0),
                  destructorFunction: null
              })
          }

          function __embind_register_memory_view(rawType, dataTypeIndex, name) {
              var typeMapping = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
              var TA = typeMapping[dataTypeIndex];

              function decodeMemoryView(handle) {
                  handle = handle >> 2;
                  var heap = HEAPU32;
                  var size = heap[handle];
                  var data = heap[handle + 1];
                  return new TA(heap["buffer"], data, size)
              }
              name = readLatin1String(name);
              registerType(rawType, {
                  name: name,
                  "fromWireType": decodeMemoryView,
                  "argPackAdvance": 8,
                  "readValueFromPointer": decodeMemoryView
              }, {
                  ignoreDuplicateRegistrations: true
              })
          }

          function __embind_register_std_string(rawType, name) {
              name = readLatin1String(name);
              var stdStringIsUTF8 = name === "std::string";
              registerType(rawType, {
                  name: name,
                  "fromWireType": (function(value) {
                      var length = HEAPU32[value >> 2];
                      var str;
                      if (stdStringIsUTF8) {
                          var endChar = HEAPU8[value + 4 + length];
                          var endCharSwap = 0;
                          if (endChar != 0) {
                              endCharSwap = endChar;
                              HEAPU8[value + 4 + length] = 0
                          }
                          var decodeStartPtr = value + 4;
                          for (var i = 0; i <= length; ++i) {
                              var currentBytePtr = value + 4 + i;
                              if (HEAPU8[currentBytePtr] == 0) {
                                  var stringSegment = UTF8ToString(decodeStartPtr);
                                  if (str === undefined) str = stringSegment;
                                  else {
                                      str += String.fromCharCode(0);
                                      str += stringSegment
                                  }
                                  decodeStartPtr = currentBytePtr + 1
                              }
                          }
                          if (endCharSwap != 0) HEAPU8[value + 4 + length] = endCharSwap
                      } else {
                          var a = new Array(length);
                          for (var i = 0; i < length; ++i) {
                              a[i] = String.fromCharCode(HEAPU8[value + 4 + i])
                          }
                          str = a.join("")
                      }
                      _free(value);
                      return str
                  }),
                  "toWireType": (function(destructors, value) {
                      if (value instanceof ArrayBuffer) {
                          value = new Uint8Array(value)
                      }
                      var getLength;
                      var valueIsOfTypeString = typeof value === "string";
                      if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                          throwBindingError("Cannot pass non-string to std::string")
                      }
                      if (stdStringIsUTF8 && valueIsOfTypeString) {
                          getLength = (function() {
                              return lengthBytesUTF8(value)
                          })
                      } else {
                          getLength = (function() {
                              return value.length
                          })
                      }
                      var length = getLength();
                      var ptr = _malloc(4 + length + 1);
                      HEAPU32[ptr >> 2] = length;
                      if (stdStringIsUTF8 && valueIsOfTypeString) {
                          stringToUTF8(value, ptr + 4, length + 1)
                      } else {
                          if (valueIsOfTypeString) {
                              for (var i = 0; i < length; ++i) {
                                  var charCode = value.charCodeAt(i);
                                  if (charCode > 255) {
                                      _free(ptr);
                                      throwBindingError("String has UTF-16 code units that do not fit in 8 bits")
                                  }
                                  HEAPU8[ptr + 4 + i] = charCode
                              }
                          } else {
                              for (var i = 0; i < length; ++i) {
                                  HEAPU8[ptr + 4 + i] = value[i]
                              }
                          }
                      }
                      if (destructors !== null) {
                          destructors.push(_free, ptr)
                      }
                      return ptr
                  }),
                  "argPackAdvance": 8,
                  "readValueFromPointer": simpleReadValueFromPointer,
                  destructorFunction: (function(ptr) {
                      _free(ptr)
                  })
              })
          }

          function __embind_register_std_wstring(rawType, charSize, name) {
              name = readLatin1String(name);
              var getHeap, shift;
              if (charSize === 2) {
                  getHeap = (function() {
                      return HEAPU16
                  });
                  shift = 1
              } else if (charSize === 4) {
                  getHeap = (function() {
                      return HEAPU32
                  });
                  shift = 2
              }
              registerType(rawType, {
                  name: name,
                  "fromWireType": (function(value) {
                      var HEAP = getHeap();
                      var length = HEAPU32[value >> 2];
                      var a = new Array(length);
                      var start = value + 4 >> shift;
                      for (var i = 0; i < length; ++i) {
                          a[i] = String.fromCharCode(HEAP[start + i])
                      }
                      _free(value);
                      return a.join("")
                  }),
                  "toWireType": (function(destructors, value) {
                      var HEAP = getHeap();
                      var length = value.length;
                      var ptr = _malloc(4 + length * charSize);
                      HEAPU32[ptr >> 2] = length;
                      var start = ptr + 4 >> shift;
                      for (var i = 0; i < length; ++i) {
                          HEAP[start + i] = value.charCodeAt(i)
                      }
                      if (destructors !== null) {
                          destructors.push(_free, ptr)
                      }
                      return ptr
                  }),
                  "argPackAdvance": 8,
                  "readValueFromPointer": simpleReadValueFromPointer,
                  destructorFunction: (function(ptr) {
                      _free(ptr)
                  })
              })
          }

          function __embind_register_void(rawType, name) {
              name = readLatin1String(name);
              registerType(rawType, {
                  isVoid: true,
                  name: name,
                  "argPackAdvance": 0,
                  "fromWireType": (function() {
                      return undefined
                  }),
                  "toWireType": (function(destructors, o) {
                      return undefined
                  })
              })
          }

          function __emval_incref(handle) {
              if (handle > 4) {
                  emval_handle_array[handle].refcount += 1
              }
          }

          function __emval_new_array() {
              return __emval_register([])
          }

          function requireHandle(handle) {
              if (!handle) {
                  throwBindingError("Cannot use deleted val. handle = " + handle)
              }
              return emval_handle_array[handle].value
          }

          function __emval_set_property(handle, key, value) {
              handle = requireHandle(handle);
              key = requireHandle(key);
              value = requireHandle(value);
              handle[key] = value
          }

          function requireRegisteredType(rawType, humanName) {
              var impl = registeredTypes[rawType];
              if (undefined === impl) {
                  throwBindingError(humanName + " has unknown type " + getTypeName(rawType))
              }
              return impl
          }

          function __emval_take_value(type, argv) {
              type = requireRegisteredType(type, "_emval_take_value");
              var v = type["readValueFromPointer"](argv);
              return __emval_register(v)
          }

          function _abort() {
              Module["abort"]()
          }

          function _getenv(name) {
              if (name === 0) return 0;
              name = Pointer_stringify(name);
              if (!ENV.hasOwnProperty(name)) return 0;
              if (_getenv.ret) _free(_getenv.ret);
              _getenv.ret = allocateUTF8(ENV[name]);
              return _getenv.ret
          }

          function _llvm_stackrestore(p) {
              var self = _llvm_stacksave;
              var ret = self.LLVM_SAVEDSTACKS[p];
              self.LLVM_SAVEDSTACKS.splice(p, 1);
              stackRestore(ret)
          }

          function _llvm_stacksave() {
              var self = _llvm_stacksave;
              if (!self.LLVM_SAVEDSTACKS) {
                  self.LLVM_SAVEDSTACKS = []
              }
              self.LLVM_SAVEDSTACKS.push(stackSave());
              return self.LLVM_SAVEDSTACKS.length - 1
          }

          function _llvm_trap() {
              abort("trap!")
          }

          function _emscripten_memcpy_big(dest, src, num) {
              HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
              return dest
          }

          function _pthread_cond_wait() {
              return 0
          }
          var PTHREAD_SPECIFIC = {};

          function _pthread_getspecific(key) {
              return PTHREAD_SPECIFIC[key] || 0
          }
          var PTHREAD_SPECIFIC_NEXT_KEY = 1;

          function _pthread_key_create(key, destructor) {
              if (key == 0) {
                  return ERRNO_CODES.EINVAL
              }
              HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
              PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
              PTHREAD_SPECIFIC_NEXT_KEY++;
              return 0
          }

          function _pthread_once(ptr, func) {
              if (!_pthread_once.seen) _pthread_once.seen = {};
              if (ptr in _pthread_once.seen) return;
              Module["dynCall_v"](func);
              _pthread_once.seen[ptr] = 1
          }

          function _pthread_setspecific(key, value) {
              if (!(key in PTHREAD_SPECIFIC)) {
                  return ERRNO_CODES.EINVAL
              }
              PTHREAD_SPECIFIC[key] = value;
              return 0
          }

          function __isLeapYear(year) {
              return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
          }

          function __arraySum(array, index) {
              var sum = 0;
              for (var i = 0; i <= index; sum += array[i++]);
              return sum
          }
          var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
          var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

          function __addDays(date, days) {
              var newDate = new Date(date.getTime());
              while (days > 0) {
                  var leap = __isLeapYear(newDate.getFullYear());
                  var currentMonth = newDate.getMonth();
                  var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
                  if (days > daysInCurrentMonth - newDate.getDate()) {
                      days -= daysInCurrentMonth - newDate.getDate() + 1;
                      newDate.setDate(1);
                      if (currentMonth < 11) {
                          newDate.setMonth(currentMonth + 1)
                      } else {
                          newDate.setMonth(0);
                          newDate.setFullYear(newDate.getFullYear() + 1)
                      }
                  } else {
                      newDate.setDate(newDate.getDate() + days);
                      return newDate
                  }
              }
              return newDate
          }

          function _strftime(s, maxsize, format, tm) {
              var tm_zone = HEAP32[tm + 40 >> 2];
              var date = {
                  tm_sec: HEAP32[tm >> 2],
                  tm_min: HEAP32[tm + 4 >> 2],
                  tm_hour: HEAP32[tm + 8 >> 2],
                  tm_mday: HEAP32[tm + 12 >> 2],
                  tm_mon: HEAP32[tm + 16 >> 2],
                  tm_year: HEAP32[tm + 20 >> 2],
                  tm_wday: HEAP32[tm + 24 >> 2],
                  tm_yday: HEAP32[tm + 28 >> 2],
                  tm_isdst: HEAP32[tm + 32 >> 2],
                  tm_gmtoff: HEAP32[tm + 36 >> 2],
                  tm_zone: tm_zone ? Pointer_stringify(tm_zone) : ""
              };
              var pattern = Pointer_stringify(format);
              var EXPANSION_RULES_1 = {
                  "%c": "%a %b %d %H:%M:%S %Y",
                  "%D": "%m/%d/%y",
                  "%F": "%Y-%m-%d",
                  "%h": "%b",
                  "%r": "%I:%M:%S %p",
                  "%R": "%H:%M",
                  "%T": "%H:%M:%S",
                  "%x": "%m/%d/%y",
                  "%X": "%H:%M:%S"
              };
              for (var rule in EXPANSION_RULES_1) {
                  pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
              }
              var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

              function leadingSomething(value, digits, character) {
                  var str = typeof value === "number" ? value.toString() : value || "";
                  while (str.length < digits) {
                      str = character[0] + str
                  }
                  return str
              }

              function leadingNulls(value, digits) {
                  return leadingSomething(value, digits, "0")
              }

              function compareByDay(date1, date2) {
                  function sgn(value) {
                      return value < 0 ? -1 : value > 0 ? 1 : 0
                  }
                  var compare;
                  if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
                      if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                          compare = sgn(date1.getDate() - date2.getDate())
                      }
                  }
                  return compare
              }

              function getFirstWeekStartDate(janFourth) {
                  switch (janFourth.getDay()) {
                      case 0:
                          return new Date(janFourth.getFullYear() - 1, 11, 29);
                      case 1:
                          return janFourth;
                      case 2:
                          return new Date(janFourth.getFullYear(), 0, 3);
                      case 3:
                          return new Date(janFourth.getFullYear(), 0, 2);
                      case 4:
                          return new Date(janFourth.getFullYear(), 0, 1);
                      case 5:
                          return new Date(janFourth.getFullYear() - 1, 11, 31);
                      case 6:
                          return new Date(janFourth.getFullYear() - 1, 11, 30)
                  }
              }

              function getWeekBasedYear(date) {
                  var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
                  var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
                  var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
                  var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                  var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                  if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
                      if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                          return thisDate.getFullYear() + 1
                      } else {
                          return thisDate.getFullYear()
                      }
                  } else {
                      return thisDate.getFullYear() - 1
                  }
              }
              var EXPANSION_RULES_2 = {
                  "%a": (function(date) {
                      return WEEKDAYS[date.tm_wday].substring(0, 3)
                  }),
                  "%A": (function(date) {
                      return WEEKDAYS[date.tm_wday]
                  }),
                  "%b": (function(date) {
                      return MONTHS[date.tm_mon].substring(0, 3)
                  }),
                  "%B": (function(date) {
                      return MONTHS[date.tm_mon]
                  }),
                  "%C": (function(date) {
                      var year = date.tm_year + 1900;
                      return leadingNulls(year / 100 | 0, 2)
                  }),
                  "%d": (function(date) {
                      return leadingNulls(date.tm_mday, 2)
                  }),
                  "%e": (function(date) {
                      return leadingSomething(date.tm_mday, 2, " ")
                  }),
                  "%g": (function(date) {
                      return getWeekBasedYear(date).toString().substring(2)
                  }),
                  "%G": (function(date) {
                      return getWeekBasedYear(date)
                  }),
                  "%H": (function(date) {
                      return leadingNulls(date.tm_hour, 2)
                  }),
                  "%I": (function(date) {
                      var twelveHour = date.tm_hour;
                      if (twelveHour == 0) twelveHour = 12;
                      else if (twelveHour > 12) twelveHour -= 12;
                      return leadingNulls(twelveHour, 2)
                  }),
                  "%j": (function(date) {
                      return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
                  }),
                  "%m": (function(date) {
                      return leadingNulls(date.tm_mon + 1, 2)
                  }),
                  "%M": (function(date) {
                      return leadingNulls(date.tm_min, 2)
                  }),
                  "%n": (function() {
                      return "\n"
                  }),
                  "%p": (function(date) {
                      if (date.tm_hour >= 0 && date.tm_hour < 12) {
                          return "AM"
                      } else {
                          return "PM"
                      }
                  }),
                  "%S": (function(date) {
                      return leadingNulls(date.tm_sec, 2)
                  }),
                  "%t": (function() {
                      return "\t"
                  }),
                  "%u": (function(date) {
                      var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                      return day.getDay() || 7
                  }),
                  "%U": (function(date) {
                      var janFirst = new Date(date.tm_year + 1900, 0, 1);
                      var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
                      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                      if (compareByDay(firstSunday, endDate) < 0) {
                          var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
                          var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
                          var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                          return leadingNulls(Math.ceil(days / 7), 2)
                      }
                      return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
                  }),
                  "%V": (function(date) {
                      var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
                      var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
                      var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                      var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                      var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
                      if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
                          return "53"
                      }
                      if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
                          return "01"
                      }
                      var daysDifference;
                      if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
                          daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
                      } else {
                          daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
                      }
                      return leadingNulls(Math.ceil(daysDifference / 7), 2)
                  }),
                  "%w": (function(date) {
                      var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                      return day.getDay()
                  }),
                  "%W": (function(date) {
                      var janFirst = new Date(date.tm_year, 0, 1);
                      var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
                      var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                      if (compareByDay(firstMonday, endDate) < 0) {
                          var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
                          var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
                          var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                          return leadingNulls(Math.ceil(days / 7), 2)
                      }
                      return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
                  }),
                  "%y": (function(date) {
                      return (date.tm_year + 1900).toString().substring(2)
                  }),
                  "%Y": (function(date) {
                      return date.tm_year + 1900
                  }),
                  "%z": (function(date) {
                      var off = date.tm_gmtoff;
                      var ahead = off >= 0;
                      off = Math.abs(off) / 60;
                      off = off / 60 * 100 + off % 60;
                      return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
                  }),
                  "%Z": (function(date) {
                      return date.tm_zone
                  }),
                  "%%": (function() {
                      return "%"
                  })
              };
              for (var rule in EXPANSION_RULES_2) {
                  if (pattern.indexOf(rule) >= 0) {
                      pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
                  }
              }
              var bytes = intArrayFromString(pattern, false);
              if (bytes.length > maxsize) {
                  return 0
              }
              writeArrayToMemory(bytes, s);
              return bytes.length - 1
          }

          function _strftime_l(s, maxsize, format, tm) {
              return _strftime(s, maxsize, format, tm)
          }
          embind_init_charCodes();
          BindingError = Module["BindingError"] = extendError(Error, "BindingError");
          InternalError = Module["InternalError"] = extendError(Error, "InternalError");
          init_ClassHandle();
          init_RegisteredPointer();
          init_embind();
          UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
          init_emval();
          DYNAMICTOP_PTR = staticAlloc(4);
          STACK_BASE = STACKTOP = alignMemory(STATICTOP);
          STACK_MAX = STACK_BASE + TOTAL_STACK;
          DYNAMIC_BASE = alignMemory(STACK_MAX);
          HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
          staticSealed = true;

          function intArrayFromString(stringy, dontAddNull, length) {
              var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
              var u8array = new Array(len);
              var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
              if (dontAddNull) u8array.length = numBytesWritten;
              return u8array
          }
          Module["wasmTableSize"] = 1110;
          Module["wasmMaxTableSize"] = 1110;
          Module.asmGlobalArg = {};
          Module.asmLibraryArg = {
              "abort": abort,
              "enlargeMemory": enlargeMemory,
              "getTotalMemory": getTotalMemory,
              "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
              "___buildEnvironment": ___buildEnvironment,
              "___cxa_allocate_exception": ___cxa_allocate_exception,
              "___cxa_pure_virtual": ___cxa_pure_virtual,
              "___cxa_throw": ___cxa_throw,
              "___cxa_uncaught_exception": ___cxa_uncaught_exception,
              "___lock": ___lock,
              "___map_file": ___map_file,
              "___setErrNo": ___setErrNo,
              "___syscall140": ___syscall140,
              "___syscall146": ___syscall146,
              "___syscall6": ___syscall6,
              "___syscall91": ___syscall91,
              "___unlock": ___unlock,
              "__embind_register_bool": __embind_register_bool,
              "__embind_register_class": __embind_register_class,
              "__embind_register_class_constructor": __embind_register_class_constructor,
              "__embind_register_class_function": __embind_register_class_function,
              "__embind_register_class_property": __embind_register_class_property,
              "__embind_register_emval": __embind_register_emval,
              "__embind_register_float": __embind_register_float,
              "__embind_register_function": __embind_register_function,
              "__embind_register_integer": __embind_register_integer,
              "__embind_register_memory_view": __embind_register_memory_view,
              "__embind_register_std_string": __embind_register_std_string,
              "__embind_register_std_wstring": __embind_register_std_wstring,
              "__embind_register_void": __embind_register_void,
              "__emval_decref": __emval_decref,
              "__emval_incref": __emval_incref,
              "__emval_new_array": __emval_new_array,
              "__emval_set_property": __emval_set_property,
              "__emval_take_value": __emval_take_value,
              "_abort": _abort,
              "_emscripten_memcpy_big": _emscripten_memcpy_big,
              "_getenv": _getenv,
              "_llvm_stackrestore": _llvm_stackrestore,
              "_llvm_stacksave": _llvm_stacksave,
              "_llvm_trap": _llvm_trap,
              "_pthread_cond_wait": _pthread_cond_wait,
              "_pthread_getspecific": _pthread_getspecific,
              "_pthread_key_create": _pthread_key_create,
              "_pthread_once": _pthread_once,
              "_pthread_setspecific": _pthread_setspecific,
              "_strftime_l": _strftime_l,
              "DYNAMICTOP_PTR": DYNAMICTOP_PTR,
              "STACKTOP": STACKTOP
          };
          var asm = Module["asm"](Module.asmGlobalArg, Module.asmLibraryArg, buffer);
          Module["asm"] = asm;
          var __GLOBAL__sub_I_ImfDeepScanLineInputFile_cpp = Module["__GLOBAL__sub_I_ImfDeepScanLineInputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfDeepScanLineInputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfDeepScanLineOutputFile_cpp = Module["__GLOBAL__sub_I_ImfDeepScanLineOutputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfDeepScanLineOutputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfDeepTiledInputFile_cpp = Module["__GLOBAL__sub_I_ImfDeepTiledInputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfDeepTiledInputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfDeepTiledOutputFile_cpp = Module["__GLOBAL__sub_I_ImfDeepTiledOutputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfDeepTiledOutputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfGenericOutputFile_cpp = Module["__GLOBAL__sub_I_ImfGenericOutputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfGenericOutputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfHeader_cpp = Module["__GLOBAL__sub_I_ImfHeader_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfHeader_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfInputFile_cpp = Module["__GLOBAL__sub_I_ImfInputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfInputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfMisc_cpp = Module["__GLOBAL__sub_I_ImfMisc_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfMisc_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfMultiPartInputFile_cpp = Module["__GLOBAL__sub_I_ImfMultiPartInputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfMultiPartInputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfMultiPartOutputFile_cpp = Module["__GLOBAL__sub_I_ImfMultiPartOutputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfMultiPartOutputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfOutputFile_cpp = Module["__GLOBAL__sub_I_ImfOutputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfOutputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfPartType_cpp = Module["__GLOBAL__sub_I_ImfPartType_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfPartType_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfScanLineInputFile_cpp = Module["__GLOBAL__sub_I_ImfScanLineInputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfScanLineInputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfTiledInputFile_cpp = Module["__GLOBAL__sub_I_ImfTiledInputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfTiledInputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_ImfTiledOutputFile_cpp = Module["__GLOBAL__sub_I_ImfTiledOutputFile_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_ImfTiledOutputFile_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_bind_cpp"].apply(null, arguments)
          });
          var __GLOBAL__sub_I_exr_wrap_cpp = Module["__GLOBAL__sub_I_exr_wrap_cpp"] = (function() {
              return Module["asm"]["__GLOBAL__sub_I_exr_wrap_cpp"].apply(null, arguments)
          });
          var __ZSt18uncaught_exceptionv = Module["__ZSt18uncaught_exceptionv"] = (function() {
              return Module["asm"]["__ZSt18uncaught_exceptionv"].apply(null, arguments)
          });
          var ___emscripten_environ_constructor = Module["___emscripten_environ_constructor"] = (function() {
              return Module["asm"]["___emscripten_environ_constructor"].apply(null, arguments)
          });
          var ___getTypeName = Module["___getTypeName"] = (function() {
              return Module["asm"]["___getTypeName"].apply(null, arguments)
          });
          var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = (function() {
              return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments)
          });
          var _free = Module["_free"] = (function() {
              return Module["asm"]["_free"].apply(null, arguments)
          });
          var _malloc = Module["_malloc"] = (function() {
              return Module["asm"]["_malloc"].apply(null, arguments)
          });
          var stackRestore = Module["stackRestore"] = (function() {
              return Module["asm"]["stackRestore"].apply(null, arguments)
          });
          var stackSave = Module["stackSave"] = (function() {
              return Module["asm"]["stackSave"].apply(null, arguments)
          });
          var dynCall_i = Module["dynCall_i"] = (function() {
              return Module["asm"]["dynCall_i"].apply(null, arguments)
          });
          var dynCall_ii = Module["dynCall_ii"] = (function() {
              return Module["asm"]["dynCall_ii"].apply(null, arguments)
          });
          var dynCall_iii = Module["dynCall_iii"] = (function() {
              return Module["asm"]["dynCall_iii"].apply(null, arguments)
          });
          var dynCall_iiii = Module["dynCall_iiii"] = (function() {
              return Module["asm"]["dynCall_iiii"].apply(null, arguments)
          });
          var dynCall_iiiif = Module["dynCall_iiiif"] = (function() {
              return Module["asm"]["dynCall_iiiif"].apply(null, arguments)
          });
          var dynCall_iiiii = Module["dynCall_iiiii"] = (function() {
              return Module["asm"]["dynCall_iiiii"].apply(null, arguments)
          });
          var dynCall_iiiiid = Module["dynCall_iiiiid"] = (function() {
              return Module["asm"]["dynCall_iiiiid"].apply(null, arguments)
          });
          var dynCall_iiiiii = Module["dynCall_iiiiii"] = (function() {
              return Module["asm"]["dynCall_iiiiii"].apply(null, arguments)
          });
          var dynCall_iiiiiid = Module["dynCall_iiiiiid"] = (function() {
              return Module["asm"]["dynCall_iiiiiid"].apply(null, arguments)
          });
          var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = (function() {
              return Module["asm"]["dynCall_iiiiiii"].apply(null, arguments)
          });
          var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = (function() {
              return Module["asm"]["dynCall_iiiiiiii"].apply(null, arguments)
          });
          var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = (function() {
              return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments)
          });
          var dynCall_iiiiij = Module["dynCall_iiiiij"] = (function() {
              return Module["asm"]["dynCall_iiiiij"].apply(null, arguments)
          });
          var dynCall_ji = Module["dynCall_ji"] = (function() {
              return Module["asm"]["dynCall_ji"].apply(null, arguments)
          });
          var dynCall_v = Module["dynCall_v"] = (function() {
              return Module["asm"]["dynCall_v"].apply(null, arguments)
          });
          var dynCall_vi = Module["dynCall_vi"] = (function() {
              return Module["asm"]["dynCall_vi"].apply(null, arguments)
          });
          var dynCall_vii = Module["dynCall_vii"] = (function() {
              return Module["asm"]["dynCall_vii"].apply(null, arguments)
          });
          var dynCall_viif = Module["dynCall_viif"] = (function() {
              return Module["asm"]["dynCall_viif"].apply(null, arguments)
          });
          var dynCall_viii = Module["dynCall_viii"] = (function() {
              return Module["asm"]["dynCall_viii"].apply(null, arguments)
          });
          var dynCall_viiif = Module["dynCall_viiif"] = (function() {
              return Module["asm"]["dynCall_viiif"].apply(null, arguments)
          });
          var dynCall_viiii = Module["dynCall_viiii"] = (function() {
              return Module["asm"]["dynCall_viiii"].apply(null, arguments)
          });
          var dynCall_viiiii = Module["dynCall_viiiii"] = (function() {
              return Module["asm"]["dynCall_viiiii"].apply(null, arguments)
          });
          var dynCall_viiiiii = Module["dynCall_viiiiii"] = (function() {
              return Module["asm"]["dynCall_viiiiii"].apply(null, arguments)
          });
          var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = (function() {
              return Module["asm"]["dynCall_viiiiiii"].apply(null, arguments)
          });
          var dynCall_viijii = Module["dynCall_viijii"] = (function() {
              return Module["asm"]["dynCall_viijii"].apply(null, arguments)
          });
          var dynCall_vij = Module["dynCall_vij"] = (function() {
              return Module["asm"]["dynCall_vij"].apply(null, arguments)
          });
          Module["asm"] = asm;
          Module["then"] = (function(func) {
              if (Module["calledRun"]) {
                  func(Module)
              } else {
                  var old = Module["onRuntimeInitialized"];
                  Module["onRuntimeInitialized"] = (function() {
                      if (old) old();
                      func(Module)
                  })
              }
              return Module
          });

          function ExitStatus(status) {
              this.name = "ExitStatus";
              this.message = "Program terminated with exit(" + status + ")";
              this.status = status
          }
          ExitStatus.prototype = new Error;
          ExitStatus.prototype.constructor = ExitStatus;
          dependenciesFulfilled = function runCaller() {
              if (!Module["calledRun"]) run();
              if (!Module["calledRun"]) dependenciesFulfilled = runCaller
          };

          function run(args) {
              args = args || Module["arguments"];
              if (runDependencies > 0) {
                  return
              }
              preRun();
              if (runDependencies > 0) return;
              if (Module["calledRun"]) return;

              function doRun() {
                  if (Module["calledRun"]) return;
                  Module["calledRun"] = true;
                  if (ABORT) return;
                  ensureInitRuntime();
                  preMain();
                  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
                  postRun()
              }
              if (Module["setStatus"]) {
                  Module["setStatus"]("Running...");
                  setTimeout((function() {
                      setTimeout((function() {
                          Module["setStatus"]("")
                      }), 1);
                      doRun()
                  }), 1)
              } else {
                  doRun()
              }
          }
          Module["run"] = run;

          function abort(what) {
              if (Module["onAbort"]) {
                  Module["onAbort"](what)
              }
              if (what !== undefined) {
                  out(what);
                  err(what);
                  what = JSON.stringify(what)
              } else {
                  what = ""
              }
              ABORT = true;
              EXITSTATUS = 1;
              throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
          }
          Module["abort"] = abort;
          if (Module["preInit"]) {
              if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
              while (Module["preInit"].length > 0) {
                  Module["preInit"].pop()()
              }
          }
          Module["noExitRuntime"] = true;
          run()




          return EXR;
      }
  );
})();
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = EXR;
else if (typeof define === 'function' && define['amd'])
  define([], function() {
      return EXR;
  });
else if (typeof exports === 'object')
  exports["EXR"] = EXR;