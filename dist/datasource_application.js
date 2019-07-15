System.register(['./datasource_abstract', './cache', 'lodash', "./util/analyze_util"], function(exports_1) {
    var __extends = (this && this.__extends) || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
    var datasource_abstract_1, cache_1, lodash_1, analyze_util_1;
    var InstanaApplicationDataSource;
    return {
        setters:[
            function (datasource_abstract_1_1) {
                datasource_abstract_1 = datasource_abstract_1_1;
            },
            function (cache_1_1) {
                cache_1 = cache_1_1;
            },
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            },
            function (analyze_util_1_1) {
                analyze_util_1 = analyze_util_1_1;
            }],
        execute: function() {
            InstanaApplicationDataSource = (function (_super) {
                __extends(InstanaApplicationDataSource, _super);
                /** @ngInject */
                function InstanaApplicationDataSource(instanceSettings, backendSrv, templateSrv, $q) {
                    _super.call(this, instanceSettings, backendSrv, templateSrv, $q);
                    // our ui is limited to 80 results, same logic to stay comparable
                    this.maximumNumberOfUsefulDataPoints = 80;
                    // duplicate to QueryCtrl.ALL_APPLICATIONS
                    this.ALL_APPLICATIONS = '-- No Application Filter --';
                    this.applicationsCache = new cache_1.default();
                }
                InstanaApplicationDataSource.prototype.getApplications = function (timeFilter) {
                    var key = this.getTimeKey(timeFilter);
                    var applications = this.applicationsCache.get(key);
                    if (applications) {
                        return applications;
                    }
                    var windowSize = this.getWindowSize(timeFilter);
                    var data = {
                        group: {
                            groupbyTag: 'application.name'
                        },
                        timeFrame: {
                            to: timeFilter.to,
                            windowSize: windowSize
                        },
                        metrics: [{
                                metric: 'calls',
                                aggregation: 'SUM'
                            }],
                        order: {
                            // TODO fix api and figure out how to get correct ordering
                            by: 'callsAgg',
                            direction: "desc"
                        },
                        pagination: {
                            ingestionTime: 0,
                            offset: 0,
                            retrievalSize: 200
                        }
                    };
                    applications = this.postRequest('/api/application-monitoring/analyze/call-groups', data).then(function (applicationsResponse) {
                        return applicationsResponse.data.items.map(function (entry) { return ({
                            'key': entry.name,
                            'label': entry.name
                        }); });
                    });
                    this.applicationsCache.put(key, applications);
                    return applications;
                };
                InstanaApplicationDataSource.prototype.getApplicastionTags = function () {
                    var applicationTags = this.simpleCache.get('applicationTags');
                    if (applicationTags) {
                        return applicationTags;
                    }
                    applicationTags = this.doRequest('/api/application-monitoring/catalog/tags').then(function (tagsResponse) {
                        return tagsResponse.data.map(function (entry) { return ({
                            'key': entry.name,
                            'type': entry.type
                        }); });
                    });
                    this.simpleCache.put('applicationTags', applicationTags);
                    return applicationTags;
                };
                InstanaApplicationDataSource.prototype.getApplicationMetricsCatalog = function () {
                    var applicationCatalog = this.simpleCache.get('applicationCatalog');
                    if (applicationCatalog) {
                        return applicationCatalog;
                    }
                    applicationCatalog = this.doRequest('/api/application-monitoring/catalog/metrics').then(function (catalogResponse) {
                        return catalogResponse.data.map(function (entry) { return ({
                            'key': entry.metricId,
                            'label': entry.label,
                            'aggregations': entry.aggregations ? entry.aggregations.sort() : []
                        }); });
                    }).then(function (catalogResponse) {
                        // not all metrics in the metric catalog are working right now, so it is hard coded and manually set. Might be needless in the future
                        var hardCodedResponse = [
                            { key: "calls", label: "Call count", aggregations: ["SUM"] },
                            { key: "latency", label: "Call latency", aggregations: ["MAX", "MEAN", "MIN", "P25", "P50", "P75", "P90", "P95", "P98", "P99"] },
                            { key: "errors", label: "Error rate", aggregations: ["MEAN"] },
                            { key: "services", label: "Service Count", aggregations: ["DISTINCT_COUNT"] },
                        ];
                        return hardCodedResponse;
                    });
                    this.simpleCache.put('applicationCatalog', applicationCatalog);
                    return applicationCatalog;
                };
                InstanaApplicationDataSource.prototype.fetchMetricsForApplication = function (target, timeFilter) {
                    // avoid invalid calls
                    if (!target || !target.metric || !target.group || !target.entity) {
                        return this.$q.resolve({ data: { items: [] } });
                    }
                    // our is limited to maximumNumberOfUsefulDataPoints results, to stay comparable
                    var windowSize = this.getWindowSize(timeFilter);
                    var tagFilters = [];
                    if (target.entity.key) {
                        tagFilters.push({
                            name: 'application.name',
                            operator: 'EQUALS',
                            value: target.entity.key
                        });
                    }
                    lodash_1.default.forEach(target.filters, function (filter) {
                        if (filter.isValid) {
                            tagFilters.push(analyze_util_1.createTagFilter(filter));
                        }
                    });
                    var metric = {
                        metric: target.metric.key,
                        aggregation: target.aggregation ? target.aggregation : 'SUM'
                    };
                    var granularity = null;
                    if (target.pluginId !== "singlestat" && target.pluginId !== "gauge") {
                        if (target.granularity) {
                            granularity = target.granularity;
                        }
                        else {
                            granularity = analyze_util_1.getChartGranularity(windowSize, this.maximumNumberOfUsefulDataPoints);
                            target.granularity = granularity;
                        }
                        metric['granularity'] = granularity.value;
                    }
                    var group = {
                        groupbyTag: target.group.key
                    };
                    if (target.group.key === "call.http.header" && target.groupbyTagSecondLevelKey) {
                        group['groupbyTagSecondLevelKey'] = target.groupbyTagSecondLevelKey;
                    }
                    var data = {
                        group: group,
                        timeFrame: {
                            to: timeFilter.to,
                            windowSize: windowSize
                        },
                        tagFilters: tagFilters,
                        metrics: [metric]
                    };
                    return this.postRequest('/api/application-monitoring/analyze/call-groups?fillTimeSeries=true', data);
                };
                InstanaApplicationDataSource.prototype.buildApplicationLabel = function (target, item, key, index) {
                    if (target.labelFormat) {
                        console.log(target.timeShift);
                        var label = target.labelFormat;
                        label = lodash_1.default.replace(label, '$label', item.name);
                        label = lodash_1.default.replace(label, '$application', target.entity.label);
                        label = lodash_1.default.replace(label, '$metric', target.metric.label);
                        label = lodash_1.default.replace(label, '$key', key);
                        label = lodash_1.default.replace(label, '$index', index + 1);
                        label = lodash_1.default.replace(label, '$timeShift', target.timeShift);
                        return label;
                    }
                    if (target.entity.label === this.ALL_APPLICATIONS) {
                        return target.timeShift ? item.name + ' - ' + key + " - " + target.timeShift : item.name + ' - ' + key;
                    }
                    return target.timeShift && target.timeShiftIsValid ?
                        item.name + ' (' + target.entity.label + ')' + ' - ' + key + " - " + target.timeShift
                        :
                            item.name + ' (' + target.entity.label + ')' + ' - ' + key;
                };
                return InstanaApplicationDataSource;
            })(datasource_abstract_1.default);
            exports_1("default", InstanaApplicationDataSource);
        }
    }
});
//# sourceMappingURL=datasource_application.js.map