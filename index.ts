import {Rate, Trend} from "k6/metrics";
import {check, group, sleep} from "k6";
import Logging from "./Logging";
import http from "k6/http";
import {UserAssignment} from "./Data";
import Journey from "./Journey";

export {check, group, sleep, http, Rate, Trend, UserAssignment, Journey, Logging};

export interface Action {
    name: string;
    perform(data: any, journeyTrend: Trend, actionTrend: Trend, errors: Rate): any;
    continueOnFail?: boolean;
}

export interface JourneyI {
    name: string;
    actions: Action[];
    execute(setup: Object, data: any): any;
}

export type ScenarioI = {
    journey: JourneyI;
    k6ScenarioBlock: any;
    data?: any;
}

export type tiedActions = {
    [key: string]: Action
}

export function wrapper(name: string, journeyData: any, journeyTrend: Trend, actionTrend: Trend, errors: Rate, callback: ((data: any) => any)) {
    group(name, function () {
        journeyData.tags = {"name": name, "dashboard": __ENV.DASHBOARD || "main"};
        if (!journeyData.log) journeyData.log = [];
        if (journeyData.continueOnFail || !journeyData.error) { // if the action is set to execute, ie. no errors or errors accepted
            try {
                journeyData = callback(journeyData); // Actions gets executed here
                const okCheck = check(journeyData.response, {
                    'status 200': (r) => r.status === 200       // generic 200 check - always performed to save repetition
                }, journeyData.tags);
                if (journeyData.result !== false) {
                    journeyData.response = okCheck;  // only assign default check status if no status check happened TODO negative status response will break this
                }
                if (!journeyData.result){
                    journeyData.error = {...journeyData.error, ...{
                        status: journeyData.response.status,
                        errorCode: journeyData.response.error_code,
                        body: journeyData.response.body,
                    }};
                    if (!okCheck) { // log non-200 responses with explicit k6 check
                        check(journeyData.response, {
                            ['status ' + journeyData.response.status]: () => false
                        }, journeyData.tags);
                    }
                    if (Logging.print) journeyData.log.push('[' + __VU + ':' + __ITER + ']: ' + name + ' ERROR: ' + JSON.stringify(journeyData.error));
                } else {
                    if (Logging.print) journeyData.log.push('[' + __VU + ':' + __ITER + ']: ' + name + ' OK ( ' + journeyData.response.timings.waiting + ')');
                    journeyData.previousResponse = journeyData.response;
                }
                actionTrend.add(journeyData.response.timings.waiting, journeyData.tags); // wait time is measured per Action type
                journeyData.add(journeyData.response.timings.waiting, journeyData.tags); // aggregate journey wait time is updated
                errors.add(!journeyData.result, journeyData.tags);
                sleep(1); // k6 requires MANDATORY 1 sec wait between requests to maintain framework stability
            } catch (e) { // first catch layer, for Action level code errors
                if (Logging.print) journeyData.log.push('[' + __VU + ':' + __ITER + ']: ' + name + ' CATCH: ' + e);
                try {
                    check(journeyData.response, {
                        ['catch ' + journeyData.response.status]: (r) => r.status === 200
                    }, journeyData.tags);
                    journeyData.error = {
                        ...journeyData.error, ...{
                            status: journeyData.response.status,
                            errorCode: journeyData.response.error_code,
                            body: journeyData.response.body,
                        }
                    };
                    if (Logging.print) journeyData.log.push('[' + __VU + ':' + __ITER + ']: ' + name + ' RESPONSE: ' + JSON.stringify(journeyData.error));
                    errors.add(true, journeyData.tags); // update error count
                    actionTrend.add(journeyData.response.timings.waiting, journeyData.tags); // wait time is measured per Action type
                    journeyData.add(journeyData.response.timings.waiting, journeyData.tags); // aggregate journey wait time is updated
                } catch (e) { // second catch layer - for when above error processing fails - indicating this module error
                    if (Logging.print) journeyData.log.push('[' + __VU + ':' + __ITER + ']: ' + name + ' TRY CATCH PROCESSING ERROR: ' + e.message + '\nat: ' + e.stackTrace);
                } finally {
                    sleep(1); // no matter what processing error, the minimum 1 sec cooldown between requests ensures run stability
                }
            } finally {
                // wipe data between Actions
                journeyData.response = undefined;
                journeyData.result = undefined;
            }
        } else {
            if (Logging.print) journeyData.log.push('[' + __VU + ':' + __ITER + ']: SKIP'); // for each action in journey that is not executing due to earlier action failing
        }
    });
    return journeyData;
}