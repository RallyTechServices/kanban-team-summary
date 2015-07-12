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
        var chartHeight = Math.max(Rally.getApp().getHeight() * .95, chartData.categories.length * 20);
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
                legend: {
                    verticalAlign: 'top',
                    align: 'center'
                },
                title: {
                    text: '',
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
        this.setHeight(chartHeight);
        this.setWidth(Rally.getApp().getWidth()*.95);
    }

});
