/*
**  ComponentJS -- Component System for JavaScript <http://componentjs.com>
**  Copyright (c) 2009-2013 Ralf S. Engelschall <http://engelschall.com>
**
**  This Source Code Form is subject to the terms of the Mozilla Public
**  License, v. 2.0. If a copy of the MPL was not distributed with this
**  file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

/* global param0: false, param1: false, alert: false, console: false */

(function () {

var evaluateExprInternal = function (ctx, expression, binding) {
    var type = expression.type
    binding = binding || {}
    binding.source = ctx.source
    binding.origin = ctx.origin
    binding.sourceType = ctx.sourceType
    binding.originType = ctx.originType
    binding.operation = ctx.operation
    binding.parameters = ctx.parameters

    if (type === 'true')
        return true
    else if (type === 'false')
        return false
    else if (type === 'and')
        return evaluateExprInternal(ctx, expression.left, binding) && evaluateExprInternal(ctx, expression.right, binding)
    else if (type === 'or')
        return evaluateExprInternal(ctx, expression.left, binding) || evaluateExprInternal(ctx, expression.right, binding)
    else if (type === 'not')
        return !evaluateExprInternal(ctx, expression.expression, binding)
    else if (type === 'clasped')
        return evaluateExprInternal(ctx, expression.expression, binding)
    else if (type === 'term') {
        if (expression.function)
            expression.funcRes = evaluateFuncInternal(ctx, expression, binding)
        return evaluateTermInternal(ctx, expression, binding)
    }
    else if (type === 'function')
        return evaluateFuncInternal(ctx, expression, binding)
}

var evaluateFuncInternal = function (ctx, statement, binding) {
    /*  function to register helper functions  */
    var registerHelper = function (name, func, location) {
        location[name] = func
    }

    /*  make the arguments available labeled according to their index i.e. param0, param1, ..., paramN  */
    _.each(statement.params, function (param, idx) {
        eval('this.param' + idx + ' = binding["' + param[0] + '"]' + (param.length > 1 ? '.' + _.tail(param).join('.') : ''))
    }, this)

    registerHelper('isParent', function () {
        return param1.indexOf(param0) !== -1
    }, this)

    registerHelper('contains', function () {
        if (!_.isArray(param0))
            param0 = _.keys(param0)
        return _.contains(param0, param1)
    }, this)

    registerHelper('distance', function () {
        if (param1.indexOf(param0) !== -1)
            return -1 * (param1.replace(param0, '').split('/').length - 1)
        else if (param0.indexOf(param1) !== -1)
            return param0.replace(param1, '').split('/').length - 1
        return -1
    }, this)

    registerHelper('state', function () {
        return '"' + cs('/sv').call('getState', param0) + '"'
    }, this)

    registerHelper('startsWith', function () {
        return param0.indexOf(param1) === 0
    }, this)

    try {
        return eval(statement.name + '()')
    } catch (e) {
        alert('Unknown helper function "' + statement.name + '" (see console for exception)')
        console.log(e)
    }
}

var evaluateTermInternal = function (ctx, term, binding) {
    var expr
    if (term.funcRes)
        expr = term.value + term.op + term.funcRes
    else if (term.field1)
        expr = 'binding["' + term.field1[0] + '"]' + (term.field1.length > 1 ? '.' + _.tail(term.field1).join('.') : '') + ' ' + term.op +
                ' ' + 'binding["' + term.field2[0] + '"]' + (term.field2.length > 1 ? '.' + _.tail(term.field2).join('.') : '')
    else
        expr = 'binding["' + term.field[0] + '"]' + (term.field.length > 1 ? '.' + _.tail(term.field).join('.') : '') + ' ' + term.op + ' ' + term.value
    return eval(expr)
}

var stringifyExprInternal = function (expression) {
    var type = expression.type

    if (type === 'true')
        return ' true '
    else if (type === 'false')
        return ' false '
    else if (type === 'and')
        return stringifyExprInternal(expression.left) + ' && ' + stringifyExprInternal(expression.right)
    else if (type === 'or')
        return stringifyExprInternal(expression.left) + ' || ' + stringifyExprInternal(expression.right)
    else if (type === 'not')
        return '! ' + stringifyExprInternal(expression.expression)
    else if (type === 'clasped')
        return '( ' + stringifyExprInternal(expression.expression) + ' )'
    else if (type === 'term')
        return stringifyTerm(expression)
    else if (type === 'function')
        return stringifyFunc(expression)
}

var stringifyTerm = function (term) {
    return term.field + ' ' + term.op + ' ' + term.value
}

var stringifyFunc = function (statement) {
    if (statement.name === 'isParent' || statement.name === 'contains')
        return statement.name + '(' + statement.params[0].join('.') + ', ' + statement.params[1].join('.') + ')'
    else if (statement === 'state')
        return statement.name + '(' + statement.params[0][0] + ')'
    return 'NaF'
}

var filterInternal = function (trace, filter) {
    for (var key in trace) {
        if (key === 'source' || key === 'sourceType' || key === 'origin' || key === 'originType' || key === 'params' || key === 'operation') {
            var val = trace[key]
            if (key === 'parameters')
                val = JSON.stringify(val)
            if (val.toLowerCase().indexOf(filter.toLowerCase()) !== -1) {
                return true
                break;
            }
        }
        else
            continue;
    }
    return false
}

var compareInternal = function (ctx, other) {
    return ctx.operation === other.operation && ctx.origin === other.origin && JSON.stringify(ctx.parameters) === JSON.stringify(other.parameters)
}

var hash = function (ctx, ignoreParams) {
    return (ctx.operation + '#' + ctx.origin + '#' + ctx.source + '#' + (!ignoreParams ? JSON.stringify(ctx.parameters).replace(' ', '') : ''))
}

var toString = function (ctx) {
    var stringify = function (obj) {
        var seen = []
        return JSON.stringify(obj, function(key, val) {
           if (typeof val === 'object') {
                if (seen.indexOf(val) >= 0)
                    return
                seen.push(val)
            }
            return val
        })
    }

    return '< ' +
        ctx.id + ', ' +
        ctx.time + ', ' +
        ctx.source + ', ' +
        ctx.sourceType + ', ' +
        ctx.origin + ', ' +
        ctx.originType + ', ' +
        ctx.operation + ', ' +
        stringify(ctx.parameters) + ' >'
}

var enrich = function (trace) {
    trace.evaluateExpr = function (expression, binding) { return evaluateExprInternal(trace, expression, binding) }
    trace.evaluateTerm = function (term, binding) { return evaluateTermInternal(trace, term, binding) }
    trace.evaluateFunc = function (statement, binding) { return evaluateFuncInternal(trace, statement, binding) }
    trace.stringifyExpr = stringifyExprInternal
    trace.filter = function (filter) { return filterInternal(trace, filter) }
    trace.compare = function (other) { return compareInternal(trace, other) }
    trace.hash = function (ignoreParams) { return hash(trace, ignoreParams) }
    trace.toString = function () { return toString(trace) }

    return trace
}

app.lib.richTrace = {}
app.lib.richTrace.enrich = enrich

})()