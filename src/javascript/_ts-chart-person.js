Ext.define('Rally.technicalservices.chart.Person',{
    extend: 'Ext.panel.Panel',
    alias: 'widget.tspersonchart',
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
    updatePanel: function(userOid, userLabel){

        if (userOid && userLabel){
            this.userOid = userOid;
            this.userLabel = userLabel;
        }
        this.removeAll();

        if (!this.userOid){
            return;
        }
        var chartData = this.calculator.getPersonChartData(this.userOid);

        this.setTitle(this.userLabel);
        this.add({
            xtype: 'rallychart',
            itemId: 'person-chart',
            loadMask: false,

            chartConfig:{
            chart: {
                type: 'pie',
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false
            },
            title: {
                text: this.userLabel,
                align: 'center'
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                    }
                }
            }
            },
            chartData: {
                series: chartData
            }
        });
        this.setHeight(Rally.getApp().getHeight() * 95);


    },
    constructor:function (config) {
        this.mergeConfig(config);
        this.callParent([this.config]);
    }
});
