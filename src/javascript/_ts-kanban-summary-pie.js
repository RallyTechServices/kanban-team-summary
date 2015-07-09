
Ext.define('Rally.technicalservices.KanbanTeamSummaryCalculator',{

    historicalSnapshots: null,
    currentRecords: null,
    statePrecedence: null,
    completedStateValue: null,
    stateFieldName: null,
    previousValuesStateFieldName: null,
    teamHash: null,
    noOwnerText: 'No Owner',
    noClassificationText: 'None',
    classificationField: null,

    constructor: function(config){
        Ext.apply(this,config);
    },
    getTeamChartData: function(){

        var allTeamMembers = [];
        _.each(this.teamHash, function(members){
            _.each(members, function(m){
                allTeamMembers.push(m.get('ObjectID'));
            })
        });

        var ownerHash = this.processData(allTeamMembers),
            closedSeriesData = [],
            openSeriesData = [],
            seriesData = [],
            drilldownData = [],
            categories = [];

        _.each(this.teamHash, function(obj, team){

            var closed = 0, open = 0;
            _.each(obj, function(o){
                if (ownerHash[o.get('ObjectID')]){
                    closed += ownerHash[o.get('ObjectID')].closed.length;
                    open += ownerHash[o.get('ObjectID')].open.length;
                }
            });

            if (!Ext.Array.contains(categories, team) && closed + open > 0){
                categories.push(team);
                closedSeriesData.push(closed);
                openSeriesData.push(open);
            }
       }, this);

        return {
            categories: categories,
            series: [
                {name: 'Current Work In Progress', type: 'column', data: openSeriesData, stack: 1},
                {name: 'Completed Items', type: 'column', data: closedSeriesData, stack: 1}
            ]
        };
    },
    getTeamUsersChartData: function(team){

        var thisTeamHash = _.map(this.teamHash[team], function(t){ return t.get('ObjectID')}),
            ownerHash = this.processData(thisTeamHash),
            userHash = this.getUserHash(),
            closedSeriesData = [],
            openSeriesData = [],
            noOwnerText = this.noOwnerText,
            categories = [];

            var team_members = _.sortBy(ownerHash, function(obj){return -obj.closed.length;});

        var user_oids = [];

        _.each(team_members, function(obj){
            var categoryVal = obj.objectID || noOwnerText;

            if (categoryVal > 0) {
                if (userHash[categoryVal]) {
                    categoryVal = userHash[categoryVal].FirstName + ' ' + userHash[categoryVal].LastName || userHash[categoryVal].UserName || categoryVal;
                } else {
                    categoryVal = 'User' + categoryVal;
                }
            }

            if (!Ext.Array.contains(categories, categoryVal)){
                categories.push(categoryVal);
                user_oids.push(obj.ObjectID);
            }
            closedSeriesData.push({
                y: obj.closed.length,
                userOid: obj.objectID
            });
            openSeriesData.push({
                y: obj.open.length,
                userOid: obj.objectID
            });
        });

        return {
            categories: categories,
            series: [
                {name: 'Current Work In Progress', data: openSeriesData, stack: 1},
                {name: 'Completed Items', data: closedSeriesData, stack: 1}
            ]};

    },
    getPersonChartData: function(userOid){

        var ownerHash = this.processData([userOid]),
            classifications = {};
        if (ownerHash[userOid].closed){
            _.each(ownerHash[userOid].closed, function(c){
                if (classifications[c] == undefined){
                    classifications[c] = 0;
                }
                classifications[c]++;
            });
        }
        if (ownerHash[userOid].open){
            _.each( ownerHash[userOid].open, function(o){
                if (classifications[o] == undefined){
                    classifications[o] = 0;
                }
                classifications[o]++;
            });
        }

        var data = [];
        _.each(classifications, function(c, name){
            data.push({
                name: name,
                y: c
            });
        });

        return [{ data: data}];

        return [{
            name: "Brands",
            colorByPoint: true,
            data: [{
                name: "Microsoft Internet Explorer",
                y: 56.33
            },{
                name: "Chrome",
                y: 24.03
            },{
                name: "Firefox",
                y: 10.38
            }]
        }];
    },
    processData: function(teamMembers){

        var snaps_by_oid = Rally.technicalservices.Toolbox.aggregateSnapsByOidForModel(this.historicalSnapshots),
            statePrecedences = this.statePrecedence,
            completedStateIndex = _.indexOf(statePrecedences, this.completedStateValue),
            stateFieldName = this.stateFieldName,
            previousValuesStateFieldName = this.previousValuesStateFieldName,
            ownerHash = {},
            noClassificationText = this.noClassificationText,
            classificationField = this.classificationField;

        _.each(snaps_by_oid, function(snaps, oid){
            var closed = null,
                classification = null,
                owner = snaps[0].Owner || -1;

            _.each(snaps, function(snap){
                var stateIndex = _.indexOf(statePrecedences, snap[stateFieldName]),
                    prevStateIndex = _.indexOf(statePrecedences, snap[previousValuesStateFieldName]);

                if (stateIndex >= completedStateIndex && prevStateIndex < completedStateIndex){
                    closed = snap[classificationField] || noClassificationText;
                    owner = snap.Owner;
                }
                if (closed && stateIndex < completedStateIndex){
                    closed = null;  //Don't count this...
                }
            });

            if (owner.length == 0){
                owner = -1;
            }

            if (closed && (teamMembers == undefined || _.contains(teamMembers, owner))){
                if (!ownerHash[owner]){
                    ownerHash[owner] = {closed: [], open: [], objectID: owner};
                }
                ownerHash[owner].closed.push(closed);
            }
        });

        _.each(this.currentRecords, function(r){
            if (r.get('ScheduleState') == 'In-Progress'){
                var ownerKey = r.get('Owner') ? r.get('Owner').ObjectID : -1;
                if (teamMembers == undefined || _.contains(teamMembers, ownerKey)){
                    if (!ownerHash[ownerKey]){
                        ownerHash[ownerKey] = {closed: [], open: [], objectID: ownerKey};
                    }
                    ownerHash[ownerKey].open.push(r.get(classificationField) || noClassificationText);
                }
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