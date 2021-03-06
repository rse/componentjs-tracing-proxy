/*
**  ComponentJS -- Component System for JavaScript <http://componentjs.com>
**  Copyright (c) 2009-2013 Ralf S. Engelschall <http://engelschall.com>
**
**  This Source Code Form is subject to the terms of the Mozilla Public
**  License, v. 2.0. If a copy of the MPL was not distributed with this
**  file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

app.sv = cs.clazz({
    mixin: [ cs.marker.service ],
    protos: {
        create: function () {
            /*  converts a string containing multiple traces into an array of trace objects  */
            cs(this).register({
                name: 'parseLogfile', spool: 'created',
                func: function (lines) {
                    var pattern = /^[^<]*< ([^,]*), ([^,]*), ([^,]*), ([^,]*), ([^,]*), ([^,]*), ([^,]*), (.*) >/
                    var traces = []
                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i]
                        var matches = line.match(pattern)
                        var param = JSON.parse(matches[8])
                        var newTrace = {
                            id: parseInt(matches[1], 10),
                            time: parseInt(matches[2], 10),
                            source: matches[3],
                            sourceType: matches[4],
                            origin: matches[5],
                            originType: matches[6],
                            operation: matches[7],
                            parameters: param
                        }
                        newTrace = app.lib.richTrace.enrich(newTrace)
                        traces.push(newTrace)
                    }
                    return traces
                }
            })

            cs(this).register({
                name: 'getState', spool: 'created',
                func: function (path) {
                    var cmps = cs('//componentTree').call('getComponent', path)
                    if (cmps.length > 0)
                        return cmps[0].state
                    return
                }
            })

            /*  parses a given string using the PEG parser for the constraint grammar  */
            cs(this).register({
                name: 'parsePeepholeConstraintset', spool: 'created',
                func: function (content) {
                    try {
                        var constraintSet
                        if (content.length === 0)
                            constraintSet = []
                        else
                            constraintSet = app.lib.peephole_constraint_parser.parse(content)
                        return { success: true, constraints: constraintSet }
                    }
                    catch (err) {
                        return { success: false, error: err }
                    }
                }
            })

            /*  parses a given string using the PEG parser for the temporal constraint grammar  */
            cs(this).register({
                name: 'parseTemporalConstraintset', spool: 'created',
                func: function (content) {
                    try {
                        var constraintSet
                        if (content.length === 0)
                            constraintSet = []
                        else
                            constraintSet = app.lib.temporal_constraint_parser.parse(content)
                        return { success: true, constraints: constraintSet }
                    }
                    catch (err) {
                        return { success: false, error: err }
                    }
                }
            })

            /*  validates the given constraints semantically  */
            cs(this).register({
                name: 'validateTemporalConstraints', spool: 'created',
                func: function (constraintSet) {
                    var result = []
                    var noDups = _.uniq(constraintSet, function (constraint) { return constraint.id })
                    if (noDups.length !== constraintSet.length) {
                        var diff = _.difference(constraintSet, noDups)
                        _.each(diff, function (constraint) {
                            result.push({
                                constraint: constraint,
                                column: 0,
                                type: 'error',
                                message: 'Found another constraint with the id "' + constraint.id + '", the id of a constraint has to be unique'
                            })
                        })
                    }
                    _.map(constraintSet, function (constraint) {
                        var participants = constraint.constraintBody.sequence
                        var terminateIdx = _.indexOf(participants, 'terminate')
                        if (terminateIdx !== -1 && terminateIdx !== participants.length - 1)
                            result.push({
                                constraint: constraint,
                                column: 0,
                                type: 'error',
                                message: 'Terminate has to be the last participant in the sequence, if present'
                            })
                        if (participants.length < 2)
                            result.push({
                                constraint: constraint,
                                column: 0,
                                type: 'error',
                                message: 'The number of participating traces of a temporal constraint must be at least two'
                            })
                        var noDups = _.uniq(participants)
                        if (noDups.length !== participants.length)
                            result.push({
                                constraint: constraint,
                                column: 0,
                                type: 'error',
                                message: 'The members in the sequence of a temporal constraint have to be diversely named'
                            })
                        _.map(_.without(participants, 'terminate'), function (participant) {
                            var filterIds = _.map(constraint.constraintBody.filters, function (filter) { return filter.id })
                            if (_.indexOf(filterIds, participant) === -1)
                                result.push({
                                    constraint: constraint,
                                    column: 0,
                                    type: 'warning',
                                    message: 'There is no filter expression specified for ' + participant
                                })
                        })
                        _.map(constraint.constraintBody.filters, function (filter) {
                            if (_.indexOf(participants, filter.id) === -1)
                                result.push({
                                    constraint: constraint,
                                    column: 0,
                                    type: 'error',
                                    message: filter.id + ' is not defined in the sequence section but used in a filter expression'
                                })
                        })
                        _.map(constraint.constraintBody.links, function (link) {
                            if (_.indexOf(participants, link.id) === -1)
                                result.push({
                                    constraint: constraint,
                                    column: 0,
                                    type: 'error',
                                    message: link.id + ' is not defined in the sequence section but used in a link expression'
                                })
                        })
                    })

                    return result
                }
            })

            /*  validates the given constraints semantically  */
            cs(this).register({
                name: 'validatePeepholeConstraints', spool: 'created',
                func: function (constraintSet) {
                    var result = []
                    var containsDup = function (constraint) {
                        if (constraint.constraintBody.constraints) {
                            var dups = {}
                            _.each(constraint.constraintBody.constraints, function (constraint) {
                                if (dups[constraint.id])
                                    dups[constraint.id] = dups[constraint.id] + 1
                                else
                                    dups[constraint.id] = 1
                            })
                            dups = _.omit(dups, function (value) { return value <= 1 })
                            var keys = _.keys(dups)
                            if (keys.length > 0)
                                return keys

                            /*  for loop is necessary here!  */
                            for (var i = 0; i < constraint.constraintBody.constraints.length; i++)
                                return containsDup(constraint.constraintBody.constraints[i])
                        }
                        return false
                    }
                    _.each(constraintSet, function (constraint) {
                        var res = containsDup(constraint)
                        if (res)
                            result.push({
                                constraint: constraint,
                                column: 0,
                                type: 'error',
                                message: 'The name for the nested constraint' + (res.length > 1 ? 's' : '') + ' "' + res.join('", "') + '" is ambiguous'
                            })
                    })
                    var noDups = _.uniq(constraintSet, function (constraint) { return constraint.id })
                    if (noDups.length !== constraintSet.length) {
                        var diff = _.difference(constraintSet, noDups)
                        _.each(diff, function (constraint) {
                            result.push({
                                constraint: constraint,
                                column: 0,
                                type: 'error',
                                message: 'Found another constraint with the id "' + constraint.id + '", the id of a constraint has to be unique'
                            })
                        })
                    }
                    return result
                }
            })

            /*  checks an array of traces against a given set of constraints  */
            cs(this).register({
                name: 'checkTraces', spool: 'created',
                func: function (traces, constraintSet) {
                    var resTraces = []
                    _.map(traces, function (trace) {
                        var mTrace = app.lib.constraintChecker.checkTrace(constraintSet, trace)
                        if (mTrace.result === 'UNCLASSIFIED' || mTrace.result === 'FAIL')
                            resTraces.push(mTrace)
                    })
                    return resTraces
                }
            })
        }
    }
})