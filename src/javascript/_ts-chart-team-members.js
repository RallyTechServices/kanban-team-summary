Ext.define('Rally.technicalservices.chart.TeamMembers',{
    extend: 'Ext.panel.Panel',
    alias: 'widget.tsteammemberschart',

    config: {
        calculator: null
    },
    constructor:function(config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    },
    updateCalculator: function(calculator){
        this.calculator = calculator;
        this.updatePanel();
    },
    updatePanel: function(team){
        if (team){
            this.team = team;
        }
        this.removeAll();

        if (!this.team){
            return;
        }

        this.setTitle(this.team);
        var chartData = this.calculator.getTeamUsersChartData(this.team);
        var chartHeight = Math.max(Rally.getApp().getHeight() * .90, chartData.categories.length * 20);

        this.add({
            xtype: 'rallychart',
            itemId: 'team-members-chart',
            loadMask: false,
            chartData: {
                series: chartData.series,
            },
            chartConfig: {
                chart: {
                    type: 'bar',
                    height: chartHeight
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
                    series: {
                        point: {
                            events: {
                                click: function (e) {
                                    Rally.getApp().showPersonTab(this.options.userOid,this.category);
                                }
                            }
                        },
                        stacking: 'normal'
                    }
                }
            }
        });

        this.setHeight(chartHeight);

    }
});
