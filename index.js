'use strict'

const fs = require('fs')
const vm = require('vm')
const v8 = require('v8')
const path = require('path')
const Module = require('module')

v8.setFlagsFromString('--no-lazy')

const COMPILED_EXTNAME = '.jsc'

const compileCode = function (javascriptCode) {
  try{
    let script = new vm.Script(javascriptCode, {
      produceCachedData: true
    })

    let bytecodeBuffer = (script.createCachedData && script.createCachedData.call) ?
      script.createCachedData()
      :
      script.cachedData

    return bytecodeBuffer
  }catch(err){
    throw err
  }
}

const runBytecode = function (bytecodeBuffer) {
  try{
    let length = bytecodeBuffer.slice(8, 12).reduce( (sum, number, power) => sum += number * 256**power , 0)

    let dummyCode = ' '.repeat(length)

    let script = new vm.Script(dummyCode, {
      cachedData: bytecodeBuffer
    })

    script.runInThisContext()
  }catch(err){
    throw err
  }

}

const compileFile = function (filename, output) {
  try{
    let javascriptCode = fs.readFileSync(filename, 'utf-8')

    let bytecodeBuffer = compileCode(Module.wrap(javascriptCode.replace(/^#!.*/, '')))

    let compiledFilename = output || filename.slice(0, -3) + COMPILED_EXTNAME

    fs.writeFileSync(compiledFilename, bytecodeBuffer)

    return compiledFilename
  }catch(err){
    throw err
  }

}

const runBytecodeFile = function (filename) {
  try{
    let bytecodeBuffer = fs.readFileSync(filename)

    return runBytecode(bytecodeBuffer)
  }catch(err){
    throw err
  }

}

Module._extensions[COMPILED_EXTNAME] = function (module, filename) {
  try{
    let bytecodeBuffer = fs.readFileSync(filename)

    let length = bytecodeBuffer.slice(8, 12).reduce( (sum, number, power) => sum += number * 256**power , 0)

    let dummyCode = ' '.repeat(length)

    let script = new vm.Script(dummyCode, {
      filename: filename,
      lineOffset: 0,
      displayErrors: true,
      cachedData: bytecodeBuffer,
      produceCachedData: false
    })

    if (script.cachedDataRejected) {
      throw new Error('Invalid or incompatible cached data (cachedDataRejected)')
    }

    /*
    This part is based on:
    https://github.com/zertosh/v8-compile-cache/blob/7182bd0e30ab6f6421365cee0a0c4a8679e9eb7c/v8-compile-cache.js#L158-L178
    */

    function require(id) {
      return module.require(id)
    }
    require.resolve = function (request, options) {
      return Module._resolveFilename(request, module, false, options)
    }
    require.main = process.mainModule

    require.extensions = Module._extensions
    require.cache = Module._cache

    let compiledWrapper = script.runInThisContext({
      filename: filename,
      lineOffset: 0,
      columnOffset: 0,
      displayErrors: true,
    })

    let dirname = path.dirname(filename)

    let args = [module.exports, require, module, filename, dirname, process, global]

    return compiledWrapper.apply(module.exports, args)
  }catch(err){
    throw err
  }
}

exports.compileCode = compileCode
exports.compileFile = compileFile
exports.runBytecode = runBytecode
exports.runBytecodeFile = runBytecodeFile