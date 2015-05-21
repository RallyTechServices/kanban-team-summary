
Ext.define('Rally.technicalservices.KanbanTeamSummaryCalculator',{

    historicalSnapshots: null,
    currentRecords: null,
    statePrecedence: null,
    completedStateValue: null,
    stateFieldName: null,
    previousValuesStateFieldName: null,
    noOwnerText: 'No Owner',

    constructor: function(config){
        Ext.apply(this,config);
    },
    getChartData: function(snapshots){
        if (snapshots){
            this.historicalSnapshots = snapshots;
        }
        var ownerHash = this.processData(),
            userHash = this.getUserHash(),
            closedSeriesData = [],
            openSeriesData = [],
            noOwnerText = this.noOwnerText,
            categories = [];


            var sortedOwnerObjs = _.sortBy(ownerHash, function(obj){return -obj.closed.length;});

            _.each(sortedOwnerObjs, function(obj){
                var categoryVal = obj.objectID;

                if (categoryVal > 0 && userHash[categoryVal]){
                    categoryVal = userHash[categoryVal].FirstName + ' ' + userHash[categoryVal].LastName || userHash[categoryVal].UserName || categoryVal;
                } else {
                    categoryVal = noOwnerText;
                }

                categories.push(categoryVal);

                closedSeriesData.push(obj.closed.length);
                openSeriesData.push(obj.open.length);
            });
            return {
                categories: categories,
                series: [

                    {name: 'Current Work In Progress', type: 'column', data: openSeriesData, stack: 1},
                    {name: 'Completed Items', type: 'column', data: closedSeriesData, stack: 1}
                ]};
    },
    processData: function(){


        var snaps_by_oid = Rally.technicalservices.Toolbox.aggregateSnapsByOidForModel(this.historicalSnapshots),
            statePrecedences = this.statePrecedence,
            completedStateIndex = _.indexOf(statePrecedences, this.completedStateValue),
            stateFieldName = this.stateFieldName,
            previousValuesStateFieldName = this.previousValuesStateFieldName,
            ownerHash = {};

        _.each(snaps_by_oid, function(snaps, oid){
            var closed = null,
                owner = snaps[0].Owner || -1;

            _.each(snaps, function(snap){
                var stateIndex = _.indexOf(statePrecedences, snap[stateFieldName]),
                    prevStateIndex = _.indexOf(statePrecedences, snap[previousValuesStateFieldName]);

                if (stateIndex >= completedStateIndex && prevStateIndex < completedStateIndex){
                    closed = snap.ObjectID || -1;
                    owner = snap.Owner;
                }
                if (closed && stateIndex < completedStateIndex){
                    closed = null;  //Don't count this...
                }
            });

            if (owner.length == 0){
                owner = -1;
            }
            if (closed){
                if (!ownerHash[owner]){
                    ownerHash[owner] = {closed: [], open: [], objectID: owner};
                }
                ownerHash[owner].closed.push(closed);
            }
        });

        _.each(this.currentRecords, function(r){
            if (r.get('ScheduleState') == 'In-Progress'){
                var ownerKey = r.get('Owner') ? r.get('Owner').ObjectID : -1;

                if (!ownerHash[ownerKey]){
                    ownerHash[ownerKey] = {closed: [], open: [], objectID: ownerKey};
                }
                ownerHash[ownerKey].open.push(r);
            }
        });
        return ownerHash;



    },
    getUserHash: function(){
        var userHash = {};
        _.each(this.currentRecords, function(r){
            var owner = r.get('Owner');
            if (owner){
                userHash[owner.ObjectID] = owner;
            }
        });
        userHash[-1] = this.noOwnerText;
        return userHash;
    }


});