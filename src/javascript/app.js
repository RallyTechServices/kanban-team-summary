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

    launch: function() {
       // this.logger.log('Project Children', this.getContext().getProject().Name, this.getContext().getProject().Children.Count);
        //if (this.getContext().getProject().Children.Count > 0){
        //    this.add({
        //        xtype: 'container',
        //        html: "This app is designed to work only for project (Teams) with no child projects."
        //    });
        //    return;
        //}
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
            this._fetchResolvedData(),
            this._fetchCurrentData()
        ];

        Deft.Promise.all(promises).then({
            scope: this,
            success: function(snapshotsAndRecords){
                this.logger.log('_fetchData success', snapshotsAndRecords);
                this.setLoading(false);
                this.currentRecords = snapshotsAndRecords[1];


                this._updateApp(snapshotsAndRecords[0]);
            },
            failure: function(operation){
                this.setLoading(false);
                Rally.ui.notify.Notifier.showError('Failed to load artifact data: ' + operation.error.errors[0]);
            }
        });
    },
    _updateApp: function(snapshots){

        this.getBodyCt().removeAll();
        if (!snapshots){
            this.setLoading(true);
            this._fetchResolvedData().then({
                scope: this,
                success: function(snapshots){
                    this.setLoading(false);
                    this._buildChart(snapshots);
                },
                failure: function(operation){
                    this.setLoading(false);
                    Rally.ui.notify.Notifier.showError('Failed to load artifact data: ' + operation.error.errors[0]);
                }
            });
        } else {
            this._buildChart(snapshots);
        }


    },
    _buildChart: function(snapshots){
        var calculator = Ext.create('Rally.technicalservices.KanbanTeamSummaryCalculator',{
            itemId: 'chart-summary',
            historicalSnapshots: snapshots,
            currentRecords: this.currentRecords,
            statePrecedence: this.allowedValuesArray,
            completedStateValue: this.completedStateValue,
            stateFieldName: this.stateField,
            previousValuesStateFieldName: this.previousValuesStateField
        });
        var chartData = calculator.getChartData();

        this.logger.log('chartData',chartData);
        this.getBodyCt().add({
            xtype: 'rallychart',
            loadMask: false,
            chartConfig: this.getChartConfig(chartData.categories),
            chartData: {
                series: chartData.series
            }
        });
    },
    getChartConfig: function(categories){
        return  {
            chart: {
                type: 'column'
            },
            title: {
                text: 'Team Summary from ' + Rally.util.DateTime.formatWithDefault(Rally.util.DateTime.fromIsoString(this.getStartDate())),
                align: 'center'
            },
            xAxis: [{
                categories:  categories,

                labels: {
                    align: 'left',
                    rotation: 70
                }
            }],
            yAxis: {
                min: 0,
                title: 'Number of Items Completed'
            },
            plotOptions: {
                bar: {
                    pointPadding: 10
                },
                series: {
                    stacking: 'normal',
                    pointWidth: 15
                }
            }
        };
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
    getBodyCt: function(){
        return this.down('#ct-body');
    }
});
