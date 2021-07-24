import {Logging, Rate, Trend, Action, JourneyI, tiedActions, group, sleep} from "./index";

export class Journey implements JourneyI{
    actions: Action[];
    name: string;
    journeyTrend: Trend;
    actionTrends = new Map<string, Trend>();
    errors: Rate;
    pauseBetweenJourneysInSec: number;

    constructor(name: string, actions: (Action | (Action | tiedActions)[] | number)[], frequency: number) {
        this.name = name;
        this.actions = this.processRepeatAction(actions);
        this.journeyTrend = new Trend('waitingTimeTrend', true);
        this.errors = new Rate('errors');
        this.pauseBetweenJourneysInSec = frequency;
        const scope = this;
        new Set(this.actions).forEach(function (action) {
            scope.actionTrends.set(action.name, new Trend(action.name, true)) // Journey may contain many Actions, repeated many times
            // actionTrends map keeps track of each action combined execution times
        });
    }

    execute(_setup: Object, data: any): any {
        const scope = this;
        group(this.name, function () {
            for (let i = 0; i < scope.actions.length; i++) {
                if (scope.actions[i].continueOnFail !== undefined){
                    // when repeat section is detected, it sets continue to fail automatically, repeat sections want to always execute entirely
                    data.continueOnFail = scope.actions[i].continueOnFail;

                    // this check, as opposed to same check at top of perform wrapper, ensures non-continue fails terminate journey
                } else if (!data.error || data.continueOnFail){
                    // main execution of each action, actions freely change data object and pass it from one to another
                    data = scope.actions[i].perform(data, scope.journeyTrend, scope.actionTrends.get(scope.actions[i].name)!, scope.errors);
                } else {
                    if (Logging.print) data.log.push(scope.actions[i].name + '[' + __VU + ':' + __ITER + ']: JOURNEY STOPPED.');
                    break;
                }
            }
        });
        //logging
        if (Logging.print && data.log.length > 0) console.log(data.log.join('\n'));
        sleep(this.pauseBetweenJourneysInSec);
    }

    protected processRepeatAction(arr: (Action | (Action | tiedActions)[] | number)[]): any[]{
        let result: any = [];
        arr.map(function (val, index, array) {
            if(typeof val === 'number') {
                let thisArr = Array.from({length: val-1}, () => array[index - 1]);
                result.splice(result.length - 1, 0, {name: 'Repeat Section START', continueOnFail: true});
                result.push(thisArr);
                result.push({name: 'Repeat Section END', continueOnFail: false});
            } else {
                result.push(val);
            }
        });
        return this.processRepeatAction(this.flatDeep(result, 2));
    }

    protected processTiedAction(arr: (Action | (Action | tiedActions)[] | number)[]){
        const scope = this;
        let result: any = [];
        arr.map(function (val) {
            if (!val.hasOwnProperty('name')){
                result.splice(result.length, 0, {name: 'Tied Action START', continueOnFail: false});
                // @ts-ignore
                for (let key in val){
                    // @ts-ignore
                    result.push(val[key]);
                }
                result.push({name: 'Tied Action END', continueOnFail: true})
            } else {
                result.push(val);
            }
        });
        return result;
    }

    protected flatDeep(arr: any[], d = 1): any[] {
        return d > 0 ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? this.flatDeep(val, d - 1) : val), []) : arr.slice();
    }
}