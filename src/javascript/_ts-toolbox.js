/**
 * Created by kcorkan on 5/20/15.
 */
Ext.define('Rally.technicalservices.Toolbox',{
    singleton: true,

    fetchAllowedValuesPrecedenceArray: function(fieldName){
        var deferred = Ext.create('Deft.Deferred');

        Rally.data.ModelFactory.getModel({
            type: 'HierarchicalRequirement',
            success: function(model) {
                model.getField(fieldName).getAllowedValueStore().load({
                    callback: function (records, operation, success) {
                        if (success) {
                            var allowedValuesArray = [];
                            _.each(records, function (av) {
                                allowedValuesArray.push(av.get('StringValue'));
                            });
                            deferred.resolve(allowedValuesArray);
                        } else {
                            deferred.reject(operation);
                        }
                    }
                });
            },
            failure: function(){
                deferred.reject('Failed to load model HierarchicalRequirement');
            }
        });

        return deferred;
    },
    aggregateSnapsByOidForModel: function(snaps){
        //Return a hash of objects (key=ObjectID) with all snapshots for the object
        var snaps_by_oid = {};
        Ext.each(snaps, function(snap){
            var oid = snap.ObjectID || snap.get('ObjectID');
            if (snaps_by_oid[oid] == undefined){
                snaps_by_oid[oid] = [];
            }
            snaps_by_oid[oid].push(snap.getData());

        });
        return snaps_by_oid;
    },
    getRecordsHashByField: function(fieldName, records){
        var hash = {};
        _.each(records, function(r){
            var key = r.get(fieldName);
            if (!hash[key]){
                hash[key] = [];
            }
            hash[key].push(r);
        });
        return hash;
    }
});