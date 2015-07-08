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

    launch: function() {

        Rally.technicalservices.Toolbox.fetchAllowedValuesPrecedenceArray(this.stateField).then({
            scope: this,
            success: function(allowedValuesArray){

                this._addComponents();
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
            this._fetchResolvedData(),
            this._fetchCurrentData()
        ];

        Deft.Promise.all(promises).then({
            scope: this,
            success: function(teamHashAndSnapshotsAndRecords){
                this.logger.log('_fetchData success', teamHashAndSnapshotsAndRecords);
                this.setLoading(false);
                this.currentRecords = teamHashAndSnapshotsAndRecords[2];
                this.teamHash = teamHashAndSnapshotsAndRecords[0];
                this.snapshots = teamHashAndSnapshotsAndRecords[1];
                this._updateApp(teamHashAndSnapshotsAndRecords[1]);
            },
            failure: function(operation){
                this.setLoading(false);
                Rally.ui.notify.Notifier.showError('Failed to load artifact data: ' + operation.error.errors[0]);
            }
        });
    },
    _updateApp: function(snapshots){

        this._clearCharts();
        if (!snapshots){
            this.setLoading(true);
            this._fetchResolvedData().then({
                scope: this,
                success: function(snapshots){
                    this.setLoading(false);
                    this.calculator = Ext.create('Rally.technicalservices.KanbanTeamSummaryCalculator',{
                        itemId: 'chart-summary',
                        historicalSnapshots: snapshots,
                        currentRecords: this.currentRecords,
                        statePrecedence: this.allowedValuesArray,
                        completedStateValue: this.completedStateValue,
                        stateFieldName: this.stateField,
                        previousValuesStateFieldName: this.previousValuesStateField,
                        teamHash: this.teamHash
                    });
                    this._buildTeamChart(this.calculator);
                },
                failure: function(operation){
                    this.setLoading(false);
                    Rally.ui.notify.Notifier.showError('Failed to load artifact data: ' + operation.error.errors[0]);
                }
            });
        } else {
            this.calculator = Ext.create('Rally.technicalservices.KanbanTeamSummaryCalculator',{
                itemId: 'chart-summary',
                historicalSnapshots: snapshots,
                currentRecords: this.currentRecords,
                statePrecedence: this.allowedValuesArray,
                completedStateValue: this.completedStateValue,
                stateFieldName: this.stateField,
                previousValuesStateFieldName: this.previousValuesStateField,
                teamHash: this.teamHash
            });
            this._buildTeamChart(this.calculator);
        }
    },
    _buildTeamChart: function(calculator){

        var me = this,
            chartData = calculator.getTeamChartData(),
            chartConfig = this.getTeamChartConfig('Team Summary', chartData.categories, chartData.series, chartData.drilldown);

        this.logger.log('chartData',chartData,chartConfig);

        this.getTeamCt().add({
            xtype: 'rallychart',
            itemId: 'team-chart',
            loadMask: false,
            chartConfig: chartConfig,
            chartData: {
                series: chartData.series,
            }
        });
    },
    _drilldownPerson: function(user_oid){

    },
    _drilldownTeam: function(team, thisApp){
        var chartData = thisApp.calculator.getTeamUsersChartData(team),
            chartConfig = thisApp.getTeamMembersChartConfig(team, chartData.categories, thisApp);

        thisApp.logger.log('_drilldownTeam chartData',chartData);

        thisApp.getTeamMembersCt().removeAll();
        thisApp.getTeamMembersCt().add({
            xtype: 'rallychart',
            itemId: 'team-members-chart',
            loadMask: false,
            chartConfig: chartConfig,
            chartData: {
                series: chartData.series
            }
        });
    },
    getTeamMembersChartConfig: function(title, categories, thisApp){

        return  {
            chart: {
                type: 'bar'
            },
            title: {
                text: title,
                align: 'center'
            },
            subtitle: {
                text: Rally.util.DateTime.formatWithDefault(Rally.util.DateTime.fromIsoString(thisApp.getStartDate())) + ' to present'

            },
            xAxis: [{
                categories:  categories,
            }],
            yAxis: {
                min: 0,
                title: 'Number of Artifacts'
            },
            plotOptions: {
                bar: {
               //     pointPadding: 10
                },
                series: {
                    point: {
                        events: {
                            click: function (event) {
                                console.log('this', this, thisApp);
                            }
                        }
                    },
                    stacking: 'normal'
                }
            }
        };

    },
    getTeamChartConfig: function(title, categories){
        var me = this;

        return  {
            chart: {
                type: 'bar'
            },
            title: {
                text: title,
                align: 'center'
            },
            subtitle: {
                text: Rally.util.DateTime.formatWithDefault(Rally.util.DateTime.fromIsoString(this.getStartDate())) + ' to present'

            },
            xAxis: [{
                categories:  categories,
            }],
            yAxis: {
                min: 0,
                title: 'Number of Artifacts'
            },
            plotOptions: {
                bar: {
                   pointPadding: 10
                },
                series: {
                    point: {
                    events: {
                    click: function (event) {
                        console.log('this', this);
                        me._drilldownTeam(this.category, me);
                    }}},
                    stacking: 'normal'
                }
            }
        };
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
                        console.log('records',records);
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
        var startDate = this.getStartDate() || Rally.util.DateTime.toIsoString

        var find = {
            _TypeHierarchy: {$in: ['Defect','HierarchicalRequirement']},
            _ValidFrom: {$gte: this.getStartDate()},
            Project: this.getContext().getProject().ObjectID,
            "_PreviousValues.ScheduleState": {$exists: true},
            Children: null
        };

        var store = Ext.create('Rally.data.lookback.SnapshotStore',{
            fetch: this.fetchList,
            limit: 'Infinity',
            findConfig: find,
            hydrate: this.hydrateList
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
    _fetchCurrentData: function(){
        var deferred = Ext.create('Deft.Deferred');

        var store = Ext.create('Rally.data.wsapi.artifact.Store',{
            limit: 'Infinity',
            models: ['Defect','UserStory'],
            fetch: this.currentDataFetchList,
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
    _addComponents: function(){
        var header = this.add({
            xtype: 'container',
            class: 'header',
            layout: {
                type: 'hbox'
            }
        });

        var body = this.add({
            xtype: 'container',
            itemId: 'ct-body'
        });
        body.add({
            xtype: 'container',
            itemId: 'ct-teams'
        });
        body.add({
            xtype: 'container',
            itemId: 'ct-team-members'
        });
        body.add({
            xtype: 'container',
            itemId: 'ct-person'
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
        cb.on('change', function(df){this._updateApp();}, this);

    },
    getDateInPast: function(daysBack){
        if (!daysBack){
            daysBack = this.defaultDays;
        }
        return Rally.util.DateTime.add(new Date(), 'day', -daysBack);
    },
    getStartDate: function(){
        this.logger.log('getStartDate',this.down('#df-start').getValue());
            return Rally.util.DateTime.toIsoString(this.down('#df-start').getValue()) || Rally.util.DateTime.add(new Date(), 'day',-this.defaultDays);
    },
    getTeamCt: function(){
        return this.down('#ct-teams');
    },
    getTeamMembersCt: function(){
        return this.down('#ct-team-members');
    },
    getPersonCt: function(){
        return this.down('#ct-person');
    },
    _clearCharts: function(){
        this.getTeamCt().removeAll();
        this.getTeamMembersCt().removeAll();
        this.getPersonCt().removeAll();
    }
});
