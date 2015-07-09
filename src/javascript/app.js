Ext.define("ts-kanban-team-summary", {

    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),

    defaultDays: 90,
    defaultMargin: 10,

    fetchList: ['Owner','ScheduleState','_TypeHierarchy','_ValidFrom','_ValidTo','_PreviousValues.ScheduleState'],
    hydrateList:  ['ScheduleState','_TypeHierarchy','_PreviousValues.ScheduleState'],
    currentDataFetchList: ['Owner','ScheduleState','FormattedID','ObjectID','UserName','FirstName','LastName'],
    completedStateValue: 'Completed',
    stateField: 'ScheduleState',
    previousValuesStateField: '_PreviousValues.ScheduleState',
    userFetchList: ['ObjectID','FirstName','MiddleName','LastName','DisplayName','UserName','c_Country'],
    noTeamText: 'No Team',
    classificationField: 'c_DCOpsSwimlanes',

    launch: function() {

        Rally.technicalservices.Toolbox.fetchAllowedValuesPrecedenceArray(this.stateField).then({
            scope: this,
            success: function(allowedValuesArray){

                this._initApp(allowedValuesArray);
            },
            failure: function(msg){
                Rally.ui.notify.Notifier.showError({message: msg});
            }
        });
    },
    _initApp: function(allowedValuesArray){
        this.logger.log('_initApp');
        this.allowedValuesArray = allowedValuesArray;

        this.setLoading(true);
        var promises = [
            this._fetchUsersAndTeams(),
            this._fetchCurrentData()
        ];

        Deft.Promise.all(promises).then({
            scope: this,
            success: function(teamHashAndSnapshotsAndRecords){
                this.logger.log('_fetchData success', teamHashAndSnapshotsAndRecords);
                this.setLoading(false);

                this.currentRecords = teamHashAndSnapshotsAndRecords[1];
                this.teamHash = teamHashAndSnapshotsAndRecords[0];
                this._addHeader();
                this._reloadSnapshots();
            },
            failure: function(operation){
                this.setLoading(false);
                Rally.ui.notify.Notifier.showError('Failed to load artifact data: ' + operation.error.errors[0]);
            }
        });
    },
    _reloadSnapshots: function(){
        this.setLoading(true);
        this._fetchResolvedData().then({
            scope: this,
            success: function (snapshots) {

                this.setLoading(false);
                this.snapshots = snapshots;
                this.calculator = Ext.create('Rally.technicalservices.KanbanTeamSummaryCalculator',{
                    itemId: 'chart-summary',
                    historicalSnapshots: snapshots,
                    currentRecords: this.currentRecords,
                    statePrecedence: this.allowedValuesArray,
                    completedStateValue: this.completedStateValue,
                    stateFieldName: this.stateField,
                    previousValuesStateFieldName: this.previousValuesStateField,
                    teamHash: this.teamHash,
                    classificationField: 'c_DCOpsSwimlanes'
                });

                if (!this.down('#tabs')){
                    this._addTabs();
                } else {
                    this._updateTabs();
                }
            },
            failure: function (operation) {
                this.setLoading(false);
                Rally.ui.notify.Notifier.showError('Failed to load artifact data: ' + operation.error.errors[0]);
            }
        });
    },
    _updateTabs: function(){
        this.logger.log('_updateTabs', this.calculator.historicalSnapshots.length);
        var tabs = this.down('#tabs');
        var active_tab = tabs.getActiveTab();
        tabs.child('#tab-team').updateCalculator(this.calculator);
        tabs.child('#tab-team-member').updateCalculator(this.calculator);
        tabs.child('#tab-person').updateCalculator(this.calculator);
        tabs.setActiveTab(active_tab);
    },
    showTeamMembersTab: function(team){
        this.logger.log('showTeamMembersTag', team);
        var tab = this.down('#tabs').child('#tab-team-member');
        tab.tab.show();
        tab.updatePanel(team);

        this.down('#tabs').setActiveTab(tab);
        this.down('#tabs').setSize(this.getWidth() * 0.95)
    },
    showPersonTab: function(personOid, personLabel){
        this.logger.log('showPersonTab', personOid, personLabel);
        var tab = this.down('#tabs').child('#tab-person');
        tab.tab.show();
        tab.updatePanel(personOid, personLabel);

        this.down('#tabs').setActiveTab(tab);
        this.down('#tabs').setSize(this.getWidth() * 0.95)
    },
    _addTabs: function(){
        var tabs = this.add({
            xtype: 'tabpanel',
            itemId: 'tabs',
            activeTab: 'tab-team',
            items: [{
                itemId: 'tab-team',
                xtype: 'tsteampanel',
                calculator: this.calculator,
                tabConfig: {
                    title: 'Teams'
                }
            },{
                itemId: 'tab-team-member',
                xtype: 'tsteammemberschart',
                calculator: this.calculator,
                hidden: true
            },{
                itemId: 'tab-person',
                xtype: 'tspersonchart',
                calculator: this.calculator,
                hidden: true
            }]
        });
        tabs.setActiveTab(true, tabs.child('#tab-team'));
        this.down('#tabs').setSize(this.getWidth() * 0.95)


    },
    _fetchUsersAndTeams: function(){
        var deferred = Ext.create('Deft.Deferred'),
            userFetchList = this.userFetchList,
            noTeamText = this.noTeamText;

        var store = Ext.create('Rally.data.wsapi.Store',{
            model: 'Project',
            fetch: ['TeamMembers'],
            filters: [{
                property: 'ObjectID',
                value: this.getContext().getProject().ObjectID
            }],
            limit: 'Infinity'
        });
        store.load({
            scope: this,
            callback: function(records, operation, success){
                if (success){
                    if (records.length){
                        records[0].getCollection('TeamMembers').load({
                            scope: this,
                            fetch: userFetchList,
                            callback: function(col_records, col_operation, col_success){
                                if (col_success){
                                    var team_hash = {};

                                    _.each(col_records, function(u){
                                        var team = u.get('c_Country') || noTeamText;
                                        if (!_.has(team_hash, team)){
                                            team_hash[team] = [];
                                        }
                                        team_hash[team].push(u);
                                    });

                                    deferred.resolve(team_hash);
                                } else {
                                    deferred.reject(col_operation);
                                }
                            }
                        });
                    } else {
                        deferred.resolve([]);
                    }
                } else {
                    deferred.reject(operation);
                }
            }
        });

        return deferred;
    },
    _fetchResolvedData: function(){
        var deferred = Ext.create('Deft.Deferred');
        var startDate = this.getStartDate();

        var find = {
            _TypeHierarchy: {$in: ['Defect','HierarchicalRequirement']},
            _ValidFrom: {$gte: this.getStartDate()},
            Project: this.getContext().getProject().ObjectID,
            "_PreviousValues.ScheduleState": {$exists: true},
            Children: null
        };

        var fetch = this.fetchList.concat([this.classificationField]);
        var store = Ext.create('Rally.data.lookback.SnapshotStore',{
            fetch: fetch,
            limit: 'Infinity',
            findConfig: find,
            hydrate: this.hydrateList
        });

        store.load({
            scope: this,
            callback: function(records, operation, success){
                this.logger.log('_fetchResolvedData', success, records.length, operation);
                if (success) {
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation);
                }
            }
        });
        return deferred;
    },
    _fetchCurrentData: function(){
        var deferred = Ext.create('Deft.Deferred');
        var fetch = this.currentDataFetchList.concat([this.classificationField]);
        var store = Ext.create('Rally.data.wsapi.artifact.Store',{
            limit: 'Infinity',
            models: ['Defect','UserStory'],
            fetch: fetch,
            context: {
                project: this.getContext().getProjectRef()
            },
            filters: [{
                property: 'ScheduleState',
                value: 'In-Progress'
            }]
        });

        store.load({
            callback: function(records, operation, success){
                if (success) {
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation);
                }
            }
        });
        return deferred;
    },
    _addHeader: function(){
        var header = this.add({
            xtype: 'container',
            class: 'header',
            layout: {
                type: 'hbox'
            }
        });

        var cb = header.add({
            xtype: 'rallydatefield',
            value: this.getDateInPast(),
            fieldLabel: 'Start from Date',
            itemId: 'df-start',
            labelAlign: 'right',
            maxValue: this.getDateInPast(1),
            value: Rally.util.DateTime.add(new Date(), 'day',-this.defaultDays),
            margin: this.defaultMargin,
            stateId: this.getContext().getScopedStateId('ts-date'),
            stateful: true
        });
        cb.on('change', function(){this._reloadSnapshots();}, this);

    },
    getDateInPast: function(daysBack){
        if (!daysBack){
            daysBack = this.defaultDays;
        }
        return Rally.util.DateTime.add(new Date(), 'day', -daysBack);
    },
    getStartDate: function(){
        this.logger.log('getStartDate',this.down('#df-start').getValue());
        return Rally.util.DateTime.toIsoString(this.down('#df-start').getValue());// || Rally.util.DateTime.add(new Date(), 'day',-this.defaultDays);
    }
});
