Ext.define('Rally.technicalservices.chart.Team',{
    extend: 'Ext.panel.Panel',
    alias: 'widget.tsteampanel',

    config: {
        calculator: null
    },
    constructor:function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
        this.renderPanel();
    },
    updateCalculator: function(calculator){
        this.calculator = calculator;
        this.renderPanel();
    },
    renderPanel: function(){

        this.removeAll();
        var chartData = this.calculator.getTeamChartData();

        this.add({
            xtype: 'rallychart',
            itemId: 'team-chart',
            loadMask: false,
            chartData: {
                series: chartData.series,
            },
            chartConfig: {
                chart: {
                    type: 'bar'
                },
                title: {
                    text: 'Team Summary',
                    align: 'center'
                },
                yAxis: {
                    min: 0,
                    title: 'Number of Artifacts'
                },
                xAxis: [{
                    categories: chartData.categories
                }],
                plotOptions: {
                    bar: {
                        pointPadding: 10
                    },
                    series: {
                        point: {
                            events: {
                                click: function (e) {
                                    Rally.getApp().showTeamMembersTab(this.category);
                                }
                            }
                        },
                        stacking: 'normal'
                }
            }
        }
        });
        this.setHeight(Rally.getApp().getHeight() * 95);
    }

});
