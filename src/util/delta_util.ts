import _ from 'lodash';

const omitLabels = [
  'refId',
  'pluginId',
  'showWarningCantShowAllResults',
  'labelFormat',
  'timeShiftIsValid',
  'useFreeTextMetrics',
  'showGroupBySecondLevel',
  'aggregateGraphs'
];

export function generateStableHash(obj) {
  var pseudoHash = _.omit(obj, omitLabels);
  return JSON.stringify(pseudoHash);
}

/*
  Check if two time filters are overlapping.

  Return true when:

  from |-------------------| to (t2)
              from |--------------------| to (t1)

  Returns false when:

     from |-------------------| to (t2)
from |----------------------------------------| to (t1)

  from |-------------------| to (t2)
                        from |-------------------| to (t1)
*/
export function isOverlapping(t1, t2) {
  return t1.windowSize === t2.windowSize
        && t1.from < t2.to
        && t1.from > t2.from;
}

/*
  Appends new found items to already existing data in cache.
  Also removes old data accordingly (e.g. if 4 new datapoints were added,
  the corresponding oldest four datapoints are removed).
*/
export function appendData(newData, cachedDatapoints) {
  _.each(newData, (targetData, index) => {
    var appendedData = cachedDatapoints;
    var numberOfNewPoints = 0;

    _.each(targetData.datapoints, (datapoint, index) => {
      //add or replace value for timestamp
      var d = _.find(appendedData, function(o)  {  return  o[1] === datapoint[1];  });
      if (d) {
        d[0] = datapoint[0];
      } else {
        appendedData.push(datapoint);
        numberOfNewPoints++;
      }
    });

    newData[index].datapoints = _.slice(appendedData, numberOfNewPoints, appendedData.length);
  });

  return newData;
}
