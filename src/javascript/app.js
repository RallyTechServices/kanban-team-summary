Ext.define("ts-kanban-team-summary", {

    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),

    defaultMargin: 10,

    fetchList: ['Owner','_TypeHierarchy','_ValidFrom','_ValidTo'],
    hydrateList:  ['_TypeHierarchy'],
    currentDataFetchList: ['Owner','FormattedID','ObjectID','UserName','FirstName','LastName'],
    completedStateValue: 'Archive :|',
    inProgressStateValue: 'WIP',
    stateField: 'c_DCOpsKanban',
    previousValuesStateField: '_PreviousValues.c_DCOpsKanban',
    userFetchList: ['ObjectID','FirstName','MiddleName','LastName','DisplayName','UserName','Phone'],
    noTeamText: 'No Team',
    classificationField: 'c_DCOpsSwimlanes',

    launch: function() {

        this.add({
            xtype: 'container',
            itemId: 'ct-loading',
            flex: 1,
            padding: 25,
            style: {
                textAlign: 'center',
                fontFamily: 'NotoSansBold, Helvetica, Arial',
                fontSize: '14px'
            },
            html: 'Loading team data...'
        });

        Rally.technicalservices.Toolbox.fetchAllowedValuesPrecedenceArray(this.stateField).then({
            scope: this,
            success: function(allowedValuesArray){

                this._initApp(allowedValuesArray);
            },
            failure: function(msg){
                this.down('#ct-loading').destroy();
                Rally.ui.notify.Notifier.showError({message: msg});
            }
        });
    },
    _initApp: function(allowedValuesArray){
        this.logger.log('_initApp');
        this.allowedValuesArray = allowedValuesArray;

        var promises = [
            this._fetchUsersAndTeams(),
            this._fetchCurrentData()
        ];

        Deft.Promise.all(promises).then({
            scope: this,
            success: function(teamHashAndSnapshotsAndRecords){
                this.logger.log('_fetchData success', teamHashAndSnapshotsAndRecords);
                this.down('#ct-loading').destroy();

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
        this.setLoading("Loading historical data...");
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
                    inProgressStateValue: this.inProgressStateValue,
                    stateFieldName: this.stateField,
                    previousValuesStateFieldName: this.previousValuesStateField,
                    teamHash: this.teamHash,
                    classificationField: this.classificationField
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
        var tabHeight = 40,
            tabWidth = 220;

        var tabs = this.add({
            xtype: 'tabpanel',
            itemId: 'tabs',
            activeTab: 'tab-team',
            plain: true,
            tabBar: {
                height: tabHeight,
                style: {
                    backgroundColor: 'white'
                }
            },
            items: [{
                itemId: 'tab-team',
                xtype: 'tsteampanel',
                calculator: this.calculator,
                tabConfig: {
                    title: 'Team Summary',
                    height: tabHeight,
                    maxWidth: tabWidth,
                    width: tabWidth

                }

            },{
                itemId: 'tab-team-member',
                xtype: 'tsteammemberschart',
                calculator: this.calculator,
                tabConfig: {
                    height: tabHeight,
                    maxWidth: tabWidth,
                    width: tabWidth
                },
                hidden: true
            },{
                itemId: 'tab-person',
                xtype: 'tspersonchart',
                calculator: this.calculator,
                tabConfig: {
                    height: tabHeight,
                    maxWidth: tabWidth,
                    width: tabWidth
                },
                hidden: true
            }]
        });
        tabs.setActiveTab(true, tabs.child('#tab-team'));
        this.down('#tabs').setSize(this.getWidth() * 0.95)


    },
    _getTeamKey: function(rec){
        var key = null,
            phone = rec.get('Phone');
        if (phone){
            var match = /Team:\s*(.*)/.exec(phone,"g");
            if (match && match.length >= 2){
                key = match[1];
            }
        }

        return key;
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
                                        var team = this._getTeamKey(u) || noTeamText;
                                        if (!_.has(team_hash, team)){
                                            team_hash[team] = [];
                                        }
                                        team_hash[team].push(u);
                                    }, this);

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
            _ValidFrom: {$gte: startDate},
            Project: this.getContext().getProject().ObjectID,
            Children: null,
            limit: Infinity
        };
        find[this.previousValuesStateField] = {$exists: true};
    //    find[this.stateField] = this.completedStateValue;

        var fetch = this.fetchList.concat([this.classificationField]).concat([this.previousValuesStateField, this.stateField]);
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
        var fetch = this.currentDataFetchList.concat([this.classificationField]).concat([this.stateField]);
        var store = Ext.create('Rally.data.wsapi.artifact.Store',{
            limit: 'Infinity',
            models: ['Defect','UserStory'],
            fetch: fetch,
            context: {
                project: this.getContext().getProjectRef()
            },
            filters: [{
                property: this.stateField,
                value: this.inProgressStateValue
            }]
        });

        store.load({
            scope: this,
            callback: function(records, operation, success){
                this.logger.log('_fetchCurrentData', success, records.length, operation, fetch);
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
            fieldLabel: 'Start from Date',
            itemId: 'df-start',
            labelAlign: 'right',
            maxValue: new Date(),
            value: Rally.technicalservices.Toolbox.getBeginningOfMonthAsDate(new Date()),
            margin: this.defaultMargin
        });
        cb.on('change', function(){this._reloadSnapshots();}, this);

    },
    getStartDate: function(){
        this.logger.log('getStartDate',this.down('#df-start').getValue());
        return Rally.util.DateTime.toIsoString(this.down('#df-start').getValue());// || Rally.util.DateTime.add(new Date(), 'day',-this.defaultDays);
    }
});
